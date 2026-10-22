import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { baseProfile, cheveningExtraction } from "./fixtures";
import { checkNoticeText, MAX_NOTICE_CHARS } from "./inputCheck";
import { daysUntil, parseIsoDate, parseNumber } from "./normalize";
import type { Criterion } from "./types";
import { evaluateCriterion } from "./evaluate";
import { quoteAppearsIn } from "./verifyQuote";

const cheveningText = readFileSync(
  path.join(__dirname, "..", "fixtures", "chevening.txt"),
  "utf8",
);
const today = new Date(2026, 9, 22); // 22 Oct 2026 (local)

const crit = (c: Partial<Criterion>): Criterion => ({
  id: "x",
  quote: "a long enough quote",
  field: "age",
  operator: "lte",
  values: ["25"],
  unit: "years",
  ...c,
});

describe("Test 1: Chevening with 1 year of work experience", () => {
  it("is Not eligible and quotes the 2,800 hours rule from the pasted text", () => {
    const a = analyze(cheveningExtraction, cheveningText, baseProfile, today);
    expect(a.verdict.verdict).toBe("not_eligible");
    const work = a.rows.find((r) => r.criterion.field === "work_experience")!;
    expect(work.status).toBe("fail");
    expect(work.quoteVerified).toBe(true);
    expect(work.criterion.quote).toContain("2,800 hours");
    expect(quoteAppearsIn(work.criterion.quote, cheveningText)).toBe(true);
  });

  it("passes the work rule with 2 years, then says 'Passes all checkable rules' (never plain Eligible)", () => {
    const a = analyze(
      cheveningExtraction,
      cheveningText,
      { ...baseProfile, workExperienceYears: 2 },
      today,
    );
    expect(a.rows.find((r) => r.criterion.id === "c3")!.status).toBe("pass");
    expect(a.verdict.verdict).toBe("passes_checkable");
    expect(a.verdict.judgementCount).toBe(3);
  });

  it("shows pass / fail / can't tell for every row", () => {
    const a = analyze(cheveningExtraction, cheveningText, baseProfile, today);
    for (const r of a.rows) expect(["pass", "fail", "unknown"]).toContain(r.status);
  });

  it("finds the deadline and counts the days", () => {
    const a = analyze(cheveningExtraction, cheveningText, baseProfile, today);
    expect(a.deadlines[0].status).toBe("350 days left");
    expect(a.documents.every((d) => d.quoteVerified)).toBe(true);
  });
});

describe("Test 3: a made-up quote is flagged and not counted", () => {
  it("flags a quote that is not in the pasted text and ignores it in the verdict", () => {
    const fake = {
      ...cheveningExtraction,
      criteria: [
        ...cheveningExtraction.criteria,
        {
          id: "fake",
          quote: "Applicants must be under 20 years of age.",
          field: "age" as const,
          operator: "lte" as const,
          values: ["20"],
          unit: "years" as const,
        },
      ],
    };
    const a = analyze(fake, cheveningText, { ...baseProfile, workExperienceYears: 2 }, today);
    const row = a.rows.find((r) => r.criterion.id === "fake")!;
    expect(row.quoteVerified).toBe(false);
    // Age 23 would FAIL "under 20", but the fake rule must not make us Not eligible.
    expect(a.verdict.verdict).toBe("passes_checkable");
    expect(a.verdict.subtitle).toContain("ignored");
  });

  it("flags a made-up document and deadline quote", () => {
    const fake = {
      ...cheveningExtraction,
      documents: [{ name: "Blood test", quote: "A recent blood test report." }],
      deadlines: [{ label: "Fake", date_iso: "2026-11-01", quote: "Closes on 1 November 2026." }],
    };
    const a = analyze(fake, cheveningText, baseProfile, today);
    expect(a.documents[0].quoteVerified).toBe(false);
    expect(a.deadlines[0].quoteVerified).toBe(false);
    expect(a.deadlines[0].status).toBe("Not verified");
  });

  it("rejects empty, tiny and oversized input before any AI call", () => {
    expect(checkNoticeText("")).toMatch(/paste/i);
    expect(checkNoticeText("   \n  ")).toMatch(/paste/i);
    expect(checkNoticeText("hello")).toMatch(/too short/i);
    expect(checkNoticeText("x".repeat(MAX_NOTICE_CHARS + 1))).toMatch(/only the eligibility section/i);
    expect(checkNoticeText(cheveningText)).toBeNull();
  });
});

describe("quote matching", () => {
  it("ignores curly quotes, dashes, case and line breaks, but not different words", () => {
    const text = "Applicants must be   \n Indian citizens — aged 18–25.";
    expect(quoteAppearsIn("applicants must be indian citizens - aged 18-25.", text)).toBe(true);
    expect(quoteAppearsIn("Applicants must be Nepali citizens", text)).toBe(false);
  });
  it("never accepts an empty or tiny quote", () => {
    expect(quoteAppearsIn("", "anything at all")).toBe(false);
    expect(quoteAppearsIn("a", "a b c")).toBe(false);
  });
});

describe("numbers and units", () => {
  it("parses Indian-style numbers", () => {
    expect(parseNumber("2,800")).toBe(2800);
    expect(parseNumber("₹2,50,000")).toBe(250000);
    expect(parseNumber("abc")).toBeNull();
  });
  it("converts lakh to rupees", () => {
    const r = evaluateCriterion(
      crit({ field: "annual_income", operator: "lte", values: ["2.5"], unit: "lakh_inr" }),
      baseProfile,
    );
    expect(r.status).toBe("pass"); // 2,50,000 <= 2,50,000
    const r2 = evaluateCriterion(
      crit({ field: "annual_income", operator: "lte", values: ["2"], unit: "lakh_inr" }),
      baseProfile,
    );
    expect(r2.status).toBe("fail");
  });
  it("won't compare income in a foreign currency", () => {
    const r = evaluateCriterion(
      crit({ field: "annual_income", operator: "lte", values: ["30000"], unit: "other_currency" }),
      baseProfile,
    );
    expect(r.status).toBe("unknown");
    expect(r.unknownKind).toBe("missing");
  });
  it("skipped profile field gives can't tell, not a guess", () => {
    const r = evaluateCriterion(crit({}), { ...baseProfile, age: null });
    expect(r.status).toBe("unknown");
    expect(r.explanation).toMatch(/skipped/i);
  });
  it("handles 'between' and 'gte' for marks", () => {
    expect(
      evaluateCriterion(
        crit({ field: "marks_percent", operator: "gte", values: ["75"], unit: "percent" }),
        baseProfile,
      ).status,
    ).toBe("fail");
    expect(
      evaluateCriterion(
        crit({ field: "age", operator: "between", values: ["18", "25"], unit: "years" }),
        baseProfile,
      ).status,
    ).toBe("pass");
  });
});

describe("set rules (category, state, course level, nationality)", () => {
  it("category in [sc, st] fails for OBC and passes for SC", () => {
    const c = crit({ field: "category", operator: "in", values: ["sc", "st"], unit: "none" });
    expect(evaluateCriterion(c, baseProfile).status).toBe("fail");
    expect(evaluateCriterion(c, { ...baseProfile, category: "sc" }).status).toBe("pass");
  });
  it("an unrecognised value in the list means can't tell, not fail", () => {
    const c = crit({ field: "category", operator: "in", values: ["minority"], unit: "none" });
    expect(evaluateCriterion(c, baseProfile).status).toBe("unknown");
  });
  it("matches states case-insensitively", () => {
    const c = crit({ field: "state", operator: "in", values: ["bihar"], unit: "none" });
    expect(evaluateCriterion(c, baseProfile).status).toBe("pass");
  });
  it("treats India / Indian / citizen of India the same", () => {
    const c = crit({ field: "nationality", operator: "in", values: ["Citizen of India"], unit: "none" });
    expect(evaluateCriterion(c, baseProfile).status).toBe("pass");
  });
  it("course level not_in works", () => {
    const c = crit({ field: "course_level", operator: "not_in", values: ["doctoral"], unit: "none" });
    expect(evaluateCriterion(c, baseProfile).status).toBe("pass");
  });
});

describe("dates", () => {
  it("rejects impossible dates", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseIsoDate("7 October 2026")).toBeNull();
  });
  it("counts days", () => {
    expect(daysUntil(parseIsoDate("2026-10-23")!, today)).toBe(1);
    expect(daysUntil(parseIsoDate("2026-10-20")!, today)).toBe(-2);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { analyze } from "../analyze";
import { loadAllSchemes } from "../databank/load";
import type { Scheme as DatabankScheme } from "../databank/types";
import { baseProfile, cheveningExtraction } from "../fixtures";
import { matchScheme } from "../match/engine";
import {
  noticeToUiScheme,
  PROVIDER_LABELS,
  profileFromUi,
  toUiProvider,
  toUiScheme,
  toUiStatus,
} from "./adapters";
import { computeStatus } from "../match/status";
import { EMPTY_PROFILE } from "./profile";
import type { StudentProfile } from "./types";

const today = new Date(2026, 9, 22); // 22 Oct 2026
const root = path.join(__dirname, "..", "..");

let byId: Record<string, DatabankScheme>;
beforeAll(async () => {
  byId = Object.fromEntries((await loadAllSchemes()).schemes.map((s) => [s.id, s]));
});

const ui: StudentProfile = {
  ...EMPTY_PROFILE,
  state: "Bihar", category: "SC", annualIncome: "200000", level: "UG", year: "1",
  courseType: "Science", gender: "Woman", disability: "no", marksPercent: "72", age: "19",
  workYears: "", minorityCommunity: "None", parentOccupation: "Farming", firstGeneration: "yes",
};

describe("provider types map to the UI's, with labels for every one", () => {
  it("maps every provider type in the data bank", async () => {
    const types = new Set((await loadAllSchemes()).schemes.map((s) => s.provider_type));
    for (const t of types) {
      const mapped = toUiProvider(t);
      expect(PROVIDER_LABELS[mapped]).toBeTruthy();
    }
    expect(toUiProvider("central")).toBe("government");
    expect(toUiProvider("foundation")).toBe("foundation");
    expect(toUiProvider("foreign_government")).toBe("foreign_government");
  });
});

describe("closing_soon is computed in code: open with 14 days or fewer left", () => {
  const status = (date: string | null, s = "unknown") =>
    toUiStatus(computeStatus({ date, text: "", quote: "", status: s }, today));
  it("14 days or fewer -> closing_soon; 15 or more -> open", () => {
    expect(status("2026-10-22")).toBe("closing_soon"); // today
    expect(status("2026-10-31")).toBe("closing_soon"); // 9 days
    expect(status("2026-11-05")).toBe("closing_soon"); // 14 days
    expect(status("2026-11-06")).toBe("open"); // 15 days
  });
  it("closed, stale and unknown", () => {
    expect(status("2026-10-20")).toBe("closed");
    expect(status("2025-05-14")).toBe("stale_cycle");
    expect(status(null, "unknown")).toBe("unknown");
  });
  it("open with no closing date stays plain open (it cannot be 'soon')", () => {
    expect(status(null, "open")).toBe("open");
  });
});

describe("profile form -> engine profile", () => {
  it("maps every answer the engine understands", () => {
    expect(profileFromUi(ui)).toEqual({
      courseLevel: "undergraduate", age: 19, state: "Bihar", category: "sc",
      annualIncomeInr: 200000, marksPercent: 72, workExperienceYears: null,
      nationality: "Indian", gender: "female", hasDisability: false,
    });
  });
  it("blank or skipped answers become null, never a guess", () => {
    const p = profileFromUi({ ...EMPTY_PROFILE, gender: "Prefer not to say" });
    expect(p).toMatchObject({
      courseLevel: null, age: null, state: null, category: null,
      annualIncomeInr: null, marksPercent: null, workExperienceYears: null,
      gender: null, hasDisability: null,
    });
  });
  it("PG and the other gender answers", () => {
    expect(profileFromUi({ ...ui, level: "PG", gender: "Man", disability: "yes" })).toMatchObject({
      courseLevel: "postgraduate", gender: "male", hasDisability: true,
    });
    expect(profileFromUi({ ...ui, gender: "Transgender" }).gender).toBe("other");
  });
});

describe("data-bank scheme + match -> UI scheme", () => {
  it("carries the verdict, quotes, amount, deadline, documents and links", () => {
    const m = matchScheme(byId.pms_sc, profileFromUi(ui), today);
    const s = toUiScheme(m);
    expect(s.verdict).toBe("eligible");
    expect(s.provider_type).toBe("government");
    expect(s.amount.text).toContain("Compulsory non-refundable fees");
    expect(s.amount.quote).toBeTruthy();
    expect(s.apply_url).toBe("https://scholarships.gov.in");
    expect(s.source_url).toMatch(/^https:\/\//);
    expect(s.states).toEqual(["All India"]);
    expect(s.levels).toEqual(expect.arrayContaining(["UG", "PG"]));
    expect(s.documents.length).toBeGreaterThan(0);
    expect(s.documents.every((d) => d.verified && d.quote)).toBe(true);
    expect(s.rules.filter((r) => r.result === "pass" && r.quote).length).toBeGreaterThanOrEqual(2);
    expect(s.summary.quote).toBeTruthy();
    expect(JSON.stringify(s)).not.toMatch(/demo/i);
  });
  it("a state scheme is tagged with its state", () => {
    const s = toUiScheme(matchScheme(byId.ka_post_matric_sc, profileFromUi(ui), today));
    expect(s.states).toEqual(["Karnataka"]);
    expect(s.verdict).toBe("not_eligible");
    expect(s.provider_type).toBe("state");
  });
  it("closing_soon and stale_cycle come through to the UI status", async () => {
    const schemes = (await loadAllSchemes()).schemes;
    const statuses = new Set(schemes.map((s) => toUiScheme(matchScheme(s, profileFromUi(ui), today)).deadline.status));
    expect(statuses.has("closing_soon")).toBe(true);
    expect(statuses.has("stale_cycle")).toBe(true);
  });
  it("notes and unquoted level/state rows are labelled, not given fake quotes", () => {
    const s = toUiScheme(matchScheme(byId.ka_post_matric_sc, { ...profileFromUi(ui), state: "Karnataka" }, today));
    const derived = s.rules.find((r) => r.label === "State");
    expect(derived?.quote).toBe("");
    expect(derived?.sourceNote).toBeTruthy();
    expect(s.rules.some((r) => r.note)).toBe(true);
  });
});

describe("pasted notice -> UI scheme", () => {
  const text = readFileSync(path.join(root, "fixtures", "chevening.txt"), "utf8");

  it("Chevening with 1 year of work experience: not eligible, with the 2,800-hour quote", () => {
    const profile = { ...profileFromUi(ui), courseLevel: "postgraduate" as const, workExperienceYears: 1 };
    const a = analyze(cheveningExtraction, text, profile, today);
    const s = noticeToUiScheme(a, cheveningExtraction.scholarship_name, today);
    expect(s.verdict).toBe("not_eligible");
    expect(s.summary.quote).toContain("2,800 hours");
    expect(s.rules[0].result).toBe("fail");
    expect(s.deadline.date).toBe("2027-10-07");
    expect(s.deadline.status).toBe("open");
    expect(s.documents.map((d) => d.name)).toContain("Two references");
  });
  it("with 2 years it is 'passes the rules we can check', never plain eligible", () => {
    const profile = { ...profileFromUi(ui), courseLevel: "postgraduate" as const, workExperienceYears: 2 };
    const s = noticeToUiScheme(analyze(cheveningExtraction, text, profile, today), "Chevening", today);
    expect(s.verdict).toBe("passes_checkable");
  });
  it("a made-up quote is flagged and does not count", () => {
    const fake = {
      ...cheveningExtraction,
      criteria: [
        ...cheveningExtraction.criteria,
        { id: "fake", quote: "Applicants must be under 20 years of age.", field: "age" as const,
          operator: "lte" as const, values: ["20"], unit: "years" as const },
      ],
      documents: [{ name: "Blood test", quote: "A recent blood test report." }],
    };
    const profile = { ...profileFromUi(ui), courseLevel: "postgraduate" as const, workExperienceYears: 2 };
    const s = noticeToUiScheme(analyze(fake, text, profile, today), "X", today);
    const flagged = s.rules.filter((r) => r.flagged);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].quote).toContain("under 20 years");
    expect(s.verdict).toBe("passes_checkable"); // the fake rule would have failed age 19
    expect(s.documents[0].verified).toBe(false);
  });
  it("a date the AI got wrong is replaced by the quote's date, with a note", () => {
    const wrong = {
      ...cheveningExtraction,
      deadlines: [{ label: "Close", date_iso: "2026-10-07", quote: "Applications close at 12:00 (UTC) on 7 October 2027." }],
    };
    const s = noticeToUiScheme(analyze(wrong, text, baseProfile, today), "X", today);
    expect(s.deadline.date).toBe("2027-10-07");
    expect(s.deadlines?.[0].note).toMatch(/AI said 2026-10-07/);
  });
});

// Nothing labelled demo / sample may remain anywhere in the presentation layer.
describe("no demo or sample-data text is left in the app", () => {
  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) && !/\.test\./.test(f) ? [p] : [];
    });
  }
  it("has no 'demo', 'Demo scheme', 'sample data' or DEMO_SCHEMES text", () => {
    const hits = ["app", "components", path.join("lib", "ui")]
      .flatMap((d) => files(path.join(root, d)))
      .filter((f) => !f.includes(path.join("app", "api"))) // server routes are not UI
      .filter((f) => /demo|sample data|sample wording|preview mode/i.test(readFileSync(f, "utf8")));
    expect(hits.map((h) => path.relative(root, h))).toEqual([]);
  });
});


describe("navigation and landing wording", () => {
  const read = (...p: string[]) => readFileSync(path.join(root, ...p), "utf8");
  it("the landing page shows no scheme counts", () => {
    const landing = read("components", "Landing.tsx");
    expect(landing).not.toMatch(/schemeCount|loadPayload|totals\./);
    expect(landing).not.toMatch(/\d[\d,]*\s+(Indian\s+)?schemes/i);
    expect(read("app", "page.tsx")).not.toMatch(/loadPayload|count/i);
  });
  it("the paste-a-notice page is not in the main navigation or on the landing page", () => {
    expect(read("components", "SiteHeader.tsx")).not.toMatch(/href:\s*"\/notice"/);
    expect(read("components", "Landing.tsx")).not.toContain("/notice");
  });
  it("it is linked at the bottom of the results page with the WhatsApp wording", () => {
    const results = read("components", "ResultsPage.tsx");
    expect(results).toContain("Got a scholarship message on WhatsApp?");
    expect(results).toContain('href="/notice"');
    expect(results).toContain("Check it here");
  });
});

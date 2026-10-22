import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadAllSchemes, loadPayload, parseCsv, summariseRegister } from "./databank/load";
import type { Scheme } from "./databank/types";
import { computeCoverage, levelTotals } from "./match/coverage";
import { matchAll, matchScheme } from "./match/engine";
import { computeStatus } from "./match/status";
import type { Profile } from "./types";

const today = new Date(2026, 9, 22); // 22 Oct 2026

// A student the data should treat as: SC, Bihar, UG, ₹2 lakh family income.
const sc: Profile = {
  courseLevel: "undergraduate", age: 19, state: "Bihar", category: "sc",
  annualIncomeInr: 200000, marksPercent: 72, workExperienceYears: 0,
  nationality: "Indian", gender: "female", hasDisability: false,
};

let all: Scheme[];
let byId: Record<string, Scheme>;
beforeAll(async () => {
  all = (await loadAllSchemes()).schemes;
  byId = Object.fromEntries(all.map((s) => [s.id, s]));
});

describe("data bank loading (read from the JSON files, nothing hardcoded)", () => {
  it("loads every scheme file with no problems", async () => {
    const files = readdirSync(path.join(process.cwd(), "databank", "schemes")).filter((f) => f.endsWith(".json"));
    const { schemes, problems } = await loadAllSchemes();
    expect(problems).toEqual([]);
    expect(schemes).toHaveLength(files.length);
  });
  it("shows domestic schemes by default and hides the abroad ones", async () => {
    const dflt = await loadPayload();
    expect(dflt.schemes.every((s) => s.region === "india")).toBe(true);
    expect(dflt.totals.hiddenAbroad).toBe(dflt.totals.all - dflt.totals.domestic);
    expect(dflt.totals.hiddenAbroad).toBeGreaterThan(0);
    expect(dflt.schemes.some((s) => s.id === "chevening_scholarship")).toBe(false);
    const everything = await loadPayload({ includeAbroad: true });
    expect(everything.schemes).toHaveLength(dflt.totals.all);
  });
  it("reads the NSP register", () => {
    const csv = readFileSync(path.join(process.cwd(), "databank", "registers", "nsp_central_2026_27.csv"), "utf8");
    const r = summariseRegister(csv);
    expect(r.rows).toBeGreaterThan(10);
    expect(r.closingDates[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("parses quoted CSV fields", () => {
    expect(parseCsv('a,"b, c",d\n1,2,3')).toEqual([["a", "b, c", "d"], ["1", "2", "3"]]);
  });
});

describe("status is computed from the deadline and today's date", () => {
  const dl = (date: string | null, status = "unknown") => ({ date, text: "", quote: "", status });
  it("open when the date is today or later", () => {
    expect(computeStatus(dl("2026-10-31"), today)).toMatchObject({ status: "open", basis: "date", daysLeft: 9 });
    expect(computeStatus(dl("2026-10-22"), today).label).toBe("Open · closes today");
  });
  it("closed when the date passed within a year", () => {
    expect(computeStatus(dl("2026-10-20"), today)).toMatchObject({ status: "closed", daysLeft: -2 });
    expect(computeStatus(dl("2026-03-25"), today).status).toBe("closed");
  });
  it("stale when the date is more than a year old", () => {
    expect(computeStatus(dl("2025-05-14"), today).status).toBe("stale");
    expect(computeStatus(dl("2023-08-10"), today).status).toBe("stale");
  });
  it("ignores the status word in the file when there is a date", () => {
    expect(computeStatus(dl("2026-10-31", "closed"), today).status).toBe("open");
    expect(computeStatus(dl("2026-01-01", "open"), today).status).toBe("closed");
  });
  it("without a date, repeats the source's statement and says so", () => {
    expect(computeStatus(dl(null, "open"), today)).toMatchObject({ status: "open", basis: "source_statement" });
    expect(computeStatus(dl(null, "closed"), today)).toMatchObject({ status: "closed", basis: "source_statement" });
    expect(computeStatus(dl(null, "stale_cycle"), today).status).toBe("stale");
    expect(computeStatus(dl(null, "unknown"), today)).toMatchObject({ status: "unknown", basis: "none" });
  });
  it("every scheme file gets a status", () => {
    for (const s of all) expect(["open", "closed", "stale", "unknown"]).toContain(computeStatus(s.deadline, today).status);
  });
});

describe("matching (plain code, quotes come from the data bank)", () => {
  it("SC student under the income limit: PMS-SC is likely eligible, with quoted rules", () => {
    const m = matchScheme(byId.pms_sc, sc, today);
    expect(m.verdict).toBe("eligible");
    const quoted = m.rows.filter((r) => r.status === "pass" && r.quote);
    expect(quoted.map((r) => r.label)).toEqual(expect.arrayContaining(["Category", "Family income"]));
    expect(quoted.every((r) => byId.pms_sc.rules.some((x) => x.quote === r.quote))).toBe(true);
  });
  it("income above the limit: not eligible, and the deciding row carries the official quote", () => {
    const m = matchScheme(byId.pms_sc, { ...sc, annualIncomeInr: 300000 }, today);
    expect(m.verdict).toBe("not_eligible");
    expect(m.deciding?.label).toBe("Family income");
    expect(m.deciding?.quote).toContain("2,50,000");
  });
  it("wrong category: not eligible", () => {
    expect(matchScheme(byId.pms_sc, { ...sc, category: "obc" }, today).verdict).toBe("not_eligible");
  });
  it("a skipped answer gives can't tell, never a guess", () => {
    const m = matchScheme(byId.pms_sc, { ...sc, annualIncomeInr: null }, today);
    expect(m.verdict).toBe("cant_tell");
    expect(m.reason).toMatch(/skipped/i);
  });
  it("a state scheme is not eligible for a student from another state, and can't tell with no state", () => {
    expect(matchScheme(byId.ka_post_matric_sc, sc, today).verdict).toBe("not_eligible");
    expect(matchScheme(byId.ka_post_matric_sc, { ...sc, state: "Karnataka" }, today).verdict).toBe("eligible");
    expect(matchScheme(byId.ka_post_matric_sc, { ...sc, state: null }, today).verdict).toBe("cant_tell");
  });
  it("level tag: a PG-only scheme is not for a UG student", () => {
    const pgOnly = all.find((s) => s.level.length === 1 && s.level[0] === "PG")!;
    const m = matchScheme(pgOnly, sc, today);
    expect(m.verdict).toBe("not_eligible");
    expect(m.rows.some((r) => r.kind === "derived" && r.label === "Course level" && r.status === "fail")).toBe(true);
  });
  it("conditional rules are not applied to everyone", () => {
    const m = matchScheme(byId.icar_pgs, { ...sc, courseLevel: "postgraduate" }, today);
    const cond = m.rows.find((r) => r.explanation.includes("applies only when"));
    expect(cond?.status).toBe("unknown");
  });
  it("female-only schemes need gender", () => {
    expect(matchScheme(byId.kotak_kanya, { ...sc, gender: "male" }, today).verdict).toBe("not_eligible");
  });
  it("never says a student will get a scholarship", () => {
    for (const m of matchAll(all.filter((s) => s.region === "india"), sc, today)) {
      expect(m.reason.toLowerCase()).not.toMatch(/you will (get|receive|win)/);
    }
  });
  it("orders likely-eligible and open first, not-eligible last", () => {
    const ms = matchAll(all.filter((s) => s.region === "india"), sc, today);
    const ranks = ms.map((m) => ({ eligible: 0, cant_tell: 1, not_eligible: 2 })[m.verdict]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
  it("an 'Eligible' verdict always has a quoted rule behind it", () => {
    const ms = matchAll(all.filter((s) => s.region === "india"), sc, today);
    for (const m of ms.filter((x) => x.verdict === "eligible")) {
      expect(m.rows.some((r) => r.status === "pass" && r.quote)).toBe(true);
    }
  });
});

describe("coverage", () => {
  it("counts add up", async () => {
    const { schemes } = await loadPayload();
    const c = computeCoverage(schemes, today);
    const sum = (rows: { count: number }[]) => rows.reduce((n, r) => n + r.count, 0);
    expect(c.total).toBe(schemes.length);
    expect(sum(c.byProviderType)).toBe(c.total);
    expect(sum(c.byState)).toBe(c.total);
    expect(Object.values(c.byStatus).reduce((a, b) => a + b, 0)).toBe(c.total);
    expect(c.byLevel.ug + c.byLevel.pg + c.byLevel.both + c.byLevel.other).toBe(c.total);
    expect(levelTotals(c).ug).toBeGreaterThan(0);
    expect(c.rulesWithQuote).toBeGreaterThan(0);
  });
});

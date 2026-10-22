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


import { groupOfCourseText, groupOfStudent, readCourseRule } from "./match/courseType";

describe("course-type rules give Can't tell unless the student's course type clearly fits", () => {
  const student = (courseType: string | null): Profile => ({ ...sc, courseType });
  const row = (id: string, p: Profile) =>
    matchScheme(byId[id], p, today).rows.find((r) => r.label === "Course type" || r.label === "Field of study")!;

  it("reads course text with keywords (specific words first)", () => {
    expect(groupOfCourseText("B.E./B.Tech Computer Science and allied branches")).toBe("engineering");
    expect(groupOfCourseText("5-year Integrated LL.B.")).toBe("law");
    expect(groupOfCourseText("Bachelor and Masters in natural sciences (BSc/integrated MSc/MSc)")).toBe("science");
    expect(groupOfCourseText("Indian classical music")).toBe("creative_arts");
    expect(groupOfCourseText("Khelo India athletes")).toBe("sports");
    expect(groupOfCourseText("Social science and humanities")).toBe("arts_humanities");
    expect(groupOfCourseText("Master of Business Administration (PGP)")).toBe("management");
    expect(groupOfCourseText("something we cannot read")).toBeNull();
    expect(groupOfStudent("Engineering and technology")).toBe("engineering");
    expect(groupOfStudent("Other")).toBeNull();
    expect(groupOfStudent(null)).toBeNull();
  });
  it("a list that only says how the course is studied is a note, not a subject restriction", () => {
    expect(readCourseRule(["regular degree (not correspondence/distance, not diploma)"]).kind).toBe("format-only");
    expect(readCourseRule(["B.Tech full time"]).kind).toBe("subject");
  });

  it("Young Artistes: a clear fit only for fine / performing arts students", () => {
    for (const t of ["Science", "Arts and humanities", "Engineering and technology", "Other", null]) {
      const r = row("arts_moc_young_artists", student(t));
      expect(r.status).toBe("unknown");
      expect(r.checkable).toBe(true);
    }
    expect(row("arts_moc_young_artists", student("Fine arts, performing arts or film")).status).toBe("pass");
    expect(matchScheme(byId.arts_moc_young_artists, student("Science"), today).verdict).toBe("cant_tell");
  });
  it("Amazon Future Engineer: passes for Engineering only", () => {
    expect(row("eng_amazon_future_engineer", student("Engineering and technology")).status).toBe("pass");
    for (const t of ["Science", "Commerce", "Law", "Other", null]) {
      expect(row("eng_amazon_future_engineer", student(t)).status).toBe("unknown");
    }
  });
  it("CAN Eklavya: passes for Law only", () => {
    expect(row("law_can_eklavya", student("Law")).status).toBe("pass");
    expect(row("law_can_eklavya", student("Science")).status).toBe("unknown");
    expect(matchScheme(byId.law_can_eklavya, student("Science"), today).verdict).not.toBe("eligible");
  });
  it("INSPIRE SHE: passes for Science, Can't tell for Commerce", () => {
    expect(row("inspire_she", student("Science")).status).toBe("pass");
    expect(row("inspire_she", student("Commerce")).status).toBe("unknown");
    expect(row("inspire_she", student(null)).explanation).toMatch(/skipped/i);
  });
  it("PM-USP: 'regular degree' is a note, so it does not block", () => {
    const r = row("pm_usp_csss", student("Science"));
    expect(r.checkable).toBe(false);
  });
  it("a Can't tell course-type row stops the verdict from being 'eligible'", () => {
    for (const m of matchAll(all.filter((s) => s.region === "india"), student("Science"), today)) {
      const blocking = m.rows.some(
        (r) => (r.label === "Course type" || r.label === "Field of study") && r.checkable && r.status === "unknown",
      );
      if (blocking) expect(m.verdict).not.toBe("eligible");
    }
  });
  it("a skipped course type is Can't tell, not a guess", () => {
    expect(matchScheme(byId.eng_amazon_future_engineer, student(null), today).verdict).toBe("cant_tell");
  });
  it("earlier behaviour is unchanged: PMS-SC is still likely eligible for the SC student", () => {
    expect(matchScheme(byId.pms_sc, student("Science"), today).verdict).toBe("eligible");
  });
});


describe("year of study, special groups and parent occupation", () => {
  const base: Profile = { ...sc, courseType: "Science" };
  const rowBy = (id: string, p: Profile, label: string) =>
    matchScheme(byId[id], p, today).rows.find((r) => r.label === label);
  const valueText = (v: unknown) => (Array.isArray(v) ? String(v[0]) : String(v));

  it("year of study: a first-year rule passes for a first-year student, Can't tell otherwise", () => {
    const s = all.find((x) => x.region === "india" && x.rules.some((r) =>
      r.field === "year_of_study" && (r.op === "in" || r.op === "==") && !r.condition && /^(1|first)/i.test(valueText(r.value))))!;
    expect(s).toBeTruthy();
    expect(rowBy(s.id, { ...base, yearOfStudy: 1 }, "Year of study")?.status).toBe("pass");
    expect(rowBy(s.id, { ...base, yearOfStudy: 3 }, "Year of study")?.status).toBe("unknown");
    const skipped = rowBy(s.id, { ...base, yearOfStudy: null }, "Year of study");
    expect(skipped?.status).toBe("unknown");
    expect(skipped?.explanation).toMatch(/skipped/i);
  });
  it("lateral-entry and final-year rules are never a clear fit", () => {
    const s = all.find((x) => x.rules.some((r) => r.field === "year_of_study" && /lateral/i.test(valueText(r.value)) && !/^(1|first)/i.test(valueText(r.value)) && !Array.isArray(r.value)));
    if (s) expect(rowBy(s.id, { ...base, yearOfStudy: 2 }, "Year of study")?.status).not.toBe("pass");
  });

  it("a ticked DNT / EBC / minority group turns Can't tell into a pass; unticked stays Can't tell", () => {
    const general: Profile = { ...base, category: "general" };
    const withToken = (token: string) => all.find((x) => x.region === "india" && x.rules.some((r) =>
      r.field === "category" && r.op === "in" && !r.condition && Array.isArray(r.value) && (r.value as string[]).map((v) => v.toLowerCase()).includes(token)));
    const dnt = withToken("dnt")!;
    expect(dnt).toBeTruthy();
    expect(rowBy(dnt.id, general, "Category")?.status).toBe("unknown");
    expect(rowBy(dnt.id, { ...general, specialGroups: ["dnt"] }, "Category")?.status).toBe("pass");
    // a tick that has nothing to do with this rule settles nothing
    expect(rowBy(dnt.id, { ...general, specialGroups: ["manual_scavenging"] }, "Category")?.status).toBe("unknown");

    const minority = withToken("minority")!;
    expect(minority).toBeTruthy();
    expect(rowBy(minority.id, general, "Category")?.status).toBe("unknown");
    expect(rowBy(minority.id, { ...general, specialGroups: ["minority:sikh"] }, "Category")?.status).toBe("pass");
    // never turns into a fail just because nothing was ticked
    expect(rowBy(minority.id, { ...general, specialGroups: [] }, "Category")?.status).not.toBe("fail");
  });
  it("a ticked group can settle a skipped category", () => {
    const minority = all.find((x) => x.rules.some((r) => r.field === "category" && Array.isArray(r.value) && (r.value as string[]).includes("minority")))!;
    const row = rowBy(minority.id, { ...base, category: null, specialGroups: ["minority:muslim"] }, "Category");
    expect(row?.status).toBe("pass");
  });

  it("parent occupation: ticking the beedi / cine / mine box settles that rule only", () => {
    const s = all.find((x) => x.rules.some((r) => r.field === "parent_occupation" && /beedi/i.test(valueText(r.value))))!;
    expect(s).toBeTruthy();
    expect(rowBy(s.id, base, "Parent's occupation")?.status).toBe("unknown");
    expect(rowBy(s.id, { ...base, specialGroups: ["parent_beedi_cine_mine"] }, "Parent's occupation")?.status).toBe("pass");
    expect(rowBy(s.id, { ...base, specialGroups: ["manual_scavenging"] }, "Parent's occupation")?.status).toBe("unknown");
    // police / armed forces rules need exact conditions, so no tick settles them
    const police = all.find((x) => x.rules.some((r) => r.field === "parent_occupation" && /police|CAPF/i.test(valueText(r.value)) && !/beedi|mine|cine|scaveng/i.test(valueText(r.value))));
    if (police) expect(rowBy(police.id, { ...base, specialGroups: ["parent_beedi_cine_mine", "manual_scavenging"] }, "Parent's occupation")?.status).toBe("unknown");
  });
});

describe("gender rules (girls-only, boys-only, and extra conditions)", () => {
  const girlsOnly = () => all.filter((s) => s.region === "india").filter((s) =>
    s.rules.some((r) => r.field === "gender" && r.op === "==" && !r.condition && /^female/i.test(String(r.value))));
  const rowOf = (id: string, g: Profile["gender"]) =>
    matchScheme(byId[id], { ...sc, gender: g, courseLevel: "postgraduate" }, today).rows.find((r) => r.label === "Gender");

  it("a man is Not eligible for girls-only schemes, including 'female (women scientists)' wording", () => {
    const list = girlsOnly();
    expect(list.length).toBeGreaterThan(5);
    for (const s of list) expect(rowOf(s.id, "male")?.status).toBe("fail");
    const wos = byId.stem_dst_wos_a;
    expect(matchScheme(wos, { ...sc, gender: "male", courseLevel: "postgraduate" }, today).verdict).toBe("not_eligible");
    const single = byId.ugc_pg_indira_gandhi_sgc;
    expect(matchScheme(single, { ...sc, gender: "male", courseLevel: "postgraduate" }, today).verdict).toBe("not_eligible");
  });
  it("a woman passes plain girls-only rules but only 'Can't tell' when there is an extra condition", () => {
    expect(rowOf("aicte_pragati_degree", "female")?.status).toBe("pass");
    expect(rowOf("ugc_pg_indira_gandhi_sgc", "female")?.status).toBe("unknown");
    expect(rowOf("stem_dst_wos_a", "female")?.status).toBe("unknown");
  });
  it("another identity or a skipped answer is Can't tell, never a guess", () => {
    expect(rowOf("aicte_pragati_degree", "other")?.status).toBe("unknown");
    expect(rowOf("aicte_pragati_degree", null)?.status).toBe("unknown");
  });
  it("'Female students get 100% ...; male 50%' is a benefit note, not a restriction", () => {
    const s = all.find((x) => x.rules.some((r) => r.field === "gender" && /male 50%/i.test(String(r.value))));
    if (s) {
      const r = matchScheme(s, { ...sc, gender: "male" }, today).rows.find((x) => x.label === "Gender" && /50%/.test(x.explanation));
      expect(r?.checkable).toBe(false);
    }
  });
});

import type { Rule } from "../databank/types";
import { formatNumber, normalizeNationality, normalizeWord, parseNumber } from "../normalize";
import type { Profile } from "../types";
import { CATEGORY_LABELS, HOURS_PER_YEAR, STATES, type Category } from "../vocab";
import { groupOfStudent, readCourseRule } from "./courseType";
import { groupIdForOccupation, groupIdsForCategoryToken, labelOfGroup } from "./groups";

// Compares ONE published rule with the student's answers, in plain code.
// Anything the code does not fully understand becomes "can't tell"; it is never
// guessed. No AI is involved anywhere in this file.

export type RuleStatus = "pass" | "fail" | "unknown";

export interface RuleEval {
  label: string; // short name, e.g. "Family income"
  status: RuleStatus;
  // For "unknown":
  //   "missing": we could check it but lack an answer or understand the rule
  //   "manual":  it is a note / condition for the student to read
  unknownKind?: "missing" | "manual";
  // true = this rule counts toward the verdict; false = shown as "also check"
  checkable: boolean;
  explanation: string;
}

const pass = (label: string, explanation: string): RuleEval => ({
  label, status: "pass", checkable: true, explanation,
});
const fail = (label: string, explanation: string): RuleEval => ({
  label, status: "fail", checkable: true, explanation,
});
const missing = (label: string, explanation: string): RuleEval => ({
  label, status: "unknown", unknownKind: "missing", checkable: true, explanation,
});
const note = (label: string, explanation: string): RuleEval => ({
  label, status: "unknown", unknownKind: "manual", checkable: false, explanation,
});

// Restrictions we cannot check because we do not ask the student about them
// (for example "wards of police personnel", "must have qualified GATE").
// They block a plain "Eligible": the card says "Can't tell" and names them.
const BLOCKING_UNMODELLED = new Set([
  "institution",
  "year_of_study",
  "exam_qualified",
  "parent_occupation",
  "field_of_study",
  "subject_excluded",
  "degree_class",
  "employment",
]);

const FIELD_LABELS: Record<string, string> = {
  income_annual_inr: "Family income",
  marks_pct: "Marks",
  age_max: "Maximum age",
  age_min: "Minimum age",
  category: "Category",
  gender: "Gender",
  domicile_state: "State of domicile",
  citizenship: "Citizenship",
  work_experience_years: "Work experience",
  work_experience_hours: "Work experience",
  disability: "Disability",
  course_level: "Course level",
  course_type: "Course type",
  class: "Class",
  year_of_study: "Year of study",
  institution: "Institution",
  exam_qualified: "Entrance exam / test",
  parent_occupation: "Parent's occupation",
  field_of_study: "Field of study",
  subject_excluded: "Excluded subjects",
  degree_class: "Degree class",
  employment: "Employment",
  study_location: "Where you study",
  residence: "Residence",
  financial_need: "Financial need",
  admission: "Admission route",
  degree: "Degree",
  other: "Also note",
};

export const labelFor = (field: string): string =>
  FIELD_LABELS[field] ?? field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function valueText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function numeric(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") return parseNumber(v);
  return null;
}

type NumOp = "<=" | "<" | ">=" | ">" | "==";
const NUM_OPS = new Set(["<=", "<", ">=", ">", "=="]);

function compare(op: NumOp, actual: number, limit: number): boolean {
  switch (op) {
    case "<=": return actual <= limit;
    case "<": return actual < limit;
    case ">=": return actual >= limit;
    case ">": return actual > limit;
    case "==": return Math.abs(actual - limit) < 1e-9;
  }
}

const OP_WORDS: Record<NumOp, string> = {
  "<=": "at most",
  "<": "less than",
  ">=": "at least",
  ">": "more than",
  "==": "exactly",
};

function evalNumeric(
  rule: Rule,
  label: string,
  actual: number | null,
  limit: number | null,
  fmt: (n: number) => string,
  askLabel: string,
): RuleEval {
  if (!NUM_OPS.has(rule.op) || limit === null) {
    return note(label, `The rule is stated in words: ${valueText(rule.value) || rule.op}. Please read the quote.`);
  }
  if (actual === null) {
    return missing(label, `Needs ${OP_WORDS[rule.op as NumOp]} ${fmt(limit)}. You skipped "${askLabel}".`);
  }
  const ok = compare(rule.op as NumOp, actual, limit);
  const text = `Needs ${OP_WORDS[rule.op as NumOp]} ${fmt(limit)}. You entered ${fmt(actual)}.`;
  return ok ? pass(label, text) : fail(label, text);
}

const rupees = (n: number) => `₹${formatNumber(n)}`;
const percent = (n: number) => `${formatNumber(n)}%`;
const years = (n: number) => `${formatNumber(n)} ${n === 1 ? "year" : "years"}`;

// --- category ---------------------------------------------------------------

const CATEGORY_TOKENS: Record<string, Category> = {
  sc: "sc", st: "st", obc: "obc", general: "general", ews: "ews",
};

function evalCategory(rule: Rule, p: Profile): RuleEval {
  const label = "Category";
  const tokens = (Array.isArray(rule.value) ? rule.value : [rule.value]).map((v) => normalizeWord(String(v)));
  const listed = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(String).join(", ");
  if (rule.op !== "in" && rule.op !== "==") {
    return note(label, `Stated in words: ${listed}. Please read the quote.`);
  }

  const known = tokens.map((t) => CATEGORY_TOKENS[t]).filter(Boolean) as Category[];
  const mine = p.category ? CATEGORY_LABELS[p.category] : null;

  if (p.category && known.includes(p.category)) return pass(label, `Open to: ${listed}. You are ${mine}.`);

  // Groups the profile's five categories can't express (minority community, DNT,
  // EBC ...) can be settled by the optional "Anything else that applies?" ticks.
  const ticked = new Set(p.specialGroups ?? []);
  const settled = tokens
    .map((t) => groupIdsForCategoryToken(t))
    .flatMap((ids) => ids ?? [])
    .find((id) => ticked.has(id));
  if (settled) {
    return pass(label, `Open to: ${listed}. You told us: ${labelOfGroup(settled)}.`);
  }

  if (!p.category) return missing(label, `Open to: ${listed}. You skipped "Category".`);

  // EWS students are part of the general category in many schemes; we can't be sure.
  if (p.category === "ews" && known.includes("general")) {
    return missing(label, `Open to: ${listed}. You chose EWS; please check whether it counts as General for this scheme.`);
  }
  if (tokens.some((t) => !CATEGORY_TOKENS[t])) {
    const askable = tokens.some((t) => groupIdsForCategoryToken(t));
    return missing(
      label,
      `Open to: ${listed}. Your category (${mine}) doesn't settle the other groups listed, so we can't tell.${
        askable ? ' You can say if one applies in "Anything else that applies?" on your profile.' : ""
      }`,
    );
  }
  return fail(label, `Open to: ${listed}. You are ${mine}.`);
}

// --- parent's occupation ("beedi worker", "manual scavenger") ---------------

function evalParentOccupation(rule: Rule, p: Profile): RuleEval {
  const label = "Parent's occupation";
  const values = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(String);
  const listed = values.join("; ");
  const ticked = new Set(p.specialGroups ?? []);
  const settled = values.map(groupIdForOccupation).find((id) => id && ticked.has(id));
  if (settled) return pass(label, `This scheme is for: ${listed}. You told us: ${labelOfGroup(settled)}.`);
  return missing(
    label,
    `This scheme is for: ${listed}. We can't tell from your answers.${
      values.some(groupIdForOccupation)
        ? ' You can say if this applies in "Anything else that applies?" on your profile.'
        : " Please check the quote."
    }`,
  );
}

// --- year of study ("first year", "1", "2 (lateral entry)") -----------------

// A year is a clear fit only when the rule names the same year number, or a
// first-year rule meets a first-year student. "Lateral entry" and "final year"
// can't be known from a year number, so those stay "Can't tell".
function evalYearOfStudy(rule: Rule, p: Profile): RuleEval {
  const label = "Year of study";
  const values = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(String);
  const listed = values.join("; ");
  if (!p.yearOfStudy) return missing(label, `This scheme is for: ${listed}. You skipped "Current year".`);

  const fits = values.some((v) => {
    const t = v.trim().toLowerCase();
    if (/lateral|final|last year|graduating/.test(t)) return false;
    if (/^(1|1st|first)\b/.test(t)) return p.yearOfStudy === 1;
    const n = /^(\d)\b/.exec(t);
    return n ? p.yearOfStudy === Number(n[1]) : false;
  });
  return fits
    ? pass(label, `This scheme is for: ${listed}. You are in year ${p.yearOfStudy}.`)
    : missing(label, `This scheme is for: ${listed}. We can't tell whether year ${p.yearOfStudy} fits. Please check.`);
}
// --- domicile state ---------------------------------------------------------

function normalizeState(s: string): string {
  return normalizeWord(s).replace(/&/g, "and").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
}
const STATE_KEYS = new Set((STATES as readonly string[]).map(normalizeState));

function evalState(rule: Rule, p: Profile): RuleEval {
  const label = "State of domicile";
  const raw = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(String);
  const listed = raw.join(", ");
  if (!["in", "==", "not_in"].includes(rule.op)) return note(label, `Stated in words: ${listed}. Please read the quote.`);
  if (!p.state) return missing(label, `Needs a state: ${listed}. You skipped "State".`);

  const keys = raw.map(normalizeState);
  const allKnown = keys.every((k) => STATE_KEYS.has(k));
  const mine = normalizeState(p.state);
  const inList = keys.includes(mine);

  if (rule.op === "not_in") {
    if (inList) return fail(label, `Not open to: ${listed}. You live in ${p.state}.`);
    return allKnown ? pass(label, `Not open to: ${listed}. You live in ${p.state}.`) : missing(label, `The state list is written in words (${listed}). Please check.`);
  }
  if (inList) return pass(label, `Needs a state in: ${listed}. You live in ${p.state}.`);
  if (!allKnown) return missing(label, `The state rule is written in words (${listed}). Please check it yourself.`);
  return fail(label, `Needs a state in: ${listed}. You live in ${p.state}.`);
}

// --- gender, citizenship, disability ---------------------------------------

function evalGender(rule: Rule, p: Profile): RuleEval {
  const label = "Gender";
  const text = typeof rule.value === "string" ? normalizeWord(rule.value) : "";
  const stated = `Stated in words: ${valueText(rule.value)}. Please read the quote.`;
  if (rule.op !== "==") return note(label, stated);

  // "female" / "male", or one of them followed by extra words:
  //   "female (single girl child of her parents)", "female (women scientists)".
  // Text that mentions BOTH ("Female students get 100% ...; male 50%") is a
  // benefit difference, not a restriction, so it stays a note.
  const m = /^(female|male)\b\s*(.*)$/.exec(text);
  if (!m || (/\bfemale\b/.test(text) && /\bmale\b/.test(text.replace(/\bfemale\b/g, "")))) {
    return note(label, stated);
  }
  const wanted = m[1] as "female" | "male";
  const extra = m[2].trim();
  // "(girl students)" only repeats the gender; anything else is an extra condition.
  const exact = extra === "" || /^\(\s*(girl|girls|boy|boys|women|woman|male|female)?\s*students?\s*\)$/.test(extra);

  if (!p.gender) return missing(label, `Open to ${wanted} students. You skipped "Gender".`);
  // The profile only asks woman / man / another identity; "another" can't be
  // settled against a male-only or female-only rule, so it is "Can't tell".
  if (p.gender === "other") {
    return missing(label, `Open to ${wanted} students. We can't tell from your answer; please check the quote.`);
  }
  if (p.gender !== wanted) {
    return fail(label, `Open to ${wanted} students. You chose ${p.gender === "female" ? "woman" : "man"}.`);
  }
  return exact
    ? pass(label, `Open to ${wanted} students.`)
    : missing(label, `Open to ${wanted} students, with one more condition: ${extra}. Please check it.`);
}
function evalCitizenship(rule: Rule, p: Profile): RuleEval {
  const label = "Citizenship";
  const text = valueText(rule.value);
  const needsIndian = /india/i.test(text);
  if (!needsIndian || (rule.op !== "==" && rule.op !== "in")) {
    return note(label, `Stated in words: ${text}. Please read the quote.`);
  }
  if (!p.nationality) return missing(label, `Needs: ${text}. You skipped "Nationality".`);
  if (normalizeNationality(p.nationality) !== "indian") {
    return fail(label, `Needs: ${text}. You entered ${p.nationality}.`);
  }
  // "resident Indian citizen" also says "resident"; we ask nationality, not residence.
  return pass(label, `Needs: ${text}. You entered ${p.nationality}.`);
}

function evalDisability(rule: Rule, p: Profile): RuleEval {
  const label = "Disability";
  const min = numeric(rule.value);
  const need = min !== null ? `a disability of ${min}% or more` : "a disability";
  if (p.hasDisability === null) return missing(label, `Needs ${need}. You skipped the disability question.`);
  if (p.hasDisability === false) return fail(label, `Needs ${need}. You answered no.`);
  return missing(label, `Needs ${need}, shown by a disability certificate. We can't check the percentage.`);
}

// --- course type / field of study --------------------------------------------

// "Can't tell" unless the student's course type clearly fits (see courseType.ts).
// A clear mismatch is also "Can't tell", never "Not eligible": the course lists
// are free text read with keywords, and a wrong "Not eligible" would hide a scheme.
function evalCourseType(rule: Rule, p: Profile): RuleEval {
  const label = labelFor(rule.field);
  const values = (Array.isArray(rule.value) ? rule.value : [rule.value]).map(String);
  const listed = values.join("; ");
  const reading = readCourseRule(values);

  // Only about how the course is studied (regular, not distance ...): a note.
  if (reading.kind === "format-only") return note(label, listed);

  if (!p.courseType) {
    return missing(label, `This scheme is for: ${listed}. You skipped "Course type".`);
  }
  const mine = groupOfStudent(p.courseType);
  if (mine && reading.groups.includes(mine)) {
    return pass(label, `This scheme is for: ${listed}. You chose ${p.courseType}.`);
  }
  return missing(
    label,
    `This scheme is for: ${listed}. Your course type (${p.courseType}) doesn't clearly match, so we can't tell. Please check.`,
  );
}

// --- the entry point --------------------------------------------------------

export function evaluateRule(rule: Rule, p: Profile): RuleEval {
  const field = rule.field;
  const label = labelFor(field);

  // A rule that only applies in a sub-case (e.g. "SC/ST/PwD", "UG courses")
  // must not be applied to everybody, so we don't decide it.
  if (rule.condition && rule.op !== "note") {
    return missing(label, `This rule applies only when: ${rule.condition}. Please check whether that is you.`);
  }

  if ((field === "course_type" || field === "field_of_study") && (rule.op === "in" || rule.op === "==")) {
    return evalCourseType(rule, p);
  }
  if (field === "parent_occupation" && (rule.op === "in" || rule.op === "==")) return evalParentOccupation(rule, p);
  if (field === "year_of_study" && (rule.op === "in" || rule.op === "==")) return evalYearOfStudy(rule, p);

  switch (field) {
    case "income_annual_inr":
      if (rule.op === "none") return note(label, "No family income ceiling is stated.");
      return evalNumeric(rule, label, p.annualIncomeInr, numeric(rule.value), rupees, "Annual family income");
    case "marks_pct":
      return evalNumeric(rule, label, p.marksPercent, numeric(rule.value), percent, "Marks");
    case "age_max":
      if (rule.value === null || rule.op === "none") return note(label, "No upper age limit is stated.");
      return evalNumeric(rule, label, p.age, numeric(rule.value), years, "Age");
    case "age_min":
      return evalNumeric(rule, label, p.age, numeric(rule.value), years, "Age");
    case "work_experience_years":
      return evalNumeric(rule, label, p.workExperienceYears, numeric(rule.value), years, "Years of work experience");
    case "work_experience_hours": {
      const hours = numeric(rule.value);
      const r = evalNumeric(
        { ...rule, value: hours === null ? null : hours / HOURS_PER_YEAR },
        label, p.workExperienceYears, hours === null ? null : hours / HOURS_PER_YEAR, years, "Years of work experience",
      );
      return { ...r, explanation: `${r.explanation} (We count ${formatNumber(HOURS_PER_YEAR)} hours as one year.)` };
    }
    case "category":
      return evalCategory(rule, p);
    case "domicile_state":
      return evalState(rule, p);
    case "gender":
      return evalGender(rule, p);
    case "citizenship":
      return evalCitizenship(rule, p);
    case "disability":
      return evalDisability(rule, p);
    default: {
      const text = valueText(rule.value);
      const blocking = BLOCKING_UNMODELLED.has(field) && rule.op !== "note";
      const explanation = text || "See the quote.";
      return blocking
        ? missing(label, `We don't ask about this, so we can't check it: ${explanation}`)
        : note(label, explanation);
    }
  }
}

import type { Rule } from "../databank/types";
import { formatNumber, normalizeNationality, normalizeWord, parseNumber } from "../normalize";
import type { Profile } from "../types";
import { CATEGORY_LABELS, HOURS_PER_YEAR, STATES, type Category } from "../vocab";
import { groupOfStudent, readCourseRule } from "./courseType";

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
  if (!p.category) return missing(label, `Open to: ${listed}. You skipped "Category".`);

  const known = tokens.map((t) => CATEGORY_TOKENS[t]).filter(Boolean) as Category[];
  const hasUnknown = tokens.some((t) => !CATEGORY_TOKENS[t]);
  const mine = CATEGORY_LABELS[p.category];

  if (known.includes(p.category)) return pass(label, `Open to: ${listed}. You are ${mine}.`);
  // EWS students are part of the general category in many schemes; we can't be sure.
  if (p.category === "ews" && known.includes("general")) {
    return missing(label, `Open to: ${listed}. You chose EWS; please check whether it counts as General for this scheme.`);
  }
  if (hasUnknown) {
    return missing(
      label,
      `Open to: ${listed}. Your profile only records General/EWS/OBC/SC/ST, so we can't tell whether you are in the other groups listed.`,
    );
  }
  return fail(label, `Open to: ${listed}. You are ${mine}.`);
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
  const v = typeof rule.value === "string" ? normalizeWord(rule.value) : "";
  if (rule.op !== "==" || (v !== "female" && v !== "male")) {
    return note(label, `Stated in words: ${valueText(rule.value)}. Please read the quote.`);
  }
  if (!p.gender) return missing(label, `Open to ${v} students. You skipped "Gender".`);
  return p.gender === v
    ? pass(label, `Open to ${v} students.`)
    : fail(label, `Open to ${v} students. You chose ${p.gender}.`);
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

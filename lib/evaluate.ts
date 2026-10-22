import type { Criterion, EvaluatedRow, Profile, RowStatus } from "./types";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  FIELD_LABELS,
  STATES,
  type Category,
  type CourseLevel,
  type Field,
} from "./vocab";
import {
  formatNumber,
  normalizeNationality,
  normalizeWord,
  toCanonical,
} from "./normalize";

const FIELD_LABEL = FIELD_LABELS;

type Outcome = Pick<EvaluatedRow, "status" | "unknownKind" | "explanation">;

const manual = (explanation: string): Outcome => ({
  status: "unknown",
  unknownKind: "manual",
  explanation,
});
const missing = (explanation: string): Outcome => ({
  status: "unknown",
  unknownKind: "missing",
  explanation,
});
const result = (ok: boolean, explanation: string): Outcome => ({
  status: ok ? "pass" : "fail",
  explanation,
});

function formatValue(field: Field, n: number): string {
  switch (field) {
    case "annual_income":
      return `₹${formatNumber(n)}`;
    case "marks_percent":
      return `${formatNumber(n)}%`;
    default:
      return `${formatNumber(n)} ${n === 1 ? "year" : "years"}`;
  }
}

function evaluateNumeric(
  field: Field,
  c: Criterion,
  profileValue: number | null,
): Outcome {
  const label = FIELD_LABEL[field];
  if (profileValue === null) {
    return missing(`You skipped "${label}", so we can't check this rule.`);
  }
  const canon = toCanonical(field, c);
  if (!canon) {
    return missing(
      `The notice states this in a unit or format we can't safely compare (${c.values.join(", ")} ${c.unit}). Please check it yourself.`,
    );
  }
  const [a, b] = canon.nums;
  const mine = formatValue(field, profileValue);
  const note = canon.note ? ` ${canon.note}` : "";

  switch (c.operator) {
    case "gte":
      return result(
        profileValue >= a,
        `${label} must be at least ${formatValue(field, a)}. You entered ${mine}.${note}`,
      );
    case "lte":
      return result(
        profileValue <= a,
        `${label} must be at most ${formatValue(field, a)}. You entered ${mine}.${note}`,
      );
    case "eq":
      return result(
        Math.abs(profileValue - a) < 1e-9,
        `${label} must be exactly ${formatValue(field, a)}. You entered ${mine}.${note}`,
      );
    case "between":
      if (canon.nums.length !== 2) {
        return missing(`The range in this rule is unclear. Please check it yourself.`);
      }
      return result(
        profileValue >= Math.min(a, b) && profileValue <= Math.max(a, b),
        `${label} must be between ${formatValue(field, Math.min(a, b))} and ${formatValue(field, Math.max(a, b))}. You entered ${mine}.${note}`,
      );
    default:
      return missing(`This rule's wording can't be compared to a number. Please check it yourself.`);
  }
}

// For rules like "category must be SC or ST". `known` says whether a rule value
// is one of the words we recognise; if the rule lists words we don't recognise
// we can't be sure of a "fail", so we say "can't tell".
function evaluateSet(
  field: Field,
  c: Criterion,
  profileValue: string | null,
  profileDisplay: string,
  normalize: (s: string) => string,
  isKnown: (s: string) => boolean,
  display: (s: string) => string,
): Outcome {
  const label = FIELD_LABEL[field];
  if (profileValue === null || profileValue === "") {
    return missing(`You skipped "${label}", so we can't check this rule.`);
  }
  const values = c.values.map(normalize).filter((v) => v !== "");
  if (values.length === 0) {
    return missing(`The allowed values in this rule are unclear. Please check it yourself.`);
  }
  const mine = normalize(profileValue);
  const listed = values.map(display).join(", ");
  const hasUnknown = values.some((v) => !isKnown(v));
  const matches = values.includes(mine);

  switch (c.operator) {
    case "in":
    case "eq":
      if (matches) return result(true, `${label} must be one of: ${listed}. You entered ${profileDisplay}.`);
      if (hasUnknown) return missing(`${label} rule lists values we don't recognise (${listed}). Please check it yourself.`);
      return result(false, `${label} must be one of: ${listed}. You entered ${profileDisplay}.`);
    case "not_in":
      if (matches) return result(false, `${label} must not be: ${listed}. You entered ${profileDisplay}.`);
      if (hasUnknown) return missing(`${label} rule lists values we don't recognise (${listed}). Please check it yourself.`);
      return result(true, `${label} must not be: ${listed}. You entered ${profileDisplay}.`);
    default:
      return missing(`This rule's wording can't be compared automatically. Please check it yourself.`);
  }
}

export function evaluateCriterion(c: Criterion, profile: Profile): Outcome {
  if (c.operator === "judgement") {
    return manual("This rule needs your own judgement. Software can't decide it.");
  }
  switch (c.field) {
    case "none":
      return manual("This rule is about something outside your 8 profile answers. Please check it yourself.");
    case "age":
      return evaluateNumeric("age", c, profile.age);
    case "annual_income":
      return evaluateNumeric("annual_income", c, profile.annualIncomeInr);
    case "marks_percent":
      return evaluateNumeric("marks_percent", c, profile.marksPercent);
    case "work_experience":
      return evaluateNumeric("work_experience", c, profile.workExperienceYears);
    case "course_level":
      return evaluateSet(
        "course_level",
        c,
        profile.courseLevel,
        profile.courseLevel ? COURSE_LEVEL_LABELS[profile.courseLevel] : "",
        normalizeWord,
        (s) => (COURSE_LEVELS as readonly string[]).includes(s),
        (s) => COURSE_LEVEL_LABELS[s as CourseLevel] ?? s,
      );
    case "category":
      return evaluateSet(
        "category",
        c,
        profile.category,
        profile.category ? CATEGORY_LABELS[profile.category] : "",
        normalizeWord,
        (s) => (CATEGORIES as readonly string[]).includes(s),
        (s) => CATEGORY_LABELS[s as Category] ?? s,
      );
    case "state": {
      const stateKeys = (STATES as readonly string[]).map(normalizeWord);
      return evaluateSet(
        "state",
        c,
        profile.state,
        profile.state ?? "",
        normalizeWord,
        (s) => stateKeys.includes(s),
        (s) => (STATES as readonly string[]).find((x) => normalizeWord(x) === s) ?? s,
      );
    }
    case "nationality":
      return evaluateSet(
        "nationality",
        c,
        profile.nationality,
        profile.nationality ?? "",
        normalizeNationality,
        () => true, // an explicit list of nationalities is taken at face value
        (s) => (s === "indian" ? "Indian" : s),
      );
  }
}

export type { RowStatus };

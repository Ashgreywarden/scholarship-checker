import type { Profile } from "./types";
import {
  CATEGORIES,
  COURSE_LEVELS,
  STATES,
  type Category,
  type CourseLevel,
} from "./vocab";

// The raw text of each form field. Empty string = "not sure / skip".
export interface ProfileInput {
  courseLevel: string;
  age: string;
  state: string;
  category: string;
  income: string;
  marks: string;
  workYears: string;
  nationality: string;
  gender: string; // "", "female", "male", "other"
  disability: string; // "", "yes", "no"
}

export const EMPTY_PROFILE_INPUT: ProfileInput = {
  courseLevel: "",
  age: "",
  state: "",
  category: "",
  income: "",
  marks: "",
  workYears: "",
  nationality: "Indian",
  gender: "",
  disability: "",
};

function num(s: string, min: number, max: number): { value: number | null; bad: boolean } {
  const t = s.trim().replace(/,/g, "");
  if (t === "") return { value: null, bad: false };
  const n = Number(t);
  if (!Number.isFinite(n) || n < min || n > max) return { value: null, bad: true };
  return { value: n, bad: false };
}

export interface ProfileParse {
  profile: Profile;
  // Which fields have a value we couldn't use (shown as a hint under the box).
  problems: Partial<Record<keyof ProfileInput, string>>;
}

// Turns what the student typed into a Profile. A blank or unusable answer
// becomes null, which the checker treats as "can't tell" (never a guess).
export function parseProfileInput(input: ProfileInput): ProfileParse {
  const problems: ProfileParse["problems"] = {};
  const age = num(input.age, 0, 120);
  const income = num(input.income, 0, 1e10);
  const marks = num(input.marks, 0, 100);
  const work = num(input.workYears, 0, 80);
  if (age.bad) problems.age = "Enter a number from 0 to 120.";
  if (income.bad) problems.income = "Enter a number of rupees, 0 or more.";
  if (marks.bad) problems.marks = "Enter a percentage from 0 to 100.";
  if (work.bad) problems.workYears = "Enter years from 0 to 80 (for example 1.5).";

  return {
    profile: {
      courseLevel: (COURSE_LEVELS as readonly string[]).includes(input.courseLevel)
        ? (input.courseLevel as CourseLevel)
        : null,
      age: age.value,
      state: (STATES as readonly string[]).includes(input.state) ? input.state : null,
      category: (CATEGORIES as readonly string[]).includes(input.category)
        ? (input.category as Category)
        : null,
      annualIncomeInr: income.value,
      marksPercent: marks.value,
      workExperienceYears: work.value,
      nationality: input.nationality.trim() === "" ? null : input.nationality.trim(),
      gender:
        input.gender === "female" || input.gender === "male" || input.gender === "other"
          ? input.gender
          : null,
      hasDisability: input.disability === "yes" ? true : input.disability === "no" ? false : null,
    },
    problems,
  };
}

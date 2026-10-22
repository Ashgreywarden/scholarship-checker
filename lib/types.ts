import type { Category, CourseLevel } from "./vocab";
import type { Extraction } from "./schema";

// What the student typed. null = skipped ("not sure"), which makes related
// rules "can't tell" instead of guessing.
export interface Profile {
  courseLevel: CourseLevel | null;
  age: number | null;
  state: string | null;
  category: Category | null;
  annualIncomeInr: number | null;
  marksPercent: number | null;
  workExperienceYears: number | null;
  nationality: string | null;
  // Extra answers used only by "Find my scholarships" (many schemes are for
  // girls, or for students with a disability). null = skipped.
  gender: "female" | "male" | "other" | null;
  hasDisability: boolean | null;
  // What the student studies, as chosen in the profile ("Science", "Law" ...).
  // Optional so older callers keep working; missing means skipped.
  courseType?: string | null;
  // Current year of the course (1 = first year); null / missing = skipped.
  yearOfStudy?: number | null;
  // Ids from the optional "Anything else that applies?" step (lib/match/groups.ts).
  specialGroups?: string[];
}

export type RowStatus = "pass" | "fail" | "unknown";

export type Verdict =
  | "eligible"
  | "not_eligible"
  | "passes_checkable"
  | "cant_tell";

export type Criterion = Extraction["criteria"][number];

// One line of the on-screen criteria table.
export interface EvaluatedRow {
  criterion: Criterion;
  // false = the quote is NOT in the pasted text. Such rows are flagged and
  // never counted toward the verdict.
  quoteVerified: boolean;
  status: RowStatus;
  // Only for status "unknown":
  //   "manual"  = the student must decide (judgement rule, or a rule about
  //               something outside the 8 profile fields)
  //   "missing" = we could have checked it but lack data (skipped field,
  //               unrecognised unit or value)
  unknownKind?: "manual" | "missing";
  // Plain-language explanation shown to the student.
  explanation: string;
}

export interface VerdictResult {
  verdict: Verdict;
  headline: string;
  subtitle: string;
  failedCount: number;
  judgementCount: number;
}

export interface DocumentRow {
  name: string;
  quote: string;
  quoteVerified: boolean;
}

export interface DeadlineRow {
  label: string;
  // The date we show: always read by plain code from the quoted line, never
  // taken on trust from the AI. null when the quote has no complete date.
  dateIso: string | null;
  // What the AI said the date was (shown only when it disagrees with the quote).
  aiDateIso: string | null;
  // Plain-language note when the AI's date and the quote disagree or are unclear.
  dateNote: string | null;
  quote: string;
  quoteVerified: boolean;
  // e.g. "12 days left", "Closed 3 days ago", "Date unclear"
  status: string;
  closed: boolean;
}

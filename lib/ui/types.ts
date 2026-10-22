// Types for the presentation layer (the ScholarPath UI). They are kept apart
// from lib/types.ts, which belongs to the matching engine and the notice checker.
// lib/ui/adapters.ts is the ONLY place that turns engine data into these types.

export type Verdict = "eligible" | "not_eligible" | "cant_tell" | "passes_checkable";
// "passes_checkable" is used only for pasted notices: nothing fails and the rest
// needs the student's own judgement. It is never used for data-bank schemes.

export type DeadlineStatus = "open" | "closing_soon" | "closed" | "stale_cycle" | "unknown";
export type RuleResult = "pass" | "fail" | "unknown";

// The design had government / state / corporate / trust. The data bank also has
// foundations, foreign governments and institutes, so labels were added for them.
export type ProviderType =
  | "government"
  | "state"
  | "foundation"
  | "corporate"
  | "trust"
  | "foreign_government"
  | "institute"
  | "notice";

export type Level = "UG" | "PG";

export interface Rule {
  label: string;
  result: RuleResult;
  quote: string; // official quote; "" when the row comes from a data-bank tag
  explanation?: string; // plain-language comparison with the student's answers
  // Shown in the amber "Why can't we tell?" box for unknown rules.
  question?: string;
  // The quote was not found in the pasted text, so the rule is not counted.
  flagged?: boolean;
  // A note to read, not a rule that counts toward the verdict ("Also check").
  note?: boolean;
  // Where a row without a quote comes from, e.g. "Level tag in the data bank".
  sourceNote?: string | null;
}

export interface UiDocument {
  name: string;
  quote: string | null;
  verified: boolean; // quote found in the source text
}

export interface DeadlineLine {
  label: string;
  date: string | null; // YYYY-MM-DD
  status: DeadlineStatus;
  text: string;
  quote: string | null;
  note?: string | null;
  flagged?: boolean;
}

export interface Scheme {
  id: string;
  name: string;
  provider: string;
  provider_type: ProviderType;
  amount: {
    text: string;
    quote?: string | null;
    annual_value?: number;
  };
  deadline: {
    date: string | null;
    status: DeadlineStatus;
    text: string; // shown when there is no date
  };
  deadlines?: DeadlineLine[]; // every date found, with its quote
  verdict: Verdict;
  // The sentence saying why, plus the quote of the rule that decided it.
  summary: { text: string; quote: string | null; sourceNote?: string | null };
  rules: Rule[];
  documents: UiDocument[];
  apply_url: string | null;
  source_url: string | null;
  levels: Level[];
  states: string[]; // ["All India"] for nationwide schemes
}

// The questions the platform asks. Each one decides eligibility for at least one
// scheme in the data bank. Gender, disability and the optional groups are
// sensitive: they are optional, and they are never sent to the AI.
export interface StudentProfile {
  state: string;
  category: "" | "General" | "OBC" | "SC" | "ST" | "EWS" | "Not sure";
  annualIncome: string;
  level: "" | Level;
  year: string;
  courseType: string;
  // Optional; blank = skipped, "Prefer not to say" = skipped on purpose.
  marksPercent: string;
  gender: string;
  age: string;
  disability: "" | "yes" | "no" | "prefer_not";
  // Optional ticks from "Anything else that applies?" (ids in lib/match/groups.ts).
  specialGroups: string[];
}

export type AsyncState = "idle" | "loading" | "success" | "error";

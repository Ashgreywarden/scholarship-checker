// The ONLY place that translates between the engine and the UI.
//
//   databank scheme + match result  ->  UI Scheme           (toUiScheme)
//   UI profile form                 ->  engine Profile       (profileFromUi)
//   pasted-notice analysis          ->  UI Scheme            (noticeToUiScheme)
//
// Nothing here decides eligibility. It only renames, orders and labels what the
// engine already computed.

import type { Analysis } from "../analyze";
import type { Scheme as DatabankScheme } from "../databank/types";
import { matchScheme, type MatchRow, type SchemeMatch } from "../match/engine";
import { computeStatus, type StatusResult } from "../match/status";
import type { EvaluatedRow, Profile } from "../types";
import { FIELD_LABELS } from "../vocab";
import type {
  DeadlineLine,
  DeadlineStatus,
  Level,
  ProviderType,
  Rule,
  Scheme,
  StudentProfile,
} from "./types";

// "Closing soon" = open with this many days or fewer left. Computed in code.
export const CLOSING_SOON_DAYS = 14;

// --- providers --------------------------------------------------------------

const PROVIDER_MAP: Record<string, ProviderType> = {
  central: "government",
  state: "state",
  foundation: "foundation",
  corporate: "corporate",
  trust: "trust",
  foreign_government: "foreign_government",
  institute: "institute",
};

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  government: "Central government",
  state: "State government",
  foundation: "Foundation",
  corporate: "Corporate",
  trust: "Trust",
  foreign_government: "Foreign government",
  institute: "Institute",
  notice: "Pasted notice",
};

export function toUiProvider(providerType: string): ProviderType {
  return PROVIDER_MAP[providerType] ?? "trust";
}

// --- deadline status --------------------------------------------------------

export function toUiStatus(s: StatusResult): DeadlineStatus {
  switch (s.status) {
    case "open":
      return s.basis === "date" && s.daysLeft !== null && s.daysLeft <= CLOSING_SOON_DAYS
        ? "closing_soon"
        : "open";
    case "closed":
      return "closed";
    case "stale":
      return "stale_cycle";
    default:
      return "unknown";
  }
}

// --- data-bank schemes ------------------------------------------------------

function levelsOf(s: DatabankScheme): Level[] {
  const out = new Set<Level>();
  for (const l of s.level) {
    if (l === "UG" || l === "any") out.add("UG");
    if (l === "PG" || l === "any") out.add("PG");
  }
  return [...out];
}

function ruleFromMatchRow(r: MatchRow): Rule {
  return {
    label: r.label,
    result: r.status,
    quote: r.quote ?? "",
    explanation: r.explanation,
    question: r.checkable && r.status === "unknown" ? r.explanation : undefined,
    note: !r.checkable,
    sourceNote: r.sourceNote,
  };
}

export function toUiScheme(match: SchemeMatch): Scheme {
  const { scheme: s, status } = match;
  const uiStatus = toUiStatus(status);
  const amountQuote = s.amount.quote.trim() || null;
  const deadlineQuote = s.deadline.quote.trim() || null;
  const sourceUrl = s.sources.find((x) => /^https?:\/\//i.test(x.url))?.url ?? null;

  return {
    id: s.id,
    name: s.name,
    provider: s.provider,
    provider_type: toUiProvider(s.provider_type),
    amount: { text: s.amount.text || "Not stated", quote: amountQuote },
    deadline: {
      date: s.deadline.date,
      status: uiStatus,
      text: s.deadline.text || status.label,
    },
    deadlines: [
      {
        label: "Closing date",
        date: s.deadline.date,
        status: uiStatus,
        text: `${status.label}${s.deadline.text ? `. ${s.deadline.text}` : ""}`,
        quote: deadlineQuote,
      },
    ],
    verdict: match.verdict,
    summary: {
      text: match.reason,
      quote: match.deciding?.quote ?? null,
      sourceNote: match.deciding?.sourceNote ?? null,
    },
    rules: match.rows.map(ruleFromMatchRow),
    documents: s.documents.map((d) => ({
      name: d.name,
      quote: d.quote.trim() || null,
      verified: true, // the data bank checks every quote against the official text
    })),
    apply_url: s.apply_url || null,
    source_url: sourceUrl,
    levels: levelsOf(s),
    states: [s.state ?? "All India"],
  };
}

// Coverage counts the whole data bank, not one student's matches, so it uses a
// match against an empty profile only to get the status and the other fields.
const NO_ANSWERS: Profile = {
  courseLevel: null, age: null, state: null, category: null, annualIncomeInr: null,
  marksPercent: null, workExperienceYears: null, nationality: null, gender: null,
  hasDisability: null,
};

export function toUiSchemeForCoverage(s: DatabankScheme, today: Date): Scheme {
  return toUiScheme(matchScheme(s, NO_ANSWERS, today));
}

// --- the profile form -> the engine's profile --------------------------------

function num(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function profileFromUi(p: StudentProfile): Profile {
  const gender =
    p.gender === "Woman" ? "female"
    : p.gender === "Man" ? "male"
    : p.gender === "Transgender" || p.gender === "Another identity" ? "other"
    : null;

  return {
    courseLevel: p.level === "UG" ? "undergraduate" : p.level === "PG" ? "postgraduate" : null,
    age: num(p.age),
    state: p.state || null,
    category:
      p.category && p.category !== "Not sure"
        ? (p.category.toLowerCase() as Profile["category"])
        : null,
    annualIncomeInr: num(p.annualIncome),
    marksPercent: num(p.marksPercent),
    // Work experience is not a profile question (no domestic scheme needs it).
    // The notice checker asks for it when you paste a notice.
    workExperienceYears: null,
    // ScholarPath is for students in India; the form does not ask.
    nationality: "Indian",
    gender,
    hasDisability: p.disability === "yes" ? true : p.disability === "no" ? false : null,
    courseType: p.courseType || null,
    yearOfStudy: yearNumber(p.year),
    specialGroups: p.specialGroups,
  };
}

// "1" -> 1, "4 or later" -> 4, "" -> null.
function yearNumber(year: string): number | null {
  const m = /^\s*(\d)/.exec(year);
  return m ? Number(m[1]) : null;
}

// --- a pasted notice -> a UI scheme -----------------------------------------

function rank(r: EvaluatedRow): number {
  if (!r.quoteVerified) return 5;
  if (r.status === "fail") return 0;
  if (r.status === "pass") return 1;
  return r.unknownKind === "manual" ? 4 : 3;
}

function ruleFromNoticeRow(r: EvaluatedRow): Rule {
  const c = r.criterion;
  const generic = c.field === "none" || c.operator === "judgement";
  const flagged = !r.quoteVerified;
  return {
    label: generic ? "Check this yourself" : FIELD_LABELS[c.field],
    result: flagged ? "unknown" : r.status,
    quote: c.quote,
    explanation: flagged
      ? "The AI's quote was not found in your pasted text, so this rule is not counted."
      : r.explanation,
    question: !flagged && r.status === "unknown" && r.unknownKind === "missing" ? r.explanation : undefined,
    flagged,
    note: false,
  };
}

export function noticeToUiScheme(
  analysis: Analysis,
  scholarshipName: string | null,
  today: Date,
): Scheme {
  const rows = [...analysis.rows].sort((a, b) => rank(a) - rank(b));
  const failed = analysis.rows.find((r) => r.quoteVerified && r.status === "fail");

  const lines: DeadlineLine[] = analysis.deadlines.map((d) => {
    const sr = computeStatus(
      { date: d.quoteVerified ? d.dateIso : null, text: "", quote: "", status: "unknown" },
      today,
    );
    return {
      label: d.label,
      date: d.quoteVerified ? d.dateIso : null,
      status: d.quoteVerified ? toUiStatus(sr) : "unknown",
      text: d.status,
      quote: d.quote,
      note: d.dateNote,
      flagged: !d.quoteVerified,
    };
  });

  // The headline date: the soonest date still ahead, else the first one with a date.
  const dated = lines.filter((l) => l.date && !l.flagged);
  const upcoming = dated
    .filter((l) => l.status === "open" || l.status === "closing_soon")
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const primary = upcoming[0] ?? dated[0] ?? null;

  return {
    id: "pasted-notice",
    name: scholarshipName?.trim() || "The notice you pasted",
    provider: "From the text you pasted",
    provider_type: "notice",
    amount: { text: "Not read from a pasted notice" },
    deadline: primary
      ? { date: primary.date, status: primary.status, text: primary.text }
      : { date: null, status: "unknown", text: "No deadline found in the text you pasted" },
    deadlines: lines,
    verdict: analysis.verdict.verdict,
    summary: {
      text: `${analysis.verdict.headline}. ${analysis.verdict.subtitle}`,
      quote: failed?.criterion.quote ?? null,
    },
    rules: rows.map(ruleFromNoticeRow),
    documents: analysis.documents.map((d) => ({
      name: d.name,
      quote: d.quote,
      verified: d.quoteVerified,
    })),
    apply_url: null,
    source_url: null,
    levels: [],
    states: [],
  };
}

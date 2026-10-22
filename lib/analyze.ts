import type { Extraction } from "./schema";
import type {
  DeadlineRow,
  DocumentRow,
  EvaluatedRow,
  Profile,
  VerdictResult,
} from "./types";
import { evaluateCriterion } from "./evaluate";
import { datesInText, daysUntil, parseIsoDate } from "./normalize";
import { quoteAppearsIn } from "./verifyQuote";
import { computeVerdict } from "./verdict";

export interface Analysis {
  rows: EvaluatedRow[];
  verdict: VerdictResult;
  documents: DocumentRow[];
  deadlines: DeadlineRow[];
}

function countdown(dateIso: string, today: Date): Pick<DeadlineRow, "status" | "closed"> {
  const d = parseIsoDate(dateIso);
  if (!d) return { status: "Date unclear: check the notice", closed: false };
  const days = daysUntil(d, today);
  if (days < 0) return { status: `Closed ${-days} day${days === -1 ? "" : "s"} ago`, closed: true };
  if (days === 0) return { status: "Closes today", closed: false };
  return { status: `${days} day${days === 1 ? "" : "s"} left`, closed: false };
}

// The AI gives a date AND a quote. They can disagree (for example a wrong
// year), so the date we show is read by plain code from the quote itself:
//  - quote has exactly one complete date -> use it (note if the AI differed)
//  - quote has several dates -> the AI's date must be one of them
//  - quote has no complete date (no year, or "October 2026" only) -> not confirmed
function describeDeadline(
  aiDateIso: string | null,
  quote: string,
  today: Date,
): Pick<DeadlineRow, "dateIso" | "aiDateIso" | "dateNote" | "status" | "closed"> {
  const quoteDates = datesInText(quote);
  const ai = parseIsoDate(aiDateIso) ? aiDateIso : null;

  const unclear = (note: string) => ({
    dateIso: null,
    aiDateIso: ai,
    dateNote: note,
    status: "Date not confirmed: check the notice",
    closed: false,
  });

  if (quoteDates.length === 0) {
    return unclear(
      ai
        ? `The AI read this as ${ai}, but the quoted line has no complete date (day, month and year), so we don't show it as a deadline.`
        : "The quoted line has no complete date (day, month and year).",
    );
  }
  if (quoteDates.length === 1) {
    const date = quoteDates[0];
    const differs = ai !== null && ai !== date;
    return {
      dateIso: date,
      aiDateIso: differs ? ai : null,
      dateNote: differs
        ? `The AI said ${ai}, but the quoted line says ${date}. We use the date in the quote.`
        : null,
      ...countdown(date, today),
    };
  }
  if (ai !== null && quoteDates.includes(ai)) {
    return { dateIso: ai, aiDateIso: null, dateNote: null, ...countdown(ai, today) };
  }
  return unclear(
    `The quoted line has several dates (${quoteDates.join(", ")}) and the AI's date${ai ? ` (${ai})` : ""} is not one of them.`,
  );
}

// Everything after the AI call is plain code: check quotes, compare, decide.
export function analyze(
  extraction: Extraction,
  pastedText: string,
  profile: Profile,
  today: Date = new Date(),
): Analysis {
  const rows: EvaluatedRow[] = extraction.criteria.map((criterion) => {
    const quoteVerified = quoteAppearsIn(criterion.quote, pastedText);
    if (!quoteVerified) {
      return {
        criterion,
        quoteVerified,
        status: "unknown",
        unknownKind: "missing",
        explanation:
          "The AI's quote was not found in your pasted text, so this rule is not counted.",
      };
    }
    return { criterion, quoteVerified, ...evaluateCriterion(criterion, profile) };
  });

  const documents: DocumentRow[] = extraction.documents.map((d) => ({
    ...d,
    quoteVerified: quoteAppearsIn(d.quote, pastedText),
  }));

  const deadlines: DeadlineRow[] = extraction.deadlines.map((d) => {
    const quoteVerified = quoteAppearsIn(d.quote, pastedText);
    return {
      label: d.label,
      quote: d.quote,
      quoteVerified,
      ...(quoteVerified
        ? describeDeadline(d.date_iso, d.quote, today)
        : {
            dateIso: null,
            aiDateIso: null,
            dateNote: null,
            status: "Not verified",
            closed: false,
          }),
    };
  });

  return { rows, verdict: computeVerdict(rows), documents, deadlines };
}

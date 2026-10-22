import type { Extraction } from "./schema";
import type {
  DeadlineRow,
  DocumentRow,
  EvaluatedRow,
  Profile,
  VerdictResult,
} from "./types";
import { evaluateCriterion } from "./evaluate";
import { daysUntil, parseIsoDate } from "./normalize";
import { quoteAppearsIn } from "./verifyQuote";
import { computeVerdict } from "./verdict";

export interface Analysis {
  rows: EvaluatedRow[];
  verdict: VerdictResult;
  documents: DocumentRow[];
  deadlines: DeadlineRow[];
}

function describeDeadline(dateIso: string | null, today: Date): Pick<DeadlineRow, "status" | "closed"> {
  const d = parseIsoDate(dateIso);
  if (!d) return { status: "Date unclear: check the notice", closed: false };
  const days = daysUntil(d, today);
  if (days < 0) return { status: `Closed ${-days} day${days === -1 ? "" : "s"} ago`, closed: true };
  if (days === 0) return { status: "Closes today", closed: false };
  return { status: `${days} day${days === 1 ? "" : "s"} left`, closed: false };
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
      dateIso: d.date_iso,
      quote: d.quote,
      quoteVerified,
      ...(quoteVerified
        ? describeDeadline(d.date_iso, today)
        : { status: "Not verified", closed: false }),
    };
  });

  return { rows, verdict: computeVerdict(rows), documents, deadlines };
}

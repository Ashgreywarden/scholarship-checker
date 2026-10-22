import type { EvaluatedRow, VerdictResult } from "./types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Combines the rows into one overall answer.
// Rows whose quote was NOT found in the pasted text are ignored here.
export function computeVerdict(rows: EvaluatedRow[]): VerdictResult {
  const counted = rows.filter((r) => r.quoteVerified);
  const flagged = rows.length - counted.length;
  const failed = counted.filter((r) => r.status === "fail");
  const manual = counted.filter(
    (r) => r.status === "unknown" && r.unknownKind === "manual",
  );
  const missing = counted.filter(
    (r) => r.status === "unknown" && r.unknownKind !== "manual",
  );
  const flaggedNote =
    flagged > 0
      ? ` ${plural(flagged, "rule")} ignored because the quote wasn't found in your text.`
      : "";

  const base = {
    failedCount: failed.length,
    judgementCount: manual.length,
  };

  if (failed.length > 0) {
    return {
      ...base,
      verdict: "not_eligible",
      headline: "Not eligible",
      subtitle: `You fail ${plural(failed.length, "rule")}.${flaggedNote}`,
    };
  }
  if (counted.length === 0) {
    return {
      ...base,
      verdict: "cant_tell",
      headline: "Can't tell",
      subtitle: `No rule could be confirmed against your text.${flaggedNote}`,
    };
  }
  if (missing.length > 0) {
    return {
      ...base,
      verdict: "cant_tell",
      headline: "Can't tell",
      subtitle: `${plural(missing.length, "rule")} couldn't be checked (skipped answers or unclear units).${
        manual.length > 0 ? ` ${plural(manual.length, "more rule")} need your own judgement.` : ""
      }${flaggedNote}`,
    };
  }
  if (manual.length > 0) {
    return {
      ...base,
      verdict: "passes_checkable",
      headline: "Passes all checkable rules",
      subtitle: `${plural(manual.length, "rule")} need your own judgement.${flaggedNote}`,
    };
  }
  return {
    ...base,
    verdict: "eligible",
    headline: "Eligible",
    subtitle: `You pass all ${plural(counted.length, "rule")}.${flaggedNote}`,
  };
}

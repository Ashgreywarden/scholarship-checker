// Checks that a quote the AI gave us really appears in the text the student
// pasted. Both sides are tidied the same way first, so harmless differences
// (curly vs straight quotes, extra spaces, line breaks, capital letters)
// don't cause false alarms. The words themselves must match exactly.

const MIN_QUOTE_CHARS = 8;

export function normalizeForMatch(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function quoteAppearsIn(quote: string, pastedText: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return normalizeForMatch(pastedText).includes(q);
}

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

const COLUMN_WORD = /^(yes|no|n\/a|na|fresh|renewal)$/i;

// For DISPLAY only (checking always uses the full quote). Quotes copied from a
// pasted PDF table can start with a row number or end with column words like
// "Yes Yes". This trims those from the two ends only, so what is left is still
// an exact piece of the text, and adds "…" when it cut off the end.
export function tidyQuoteForDisplay(quote: string): string {
  const original = quote.replace(/\s+/g, " ").trim();
  let s = original.replace(/^\d{1,2}[.)]?\s+(?=\D)/, "");
  const words = s.split(" ");
  let trimmedEnd = false;
  while (words.length > 1 && COLUMN_WORD.test(words[words.length - 1])) {
    words.pop();
    trimmedEnd = true;
  }
  s = words.join(" ") + (trimmedEnd ? " …" : "");
  return s.length >= MIN_QUOTE_CHARS ? s : original;
}

export function quoteAppearsIn(quote: string, pastedText: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return normalizeForMatch(pastedText).includes(q);
}

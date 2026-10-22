// Checks run in the browser (and again on the server) BEFORE any AI call.

export const MIN_NOTICE_CHARS = 80;
export const MAX_NOTICE_CHARS = 30000;

export function checkNoticeText(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "Please paste the text of a scholarship notice first.";
  }
  if (trimmed.length < MIN_NOTICE_CHARS) {
    return "That text is too short to be a scholarship notice. Paste the full eligibility section.";
  }
  if (trimmed.length > MAX_NOTICE_CHARS) {
    return `That text is too long (${trimmed.length.toLocaleString("en-IN")} characters; the limit is ${MAX_NOTICE_CHARS.toLocaleString("en-IN")}). Please paste only the eligibility section, not the whole page.`;
  }
  return null;
}

import { daysUntil, parseIsoDate } from "../normalize";
import type { Scheme } from "../databank/types";

export type SchemeStatus = "open" | "closed" | "stale" | "unknown";

export interface StatusResult {
  status: SchemeStatus;
  // "date"             computed from the closing date and today's date
  // "source_statement" the closing date is not published, so we repeat what
  //                    the source says ("applications are open / closed")
  // "none"             nothing to go on
  basis: "date" | "source_statement" | "none";
  daysLeft: number | null; // days until the closing date (negative = passed)
  label: string; // e.g. "Open · closes in 9 days"
}

// A closing date more than this long ago belongs to an older cycle: the scheme
// probably reopens with new dates, so we call it "stale" rather than "closed".
export const STALE_AFTER_DAYS = 365;

// Computes open / closed / stale in code from the deadline and today's date.
// The "status" word written inside the data files is only used when a scheme
// has no closing date at all.
export function computeStatus(deadline: Scheme["deadline"], today: Date): StatusResult {
  const date = parseIsoDate(deadline.date);

  if (date) {
    const days = daysUntil(date, today);
    if (days >= 0) {
      return {
        status: "open",
        basis: "date",
        daysLeft: days,
        label:
          days === 0 ? "Open · closes today" : `Open · closes in ${days} day${days === 1 ? "" : "s"}`,
      };
    }
    const ago = -days;
    if (ago <= STALE_AFTER_DAYS) {
      return {
        status: "closed",
        basis: "date",
        daysLeft: days,
        label: `Closed ${ago} day${ago === 1 ? "" : "s"} ago`,
      };
    }
    return {
      status: "stale",
      basis: "date",
      daysLeft: days,
      label: "Stale · the date is from an older cycle, check the portal",
    };
  }

  switch (deadline.status) {
    case "open":
      return {
        status: "open",
        basis: "source_statement",
        daysLeft: null,
        label: "Open · no closing date published",
      };
    case "closed":
      return {
        status: "closed",
        basis: "source_statement",
        daysLeft: null,
        label: "Closed · as stated by the source",
      };
    case "stale_cycle":
      return {
        status: "stale",
        basis: "source_statement",
        daysLeft: null,
        label: "Stale · older cycle, check the portal",
      };
    default:
      return {
        status: "unknown",
        basis: "none",
        daysLeft: null,
        label: "No closing date published",
      };
  }
}

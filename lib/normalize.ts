import type { Criterion } from "./types";
import type { Field } from "./vocab";
import { HOURS_PER_YEAR } from "./vocab";

export function parseNumber(s: string): number | null {
  const cleaned = s.replace(/[₹,\s]|rs\.?|inr/gi, "");
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

export interface Canonical {
  nums: number[];
  // Extra explanation when we converted units, e.g. hours -> years.
  note?: string;
}

// Converts a rule's numbers into the same unit as the student's profile:
// income in rupees, marks in percent, age and work experience in years.
// Returns null when the unit isn't one we can safely convert, so the row
// becomes "can't tell" instead of a wrong pass/fail.
export function toCanonical(field: Field, c: Criterion): Canonical | null {
  const raw = c.values.map(parseNumber);
  if (raw.length === 0 || raw.some((n) => n === null)) return null;
  const nums = raw as number[];

  switch (field) {
    case "annual_income":
      if (c.unit === "inr") return { nums };
      if (c.unit === "lakh_inr") return { nums: nums.map((n) => n * 100000) };
      if (c.unit === "crore_inr") return { nums: nums.map((n) => n * 10000000) };
      return null; // foreign currency or unknown unit
    case "marks_percent":
      return c.unit === "percent" ? { nums } : null;
    case "age":
      if (c.unit === "years" || c.unit === "none") return { nums };
      if (c.unit === "months") return { nums: nums.map((n) => n / 12) };
      return null;
    case "work_experience":
      if (c.unit === "years") return { nums };
      if (c.unit === "months") return { nums: nums.map((n) => n / 12) };
      if (c.unit === "hours") {
        return {
          nums: nums.map((n) => n / HOURS_PER_YEAR),
          note: `The notice counts hours; we treat ${formatNumber(HOURS_PER_YEAR)} hours as one year of full-time work.`,
        };
      }
      return null;
    default:
      return null;
  }
}

export function normalizeWord(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

// "India", "Indian", "citizen of India" all become "indian".
export function normalizeNationality(s: string): string {
  const w = normalizeWord(s)
    .replace(/^(a |an )?(citizen|national)s? of /, "")
    .replace(/^the /, "");
  if (w === "india" || w === "indian") return "indian";
  return w;
}

const MONTHS: Record<string, number> = {
  january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4,
  may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8,
  september: 9, sept: 9, sep: 9, october: 10, oct: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};
const MONTH_RE = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

function toIso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

// Finds every COMPLETE date (day, month and a 4-digit year) written in a piece
// of text and returns them as YYYY-MM-DD. A date without a year, like
// "7 October", is not returned: we never guess the year. Numeric dates are read
// day-first (7/10/2027 = 7 October 2027), as is usual in India and the UK.
export function datesInText(text: string): string[] {
  const t = text.normalize("NFKC");
  const found = new Set<string>();
  const add = (iso: string | null) => iso && found.add(iso);

  // 7 October 2027, 7th Oct 2027, 7 Oct, 2027
  for (const m of t.matchAll(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})\\.?,?\\s+(\\d{4})\\b`, "gi"),
  )) {
    add(toIso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]));
  }
  // October 7, 2027 / Oct 7th 2027
  for (const m of t.matchAll(
    new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"),
  )) {
    add(toIso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]));
  }
  // 2027-10-07
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    add(toIso(+m[1], +m[2], +m[3]));
  }
  // 07/10/2027, 7-10-2027, 07.10.2027 (day first)
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)) {
    add(toIso(+m[3], +m[2], +m[1]));
  }
  return [...found].sort();
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(s: string | null): Date | null {
  if (!s) return null;
  const m = ISO_DATE.exec(s.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  // Reject things like 2025-02-31 that JS silently rolls over.
  if (
    d.getUTCFullYear() !== +m[1] ||
    d.getUTCMonth() !== +m[2] - 1 ||
    d.getUTCDate() !== +m[3]
  ) {
    return null;
  }
  return d;
}

// Whole days from `today` to the deadline (negative = already passed).
export function daysUntil(deadline: Date, today: Date): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((deadline.getTime() - t) / 86400000);
}

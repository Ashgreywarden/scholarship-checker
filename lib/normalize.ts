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

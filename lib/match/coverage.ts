import type { Scheme } from "../databank/types";
import { computeStatus, type SchemeStatus } from "./status";

export interface CountRow {
  key: string;
  count: number;
}

export interface Coverage {
  total: number;
  byProviderType: CountRow[];
  byState: CountRow[]; // "All India" for schemes with no state
  byLevel: { ug: number; pg: number; both: number; other: number };
  byStatus: Record<SchemeStatus, number>;
  rulesWithQuote: number;
  rulesTotal: number;
  documentsListed: number;
  withApplyLink: number;
  latestVerified: string | null;
}

function tally(keys: string[]): CountRow[] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export const PROVIDER_TYPE_LABELS: Record<string, string> = {
  central: "Central government",
  state: "State government",
  foundation: "Foundation",
  corporate: "Corporate",
  trust: "Trust",
  institute: "Institute",
  foreign_government: "Foreign government",
};

export function computeCoverage(schemes: Scheme[], today: Date): Coverage {
  const byStatus: Record<SchemeStatus, number> = { open: 0, closed: 0, stale: 0, unknown: 0 };
  for (const s of schemes) byStatus[computeStatus(s.deadline, today).status]++;

  let ug = 0, pg = 0, both = 0, other = 0;
  for (const s of schemes) {
    const isUg = s.level.includes("UG") || s.level.includes("any");
    const isPg = s.level.includes("PG") || s.level.includes("any");
    if (isUg && isPg) both++;
    else if (isUg) ug++;
    else if (isPg) pg++;
    else other++;
  }

  const rules = schemes.flatMap((s) => s.rules);
  const verified = schemes.map((s) => s.verified_on).filter((v): v is string => !!v).sort();

  return {
    total: schemes.length,
    byProviderType: tally(schemes.map((s) => s.provider_type)),
    byState: tally(schemes.map((s) => s.state ?? "All India")),
    byLevel: { ug, pg, both, other },
    byStatus,
    rulesTotal: rules.length,
    rulesWithQuote: rules.filter((r) => r.quote.trim() !== "").length,
    documentsListed: schemes.reduce((n, s) => n + s.documents.length, 0),
    withApplyLink: schemes.filter((s) => /^https?:\/\//i.test(s.apply_url)).length,
    latestVerified: verified.at(-1) ?? null,
  };
}

// Level counts as the pitch slide wants them: how many schemes accept UG
// students and how many accept PG students (a scheme can accept both).
export function levelTotals(c: Coverage): { ug: number; pg: number } {
  return { ug: c.byLevel.ug + c.byLevel.both, pg: c.byLevel.pg + c.byLevel.both };
}

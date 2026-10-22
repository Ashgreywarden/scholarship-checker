import { z } from "zod";

// The shape of one databank/schemes/*.json file. It follows
// databank/export/SCHEMA.json, but the real files are looser than the schema
// (extra fields such as "condition", rule values that are numbers, lists,
// strings or null, target groups like "low_income"), so this is deliberately
// lenient: a file only fails to load if its basic structure is broken.
//
// Rule values are kept as `unknown` and are only interpreted by the matcher,
// which says "Can't tell" for anything it does not understand.

const RuleSchema = z.object({
  field: z.string(),
  op: z.string(),
  value: z.unknown(),
  quote: z.string().default(""),
  quote_verified: z.boolean().optional(),
  // Present on 22 rules: the rule only applies in a sub-case, e.g. "SC/ST/PwD".
  condition: z.string().optional(),
});

const DeadlineSchema = z.object({
  date: z.string().nullable().default(null),
  text: z.string().default(""),
  quote: z.string().default(""),
  status: z.string().default("unknown"), // as written in the file; recomputed in code
});

export const SchemeSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  provider_type: z.string(),
  region: z.string(), // "india" | "abroad"
  state: z.string().nullable().default(null),
  level: z.array(z.string()).default([]),
  target_group: z.array(z.string()).default([]),
  sources: z
    .array(z.object({ url: z.string(), fetched_at: z.string().optional() }).passthrough())
    .default([]),
  cycle_named: z.string().nullable().default(null),
  rules: z.array(RuleSchema).default([]),
  amount: z
    .object({ text: z.string().default(""), quote: z.string().default("") })
    .passthrough(),
  documents: z
    .array(z.object({ name: z.string(), quote: z.string().default("") }))
    .default([]),
  deadline: DeadlineSchema,
  apply_url: z.string().default(""),
  confidence: z.string().default(""),
  review_flags: z.array(z.string()).default([]),
  verified_on: z.string().optional(),
});

export type Scheme = z.infer<typeof SchemeSchema>;
export type Rule = Scheme["rules"][number];

export interface LoadProblem {
  file: string;
  message: string;
}

// What /api/schemes returns.
export interface SchemesPayload {
  schemes: Scheme[];
  problems: LoadProblem[];
  // Counts before the domestic filter, for the coverage page.
  totals: { all: number; domestic: number; hiddenAbroad: number };
  register: NspRegisterSummary | null;
}

export interface NspRegisterSummary {
  rows: number;
  renewalOnly: number;
  closingDates: { date: string; count: number }[]; // YYYY-MM-DD
  fetched: string | null;
  source: string | null;
}

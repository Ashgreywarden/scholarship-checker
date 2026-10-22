import { z } from "zod";

// What the browser sends: the profile form's answers (all text). Nothing here
// is a name, phone number or ID; every field is a short choice or number. Our
// server needs all of them to run the rule checker. Only the non-sensitive ones
// are ever passed on to the AI (see payload.ts).
const short = z.string().max(120);

export const RankRequestSchema = z.object({
  profile: z.object({
    state: short,
    category: z.enum(["", "General", "OBC", "SC", "ST", "EWS", "Not sure"]),
    annualIncome: short,
    level: z.enum(["", "UG", "PG"]),
    year: short,
    courseType: short,
    marksPercent: short,
    gender: short,
    age: short,
    disability: z.enum(["", "yes", "no", "prefer_not"]),
    specialGroups: z.array(z.string().max(40)).max(12).default([]),
  }),
});
// What Gemini must return (checked again in code).
export const RankedSchema = z.object({
  ranked: z.array(
    z.object({
      scheme_id: z.string(),
      why_it_fits: z.string(),
      to_confirm: z.string(),
    }),
  ),
});

// The JSON schema sent to Gemini (structured output).
export const RANKED_JSON_SCHEMA = {
  type: "object",
  properties: {
    ranked: {
      type: "array",
      items: {
        type: "object",
        properties: {
          scheme_id: { type: "string" },
          why_it_fits: { type: "string" },
          to_confirm: { type: "string" },
        },
        required: ["scheme_id", "why_it_fits", "to_confirm"],
        additionalProperties: false,
      },
    },
  },
  required: ["ranked"],
  additionalProperties: false,
} as const;

export interface RankItem {
  scheme_id: string;
  why_it_fits: string;
  to_confirm: string;
}

export interface RankResponse {
  // "ai" = Gemini ranked it; "fallback" = our code ranked it.
  source: "ai" | "fallback";
  ranked: RankItem[];
  note: string | null;
}

export const FALLBACK_NOTE = "Showing results ranked by deadline and fit";
export const MAX_BEST = 8;
export const MAX_WHY_WORDS = 25;
export const MAX_CONFIRM_WORDS = 15;
export const AI_DEADLINE_MS = 15_000;

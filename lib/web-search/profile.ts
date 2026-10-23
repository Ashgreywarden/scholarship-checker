// Browser-safe. Which profile answers the live web search may use.
// Only these are sent to the AI. Gender, disability and the optional
// "Anything else that applies?" groups are never sent (same rule as the
// results ranking; see lib/rank/payload.ts).
export const WEB_PROFILE_KEYS = ["state", "category", "annualIncome", "level", "year", "courseType"] as const;

export type WebProfile = Partial<Record<(typeof WEB_PROFILE_KEYS)[number], string>>;

export function cleanProfile(input: unknown): WebProfile | null {
  if (!input || typeof input !== "object") return null;
  const out: WebProfile = {};
  for (const key of WEB_PROFILE_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v === "string" && v.trim() && v.trim() !== "Not sure") out[key] = v.trim().slice(0, 80);
  }
  return out.level || out.courseType || out.state ? out : null;
}

// The browser's saved profile -> the answers the web search may use.
export function toWebSearchProfile(p: object | null | undefined): Record<string, string> | null {
  const clean = cleanProfile(p);
  return clean ? (clean as Record<string, string>) : null;
}

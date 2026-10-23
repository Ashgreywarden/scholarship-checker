// Pure helpers for "Search the web for more scholarships": what we tell the
// model, how we read its answer, and which results we keep. No network here.
import { isAggregator } from "./fetchVerify";
import type { WebProfile } from "./profile";

export { cleanProfile, WEB_PROFILE_KEYS, type WebProfile } from "./profile";

export const MAX_RESULTS = 5;

export type WebResult = {
  name: string;
  provider: string;
  official_url: string;
  host: string;
  quote: string;
  deadline_text: string;
  why: string;
  verification: "verified" | "unverified";
};

export type WebCandidate = Omit<WebResult, "host" | "verification">;

export function describe(p: WebProfile): string {
  const lines = [
    p.state && `State of domicile: ${p.state}`,
    p.category && `Category: ${p.category}`,
    p.annualIncome && `Annual family income (INR): ${p.annualIncome}`,
    p.level && `Study level: ${p.level}${p.year ? `, year ${p.year}` : ""}`,
    p.courseType && `Course / field: ${p.courseType}`,
  ];
  return lines.filter(Boolean).join("\n");
}

export const WEB_SYSTEM_PROMPT =
  "You find scholarships for Indian students who study in India. Use web search. " +
  "Only use official pages: government (gov.in, nic.in), universities and institutes, " +
  "or the scholarship provider's own website. Never use scholarship listing or aggregator " +
  "sites such as Buddy4Study, WeMakeScholars, Shiksha, Careers360 or CollegeDekho. " +
  "Prefer schemes that are open now or open every year. " +
  "Copy the rule quote EXACTLY, character for character, from the official page you cite. " +
  "Do not paraphrase the quote. Do not invent links. If you are not sure, return fewer items. " +
  "The official_url must be the exact page where the quote appears (a deep link to the scheme " +
  "or eligibility page), never just a website's home page. Leave out a scheme if you cannot give that page. " +
  "Search at most 3 times.";

export function buildUserMessage(profile: WebProfile, today: Date): string {
  return (
    `Today is ${today.toISOString().slice(0, 10)}. Find up to ${MAX_RESULTS} scholarships in India that match this student.\n\n` +
    `${describe(profile)}\n\n` +
    "Reply with JSON only, inside a ```json code block, as an array of objects with these keys:\n" +
    '"name", "provider", "official_url" (https link to the official page you read), ' +
    '"quote" (one eligibility sentence copied word for word from that page, 20 to 300 characters), ' +
    '"deadline_text" (as written on the page, or "" if not shown), ' +
    '"why" (max 25 words, to the student, why it may fit).'
  );
}

export function extractJsonArray(text: string): unknown[] | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
  try {
    const parsed = JSON.parse(candidate);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

// Keeps complete items with an https link that is not an aggregator site,
// drops duplicate links, and caps the list.
export function pickCandidates(items: unknown[]): WebCandidate[] {
  const seen = new Set<string>();
  return items
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return {
        name: str(o.name, 140),
        provider: str(o.provider, 140),
        official_url: str(o.official_url, 500),
        quote: str(o.quote, 400),
        deadline_text: str(o.deadline_text, 120),
        why: str(o.why, 220),
      };
    })
    .filter((c) => {
      if (!c.name || !c.official_url || !c.quote) return false;
      let host = "";
      try {
        const u = new URL(c.official_url);
        if (u.protocol !== "https:") return false;
        host = u.hostname;
      } catch {
        return false;
      }
      if (isAggregator(host)) return false;
      const key = c.official_url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

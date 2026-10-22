import type { SchemeMatch } from "../match/engine";
import type { Candidate } from "./payload";
import { canBeBest, clampWords, codeText } from "./fallback";
import {
  MAX_BEST,
  MAX_CONFIRM_WORDS,
  MAX_WHY_WORDS,
  RankedSchema,
  type RankItem,
} from "./types";

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const normalize = (s: string) => s.replace(/,/g, "");

// Every number the AI writes must already appear in the data it was given
// (the student's answers or that scheme's own entry). A number that does not
// appear means the AI made it up.
function numbersAreGrounded(text: string, haystack: string): boolean {
  const base = normalize(haystack);
  for (const token of text.match(NUMBER) ?? []) {
    const n = normalize(token).replace(/\.$/, "");
    if (!base.includes(n)) return false;
  }
  return true;
}

// Turns Gemini's answer into a safe list. The AI can only choose and explain:
//  - an id we did not send is dropped (no added schemes)
//  - duplicates are dropped; closed / old-cycle schemes are dropped
//  - text is cut to the word limits
//  - words with a number that is not in the data are replaced by code wording
//  - verdicts are never read from the AI at all
// Returns null if the answer is not valid at all.
export function validateRanking(
  raw: unknown,
  sent: Candidate[],
  matchesById: Map<string, SchemeMatch>,
  profileJson: string,
): RankItem[] | null {
  const parsed = RankedSchema.safeParse(raw);
  if (!parsed.success) return null;

  const candidates = new Map(sent.map((c) => [c.id, c]));
  const seen = new Set<string>();
  const out: RankItem[] = [];

  for (const item of parsed.data.ranked) {
    const candidate = candidates.get(item.scheme_id);
    const match = matchesById.get(item.scheme_id);
    if (!candidate || !match || seen.has(item.scheme_id)) continue;
    if (!canBeBest(match)) continue;
    seen.add(item.scheme_id);

    let why = clampWords(item.why_it_fits, MAX_WHY_WORDS);
    let confirm = clampWords(item.to_confirm, MAX_CONFIRM_WORDS);
    const haystack = `${JSON.stringify(candidate)} ${profileJson}`;
    if (!why || !numbersAreGrounded(`${why} ${confirm}`, haystack)) {
      ({ why_it_fits: why, to_confirm: confirm } = codeText(match));
    }
    out.push({ scheme_id: item.scheme_id, why_it_fits: why, to_confirm: confirm });
    if (out.length === MAX_BEST) break;
  }
  return out;
}

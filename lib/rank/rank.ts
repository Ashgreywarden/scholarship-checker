import { createHash } from "node:crypto";
import type { Scheme } from "../databank/types";
import { matchAll } from "../match/engine";
import { profileFromUi } from "../ui/adapters";
import type { StudentProfile } from "../ui/types";
import { codeRanking } from "./fallback";
import { buildCandidates, compactProfile } from "./payload";
import { buildRankUser, RANK_SYSTEM_PROMPT } from "./prompt";
import {
  AI_DEADLINE_MS,
  FALLBACK_NOTE,
  RANKED_JSON_SCHEMA,
  type RankResponse,
} from "./types";
import { validateRanking } from "./validate";

// The ranking job:
//   1. our rule evaluator runs on the data bank
//   2. schemes the rules rule out are dropped (Eligible and Can't tell stay)
//   3. Gemini ranks the rest and writes one short reason for each
//   4. code checks the answer; if anything is wrong we use our own ranking
// Gemini never sees or changes a verdict, and it can't add a scheme.

export const CACHE_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX = 200;

const cache = new Map<string, { at: number; value: RankResponse }>();
export const clearRankCache = (): void => cache.clear();

export type ChatFn = (opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  deadlineMs: number;
  maxRetries?: number;
  maxTokens?: number;
}) => Promise<string>;

function parseJson(text: string): unknown {
  const t = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return JSON.parse(fenced ? fenced[1] : t);
}

export async function rankForProfile(
  profile: StudentProfile,
  schemes: Scheme[],
  deps: { chat: ChatFn; now?: () => number; today?: () => Date },
): Promise<RankResponse> {
  const now = deps.now ?? Date.now;
  const today = (deps.today ?? (() => new Date()))();

  // 1 + 2: rules first.
  const matches = matchAll(schemes, profileFromUi(profile), today);
  const candidates = buildCandidates(matches);
  const fallback = (): RankResponse => ({
    source: "fallback",
    ranked: codeRanking(matches),
    note: FALLBACK_NOTE,
  });
  if (candidates.length === 0) return { source: "fallback", ranked: [], note: FALLBACK_NOTE };

  // Cache by a hash of the profile, the day and the full candidate list (ids AND
  // their rule results), so ticking an optional group that changes a rule result
  // never returns an old ranking.
  const student = compactProfile(profile);
  const key = createHash("sha256")
    .update(JSON.stringify([student, today.toISOString().slice(0, 10), candidates]))
    .digest("hex");
  const hit = cache.get(key);
  if (hit && now() - hit.at < CACHE_MS) return hit.value;

  // 3: ask Gemini (15-second limit).
  try {
    const text = await deps.chat({
      system: RANK_SYSTEM_PROMPT,
      user: buildRankUser(student, candidates),
      schemaName: "ranked_schemes",
      schema: RANKED_JSON_SCHEMA as unknown as Record<string, unknown>,
      deadlineMs: AI_DEADLINE_MS,
      maxRetries: 3,
      maxTokens: 2500,
    });

    // 4: check it in code.
    const byId = new Map(matches.map((m) => [m.scheme.id, m]));
    const ranked = validateRanking(parseJson(text), candidates, byId, JSON.stringify(student));
    if (!ranked || ranked.length === 0) return fallback();

    const value: RankResponse = { source: "ai", ranked, note: null };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: now(), value });
    return value;
  } catch {
    return fallback(); // timeout, 402, 5xx, unreadable answer ...
  }
}

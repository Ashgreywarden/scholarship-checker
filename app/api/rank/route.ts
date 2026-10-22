import { connection } from "next/server";
import { chatJson } from "@/lib/ai";
import { loadPayload } from "@/lib/databank/load";
import { rankForProfile } from "@/lib/rank/rank";
import { FALLBACK_NOTE, RankRequestSchema, type RankResponse } from "@/lib/rank/types";
import { rankLimiter } from "@/lib/rateLimit";
import { codeRanking } from "@/lib/rank/fallback";
import { matchAll } from "@/lib/match/engine";
import { profileFromUi } from "@/lib/ui/adapters";

export const maxDuration = 30;

// Ranks the schemes a student may qualify for. The rule checker runs first on
// the data bank; Gemini (server side, OpenRouter) only orders the survivors and
// writes a short reason for each. If anything fails the answer is our own code
// ranking, so the results page is never blank.
export async function POST(request: Request) {
  await connection();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { message: "Could not read the request." } }, { status: 400 });
  }
  const parsed = RankRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { message: "The profile could not be read." } }, { status: 400 });
  }

  let schemes;
  try {
    schemes = (await loadPayload()).schemes;
  } catch {
    return Response.json(
      { error: { message: "The scholarship data bank could not be read." } },
      { status: 500 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rankLimiter.check(ip).ok) {
    // Too many requests: skip the AI, answer with our own ranking.
    const matches = matchAll(schemes, profileFromUi(parsed.data.profile), new Date());
    const value: RankResponse = { source: "fallback", ranked: codeRanking(matches), note: FALLBACK_NOTE };
    return Response.json(value);
  }

  const value = await rankForProfile(parsed.data.profile, schemes, { chat: chatJson });
  return Response.json(value);
}

// POST /api/web-search
// Live web search for scholarships NOT in the data bank, using our Gemini model
// through OpenRouter with the openrouter:web_search server tool (lib/ai.ts).
// Every result's quoted rule is then checked against the real page by our own
// code. Results are only ever "Possible match", never "Eligible".
import { connection } from "next/server";
import { AiError, webSearchChat } from "@/lib/ai";
import { verifyQuoteOnPage } from "@/lib/web-search/fetchVerify";
import { checkWebSearchLimit } from "@/lib/web-search/rateLimit";
import {
  buildUserMessage,
  cleanProfile,
  extractJsonArray,
  pickCandidates,
  WEB_SYSTEM_PROMPT,
  type WebResult,
} from "@/lib/web-search/search";

export const maxDuration = 60; // seconds; Vercel's default limit is higher

const MODEL_TIMEOUT_MS = 40_000;
const MAX_TOOL_CALLS = 3; // asks for at most 3 searches (Google may still run more)
// Room for Gemini's reasoning plus up to 5 JSON items; 1,500 could cut the answer off.
const MAX_TOKENS = 3000;

export async function POST(req: Request) {
  await connection();
  const fail = (status: number, message: string) => Response.json({ error: message }, { status });

  if (!process.env.OPENROUTER_API_KEY) return fail(500, "Web search is not set up yet.");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const limit = checkWebSearchLimit(ip);
  if (!limit.ok) {
    return fail(
      429,
      limit.reason === "ip"
        ? "You have searched a few times already. Please try again in 10 minutes."
        : "Web search is busy today. Please try again tomorrow.",
    );
  }

  let profile = null;
  try {
    profile = cleanProfile((await req.json())?.profile);
  } catch {
    profile = null;
  }
  if (!profile) return fail(400, "Please fill in your profile first.");

  let content = "";
  let finish: string | null = null;
  try {
    ({ content, finish } = await webSearchChat({
      system: WEB_SYSTEM_PROMPT,
      user: buildUserMessage(profile, new Date()),
      deadlineMs: MODEL_TIMEOUT_MS,
      maxToolCalls: MAX_TOOL_CALLS,
      maxTokens: MAX_TOKENS,
    }));
  } catch (err) {
    // No profile in the logs.
    console.error("web-search: model call failed", err instanceof AiError ? err.code : "unknown");
    if (err instanceof AiError && err.code === "unavailable") {
      return fail(504, "The web search took too long. Please try again.");
    }
    return fail(502, "We could not search the web right now.");
  }

  const items = extractJsonArray(content);
  if (!items) {
    // No profile in the logs; just why the answer could not be read.
    console.error("web-search: unreadable answer", { finish, chars: content.length });
    return Response.json({ results: [], note: "No matching official pages found." });
  }

  const candidates = pickCandidates(items);
  const results: WebResult[] = await Promise.all(
    candidates.map(async (c) => {
      const check = await verifyQuoteOnPage(c.official_url, c.quote);
      return { ...c, host: new URL(c.official_url).hostname, verification: check.status };
    }),
  );

  // Verified first, then the rest.
  results.sort((a, b) =>
    a.verification === b.verification ? 0 : a.verification === "verified" ? -1 : 1,
  );
  return Response.json({ results, searched_at: new Date().toISOString() });
}

// The ONLY file that talks to an AI model. Everything else in the app asks
// this file for an Extraction, so the provider can be swapped by rewriting
// this one file.
//
// Provider: Google Gemini, reached only through OpenRouter (the organisers'
// rules). The key is read from OPENROUTER_API_KEY at call time and is never
// logged or included in an error message.

import { z } from "zod";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt";
import { parseModelOutput } from "./parseOutput";
import { ExtractionSchema, type Extraction } from "./schema";
import { quoteAppearsIn } from "./verifyQuote";

const BASE_URL = "https://openrouter.ai/api/v1";
export const DEFAULT_MODEL = "google/gemini-3.7-flash";

// Required on every request: only Google's own backends, no fallbacks.
const PROVIDER = {
  only: ["google-vertex", "google-ai-studio"],
  allow_fallbacks: false,
} as const;

const MAX_TRANSPORT_RETRIES = 3; // for 429 / 5xx / network errors
const MAX_OUTPUT_RETRIES = 1; // for invalid JSON from the model
const OVERALL_DEADLINE_MS = 55_000; // route's maxDuration is 60 s
const ATTEMPT_TIMEOUT_MS = 45_000;
const MAX_BACKOFF_MS = 8_000;

export type AiErrorCode =
  | "config"
  | "out_of_credits"
  | "auth"
  | "rate_limited"
  | "unavailable"
  | "bad_request"
  | "bad_output";

export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

function getModel(): string {
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  // Organisers' rule: only google/ models.
  if (!model.startsWith("google/")) {
    throw new AiError("config", "Only google/ models are allowed.");
  }
  return model;
}

function getKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new AiError(
      "config",
      "The AI key is not set. Add OPENROUTER_API_KEY to .env.local and restart the server.",
    );
  }
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function backoffMs(attempt: number, retryAfterHeader: string | null): number {
  const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter * 1000, MAX_BACKOFF_MS);
  }
  const base = 1000 * 2 ** attempt;
  return Math.min(base + Math.random() * 300, MAX_BACKOFF_MS);
}

interface Completion {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { code?: number; message?: string };
}

// One HTTP call with the retry rules. Returns the parsed response body.
async function callOpenRouter(
  body: unknown,
  startedAt: number,
): Promise<Completion> {
  const key = getKey();
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_TRANSPORT_RETRIES; attempt++) {
    const remaining = OVERALL_DEADLINE_MS - (Date.now() - startedAt);
    if (remaining < 3000) break;

    let status = 0;
    let retryAfter: string | null = null;
    let json: Completion | null = null;

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.min(ATTEMPT_TIMEOUT_MS, remaining)),
      });
      status = res.status;
      retryAfter = res.headers.get("retry-after");
      json = (await res.json().catch(() => null)) as Completion | null;
      // OpenRouter can answer HTTP 200 with an error object inside.
      if (status === 200 && json?.error && !json.choices) {
        status = typeof json.error.code === "number" ? json.error.code : 502;
      }
    } catch {
      status = 504; // network failure or timeout: treat like a server error
    }
    lastStatus = status;

    if (status === 200 && json) return json;
    if (status === 402) {
      throw new AiError(
        "out_of_credits",
        "The AI service is out of credits. Please tell the organisers or top up the OpenRouter account.",
      );
    }
    if (status === 401 || status === 403) {
      throw new AiError(
        "auth",
        "The AI key was rejected. Check OPENROUTER_API_KEY in .env.local.",
      );
    }
    if (status === 429 || status >= 500) {
      if (attempt < MAX_TRANSPORT_RETRIES) {
        await sleep(backoffMs(attempt, retryAfter));
        continue;
      }
      break;
    }
    // Other 4xx (e.g. 400): retrying will not help.
    console.error("[ai] request rejected, status", status, json?.error?.message);
    throw new AiError(
      "bad_request",
      "The AI service rejected the request. Please try again, or paste a shorter section.",
    );
  }

  if (lastStatus === 429) {
    throw new AiError("rate_limited", "The AI service is busy. Please try again in a minute.");
  }
  throw new AiError("unavailable", "The AI service is not responding. Please try again.");
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Lists every quote that is NOT found in the pasted text (plain-code check).
function unverifiedQuotes(e: Extraction, text: string): string[] {
  const bad: string[] = [];
  e.criteria.forEach((c, i) => {
    if (!quoteAppearsIn(c.quote, text)) bad.push(`criteria[${i}] (${c.id}): ${JSON.stringify(c.quote)}`);
  });
  e.documents.forEach((d, i) => {
    if (!quoteAppearsIn(d.quote, text)) bad.push(`documents[${i}] (${d.name}): ${JSON.stringify(d.quote)}`);
  });
  e.deadlines.forEach((d, i) => {
    if (!quoteAppearsIn(d.quote, text)) bad.push(`deadlines[${i}] (${d.label}): ${JSON.stringify(d.quote)}`);
  });
  return bad;
}

const REPAIR_BUDGET_MS = 30_000; // don't start a repair call after this

// Reads a notice and returns the structured rules, documents and deadlines.
// The student's profile is never passed to this function.
//
// If some quotes are not found in the pasted text (for example the model tidied
// up a messy PDF table), we ask once more, naming the bad quotes. The new answer
// is used only if it has fewer bad quotes. Whatever is still not found is
// flagged on screen by the browser; it is never trusted.
export async function extractNotice(noticeText: string): Promise<Extraction> {
  const startedAt = Date.now();
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserMessage(noticeText) },
  ];

  const first = await requestExtraction(messages, startedAt);
  const bad = unverifiedQuotes(first, noticeText);
  if (bad.length === 0 || Date.now() - startedAt > REPAIR_BUDGET_MS) return first;

  console.error(`[ai] ${bad.length} quote(s) not found; asking the model to fix them`);
  try {
    const repaired = await requestExtraction(
      [
        ...messages,
        { role: "assistant", content: JSON.stringify(first) },
        {
          role: "user",
          content: `These quotes were NOT found in the notice text, character for character:\n${bad.join("\n")}\n\nReturn the complete JSON again with the same structure. For each listed quote, replace it with the longest run of words that really sits uninterrupted in the notice (copy it exactly, even if it is short or includes a row number), or remove that item if no exact run exists. Do not change any other item.`,
        },
      ],
      startedAt,
    );
    if (unverifiedQuotes(repaired, noticeText).length < bad.length) return repaired;
  } catch (e) {
    // Credits and key problems must still be shown; anything else: keep the first answer.
    if (e instanceof AiError && (e.code === "out_of_credits" || e.code === "auth")) throw e;
  }
  return first;
}

async function requestExtraction(
  messages: ChatMessage[],
  startedAt: number,
): Promise<Extraction> {
  const schema = z.toJSONSchema(ExtractionSchema) as Record<string, unknown>;
  delete schema.$schema;

  const body = {
    model: getModel(),
    messages,
    provider: PROVIDER,
    response_format: {
      type: "json_schema",
      json_schema: { name: "scholarship_extraction", strict: true, schema },
    },
    temperature: 0,
    max_tokens: 16000,
    reasoning: { effort: "low" },
  };

  let lastProblem = "";
  for (let attempt = 0; attempt <= MAX_OUTPUT_RETRIES; attempt++) {
    const completion = await callOpenRouter(body, startedAt);
    const choice = completion.choices?.[0];
    const content = choice?.message?.content;
    if (!content || choice?.finish_reason === "length") {
      lastProblem = choice?.finish_reason === "length" ? "output cut off" : "empty answer";
      continue;
    }
    try {
      return parseModelOutput(content);
    } catch (e) {
      lastProblem = e instanceof Error ? e.message.slice(0, 200) : "invalid output";
    }
  }
  console.error("[ai] model output unusable:", lastProblem);
  throw new AiError(
    "bad_output",
    "The AI gave an answer we couldn't read. Please try again.",
  );
}

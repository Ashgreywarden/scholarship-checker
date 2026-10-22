import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiError, extractNotice } from "./ai";
import { cheveningExtraction } from "./fixtures";
import { parseModelOutput } from "./parseOutput";
import { checkRateLimit, RATE_LIMIT, resetRateLimit } from "./rateLimit";

const NOTICE = "Eligibility: applicants must be under 25 years of age. ".repeat(3);
const FAKE_KEY = "sk-or-test-key-1234567890";

const okBody = (content: string) =>
  new Response(
    JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }] }),
    { status: 200 },
  );
const status = (code: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { code, message: "x" } }), { status: code, headers });

describe("lib/ai.ts (OpenRouter + Gemini)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("OPENROUTER_API_KEY", FAKE_KEY);
    vi.stubEnv("OPENROUTER_MODEL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function run(p: Promise<unknown>) {
    const settled = p.then(
      (v) => ({ ok: true as const, v }),
      (e) => ({ ok: false as const, e }),
    );
    await vi.advanceTimersByTimeAsync(60_000);
    return settled;
  }

  it("sends the required URL, header, model and provider block, and never the profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue(okBody(JSON.stringify(cheveningExtraction)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_KEY}`);
    const body = JSON.parse(init.body);
    expect(body.model).toBe("google/gemini-3.7-flash");
    expect(body.provider).toEqual({
      only: ["google-vertex", "google-ai-studio"],
      allow_fallbacks: false,
    });
    expect(body.response_format.type).toBe("json_schema");
    expect(JSON.stringify(body)).not.toMatch(/annualIncome|workExperienceYears|courseLevel/);
  });

  it("refuses non-google models", async () => {
    vi.stubEnv("OPENROUTER_MODEL", "anthropic/claude-sonnet");
    vi.stubGlobal("fetch", vi.fn());
    const r = await run(extractNotice(NOTICE));
    expect(r.ok).toBe(false);
    expect((r as { e: AiError }).e.code).toBe("config");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stops at once on 402 (out of credits)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(status(402));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect((r as { e: AiError }).e.code).toBe("out_of_credits");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(status(429, { "retry-after": "1" }))
      .mockResolvedValueOnce(okBody(JSON.stringify(cheveningExtraction)));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 retries on 5xx (4 calls total)", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => status(503));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect((r as { e: AiError }).e.code).toBe("unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("treats an error object inside an HTTP 200 as an error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 402, message: "x" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect((r as { e: AiError }).e.code).toBe("out_of_credits");
  });

  it("retries once on unreadable output, then gives a clear error", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => okBody("not json at all"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await run(extractNotice(NOTICE));
    expect((r as { e: AiError }).e.code).toBe("bad_output");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never leaks the key in an error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => status(401)));
    const r = await run(extractNotice(NOTICE));
    expect((r as { e: AiError }).e.message).not.toContain(FAKE_KEY);
  });
});

describe("parseModelOutput", () => {
  it("accepts fenced JSON", () => {
    const out = parseModelOutput("```json\n" + JSON.stringify(cheveningExtraction) + "\n```");
    expect(out.criteria).toHaveLength(4);
  });
  it("demotes out-of-vocabulary fields/operators/units to can't-tell", () => {
    const bad = {
      ...cheveningExtraction,
      criteria: [
        { id: "c1", quote: "q", field: "gpa", operator: "gte", values: [3.5], unit: "cgpa" },
      ],
    };
    const out = parseModelOutput(JSON.stringify(bad));
    expect(out.criteria[0]).toMatchObject({ field: "none", operator: "judgement", unit: "none", values: ["3.5"] });
  });
  it("rejects output missing required parts", () => {
    expect(() => parseModelOutput('{"is_scholarship_notice": true}')).toThrow();
  });
});

describe("rate limit", () => {
  beforeEach(() => resetRateLimit());
  it("allows LIMIT requests per IP then blocks, per IP, and recovers", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT.LIMIT; i++) expect(checkRateLimit("1.1.1.1", t0).ok).toBe(true);
    expect(checkRateLimit("1.1.1.1", t0).ok).toBe(false);
    expect(checkRateLimit("2.2.2.2", t0).ok).toBe(true);
    expect(checkRateLimit("1.1.1.1", t0 + RATE_LIMIT.WINDOW_MS + 1).ok).toBe(true);
  });
});

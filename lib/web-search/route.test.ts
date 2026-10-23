import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/ai", async () => {
  class AiError extends Error {
    constructor(public code: string, message: string) {
      super(message);
    }
  }
  return { AiError, webSearchChat: vi.fn() };
});
vi.mock("@/lib/web-search/fetchVerify", async (orig) => ({
  ...(await orig<typeof import("./fetchVerify")>()),
  verifyQuoteOnPage: vi.fn(),
}));

import { AiError, webSearchChat } from "@/lib/ai";
import { verifyQuoteOnPage } from "@/lib/web-search/fetchVerify";
import { resetWebSearchLimits } from "@/lib/web-search/rateLimit";
import { POST } from "@/app/api/web-search/route";

const profile = { state: "Assam", category: "General", annualIncome: "300000", level: "UG", year: "1", courseType: "Medicine and health", gender: "Woman" };
const call = (body: unknown, ip = "5.5.5.5") =>
  POST(new Request("http://x/api/web-search", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  }));

beforeEach(() => {
  resetWebSearchLimits();
  vi.mocked(webSearchChat).mockReset();
  vi.mocked(verifyQuoteOnPage).mockReset();
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
});

describe("POST /api/web-search", () => {
  it("an empty profile gets 'Please fill in your profile first.' and no AI call", async () => {
    const res = await call({ profile: {} });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please fill in your profile first.");
    expect(webSearchChat).not.toHaveBeenCalled();
  });
  it("the 6th search in 10 minutes gets the 'try again in 10 minutes' message", async () => {
    for (let i = 0; i < 5; i++) await call({ profile: {} });
    const res = await call({ profile: {} });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("You have searched a few times already. Please try again in 10 minutes.");
  });
  it("sends the AI no gender, and labels results; verified first, never 'eligible'", async () => {
    vi.mocked(webSearchChat).mockResolvedValue({
      searches: 2,
      finish: "stop",
      content: "```json\n" + JSON.stringify([
        { name: "A", provider: "Gov", official_url: "https://a.gov.in/s", quote: "Open to nursing students of Assam only.", deadline_text: "", why: "x" },
        { name: "B", provider: "Gov", official_url: "https://b.gov.in/s", quote: "Open to all degree students of Assam.", deadline_text: "31 Dec", why: "y" },
        { name: "C", provider: "Agg", official_url: "https://www.shiksha.com/s", quote: "Aggregator result long enough.", deadline_text: "", why: "z" },
      ]) + "\n```",
    });
    vi.mocked(verifyQuoteOnPage).mockImplementation(async (url: string) =>
      url.includes("b.gov.in") ? { status: "verified" } : { status: "unverified", reason: "quote_not_found" });
    const res = await call({ profile });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results.map((r: { name: string }) => r.name)).toEqual(["B", "A"]);
    expect(data.results.map((r: { verification: string }) => r.verification)).toEqual(["verified", "unverified"]);
    expect(JSON.stringify(data)).not.toMatch(/eligible/i);
    const sent = vi.mocked(webSearchChat).mock.calls[0][0];
    expect(sent.user).not.toContain("Woman");
    expect(sent.maxToolCalls).toBe(3);
    expect(sent.deadlineMs).toBe(40_000);
    expect(sent.maxTokens).toBe(3000);
  });
  it("a model failure gives a friendly error (the rest of the page is unaffected)", async () => {
    vi.mocked(webSearchChat).mockRejectedValue(new (AiError as unknown as new (c: string, m: string) => Error)("unavailable", "down"));
    let res = await call({ profile });
    expect(res.status).toBe(504);
    expect((await res.json()).error).toBe("The web search took too long. Please try again.");
    vi.mocked(webSearchChat).mockRejectedValue(new Error("boom"));
    res = await call({ profile });
    expect(res.status).toBe(502);
  });
  it("an answer with no JSON gives an empty list with a note", async () => {
    vi.mocked(webSearchChat).mockResolvedValue({ searches: 1, finish: "stop", content: "Sorry, nothing found." });
    const data = await (await call({ profile })).json();
    expect(data).toEqual({ results: [], note: "No matching official pages found." });
  });
  it("without a key the route says it is not set up", async () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const res = await call({ profile });
    expect(res.status).toBe(500);
  });
});

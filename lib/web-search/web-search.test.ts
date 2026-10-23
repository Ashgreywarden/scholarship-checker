import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  htmlToText,
  isAggregator,
  isPrivateIp,
  normalise,
  quoteAppears,
  verifyQuoteOnPage,
} from "./fetchVerify";
import { checkWebSearchLimit, resetWebSearchLimits, WEB_SEARCH_LIMITS } from "./rateLimit";
import { buildUserMessage, describe as describeProfile, extractJsonArray, pickCandidates, MAX_RESULTS } from "./search";
import { cleanProfile, toWebSearchProfile } from "./profile";

describe("private address blocking", () => {
  it("blocks private, loopback, link-local and metadata addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "192.168.1.1", "172.20.0.1", "100.64.0.1", "0.0.0.0", "::1", "::", "fc00::1", "fe80::1", "::ffff:10.0.0.1", "not-an-ip"]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "164.100.1.1", "2606:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("aggregator filter", () => {
  it("drops aggregator hosts and their subdomains, not look-alikes", () => {
    expect(isAggregator("www.buddy4study.com")).toBe(true);
    expect(isAggregator("Shiksha.com")).toBe(true);
    expect(isAggregator("buddy4study.com.example.org")).toBe(false);
    expect(isAggregator("notbuddy4study.com")).toBe(false);
    expect(isAggregator("scholarships.gov.in")).toBe(false);
  });
});

describe("page text and quote matching", () => {
  it("turns HTML into text and drops scripts and styles", () => {
    const t = htmlToText("<p>Income &amp; caste&nbsp;rules</p><script>alert(1)</script><style>p{}</style><p>Last&ndash;date</p>");
    expect(t).toContain("Income & caste rules");
    expect(t).not.toContain("alert");
    expect(normalise(t)).toContain("Last-date");
  });
  it("ignores whitespace, quote and dash styles, and nothing else", () => {
    const page = "Applicants’ family income should not exceed  Rs. 2,50,000 — per annum.";
    expect(quoteAppears("Applicants' family income should not exceed Rs. 2,50,000 - per annum.", page)).toBe(true);
    expect(quoteAppears("Applicants' family income should not exceed Rs. 3,00,000 - per annum.", page)).toBe(false);
  });
  it("quotes under 20 characters do not count", () => {
    expect(quoteAppears("family income", "family income")).toBe(false);
  });
});

describe("fetching a cited page safely", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const QUOTE = "Applicants must be students of a recognised college.";
  const page = (body: string, type = "text/html; charset=utf-8", status = 200, headers: Record<string, string> = {}) =>
    new Response(body, { status, headers: { "content-type": type, ...headers } });

  it("refuses http, localhost and private IPs before fetching", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    expect(await verifyQuoteOnPage("http://8.8.8.8/x", QUOTE)).toEqual({ status: "unverified", reason: "not_https" });
    expect(await verifyQuoteOnPage("https://localhost/x", QUOTE)).toEqual({ status: "unverified", reason: "local_host" });
    expect(await verifyQuoteOnPage("https://10.0.0.5/x", QUOTE)).toEqual({ status: "unverified", reason: "private_ip" });
    expect(await verifyQuoteOnPage("https://user:pw@8.8.8.8/x", QUOTE)).toEqual({ status: "unverified", reason: "credentials_in_url" });
    expect(f).not.toHaveBeenCalled();
  });
  it("verifies a quote that is on the page", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(`<html><p>${QUOTE}</p></html>`)));
    expect(await verifyQuoteOnPage("https://8.8.8.8/scheme", QUOTE)).toEqual({ status: "verified" });
  });
  it("re-checks every redirect and refuses one that points to a private address", async () => {
    const f = vi.fn().mockResolvedValue(page("", "text/html", 302, { location: "https://169.254.169.254/latest" }));
    vi.stubGlobal("fetch", f);
    expect(await verifyQuoteOnPage("https://8.8.8.8/scheme", QUOTE)).toEqual({ status: "unverified", reason: "private_ip" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("stops after 3 redirects", async () => {
    const f = vi.fn().mockImplementation(async () => page("", "text/html", 301, { location: "https://8.8.8.8/next" }));
    vi.stubGlobal("fetch", f);
    expect(await verifyQuoteOnPage("https://8.8.8.8/scheme", QUOTE)).toEqual({ status: "unverified", reason: "too_many_redirects" });
    expect(f).toHaveBeenCalledTimes(4);
  });
  it("does not read PDFs or error pages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("%PDF", "application/pdf")));
    expect((await verifyQuoteOnPage("https://8.8.8.8/a.pdf", QUOTE)).status).toBe("unverified");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page("nope", "text/html", 404)));
    expect(await verifyQuoteOnPage("https://8.8.8.8/x", QUOTE)).toEqual({ status: "unverified", reason: "http_404" });
  });
  it("reads at most 1.5 MB", async () => {
    const big = `<p>${QUOTE}</p>` + "x".repeat(2_000_000) + "<p>Hidden rule that appears only after the limit.</p>";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(big)));
    expect((await verifyQuoteOnPage("https://8.8.8.8/x", QUOTE)).status).toBe("verified");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(page(big)));
    expect((await verifyQuoteOnPage("https://8.8.8.8/x", "Hidden rule that appears only after the limit.")).status).toBe("unverified");
  });
  it("gives up after 10 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_u: unknown, init: { signal: AbortSignal }) =>
      new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))))));
    const p = verifyQuoteOnPage("https://8.8.8.8/slow", QUOTE);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(await p).toEqual({ status: "unverified", reason: "timeout" });
  });
});

describe("what is sent to the AI", () => {
  const full = {
    state: "Assam", category: "General", annualIncome: "300000", level: "UG", year: "1",
    courseType: "Medicine and health", gender: "Woman", disability: "yes", age: "19",
    specialGroups: ["minority:muslim"], marksPercent: "80",
  };
  it("keeps only state, category, income, level, year and course type", () => {
    expect(cleanProfile(full)).toEqual({
      state: "Assam", category: "General", annualIncome: "300000", level: "UG", year: "1", courseType: "Medicine and health",
    });
    const msg = buildUserMessage(cleanProfile(full)!, new Date("2026-10-23"));
    for (const secret of ["Woman", "disab", "muslim", "Muslim", "minority"]) expect(msg).not.toContain(secret);
    expect(describeProfile(cleanProfile(full)!)).toContain("State of domicile: Assam");
  });
  it("'Not sure' is dropped, and an empty profile is rejected", () => {
    expect(cleanProfile({ ...full, category: "Not sure" })?.category).toBeUndefined();
    expect(cleanProfile({})).toBeNull();
    expect(cleanProfile(null)).toBeNull();
    expect(toWebSearchProfile({ gender: "Woman" })).toBeNull();
  });
});

describe("reading the AI's answer", () => {
  it("reads a fenced JSON block or a bare array", () => {
    expect(extractJsonArray('Here:\n```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJsonArray('text [{"a":2}] more')).toEqual([{ a: 2 }]);
    expect(extractJsonArray("no json")).toBeNull();
  });
  it("keeps complete https items from non-aggregator sites, no duplicates, at most 5", () => {
    const ok = (i: number) => ({ name: `S${i}`, official_url: `https://gov${i}.example.in/s`, quote: "A quote that is long enough." });
    const items = [
      { name: "x", official_url: "http://insecure.gov.in/s", quote: "A quote that is long enough." },
      { name: "y", official_url: "https://www.buddy4study.com/s", quote: "A quote that is long enough." },
      { name: "", official_url: "https://a.gov.in", quote: "q" },
      ok(1), ok(1), ok(2), ok(3), ok(4), ok(5), ok(6),
    ];
    const picked = pickCandidates(items);
    expect(picked.map((p) => p.name)).toEqual(["S1", "S2", "S3", "S4", "S5"]);
    expect(picked.length).toBe(MAX_RESULTS);
  });
});

describe("rate limit", () => {
  beforeEach(() => resetWebSearchLimits());
  it("allows 5 searches per IP per 10 minutes", () => {
    for (let i = 0; i < 5; i++) expect(checkWebSearchLimit("1.1.1.1", 1000).ok).toBe(true);
    expect(checkWebSearchLimit("1.1.1.1", 1000)).toEqual({ ok: false, reason: "ip" });
    expect(checkWebSearchLimit("2.2.2.2", 1000).ok).toBe(true);
    expect(checkWebSearchLimit("1.1.1.1", 1000 + WEB_SEARCH_LIMITS.WINDOW_MS + 1).ok).toBe(true);
  });
  it("has a daily cap", () => {
    const now = Date.UTC(2026, 9, 23, 12);
    for (let i = 0; i < WEB_SEARCH_LIMITS.DAILY_CAP; i++) checkWebSearchLimit(`10.0.${Math.floor(i / 5)}.${i % 5}`, now);
    expect(checkWebSearchLimit("9.9.9.9", now)).toEqual({ ok: false, reason: "daily" });
  });
});

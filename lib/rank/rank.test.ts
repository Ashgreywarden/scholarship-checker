import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAllSchemes } from "../databank/load";
import type { Scheme } from "../databank/types";
import { matchAll } from "../match/engine";
import { profileFromUi } from "../ui/adapters";
import { EMPTY_PROFILE } from "../ui/profile";
import type { StudentProfile } from "../ui/types";
import { codeRanking } from "./fallback";
import { buildCandidates } from "./payload";
import { CACHE_MS, clearRankCache, rankForProfile, type ChatFn } from "./rank";
import { FALLBACK_NOTE } from "./types";

const today = new Date(2026, 9, 23);
const deps = (chat: ChatFn, now = () => 0) => ({ chat, now, today: () => today });

const scUp: StudentProfile = {
  ...EMPTY_PROFILE, state: "Uttar Pradesh", category: "SC", annualIncome: "180000", level: "UG",
  year: "1", courseType: "Science", gender: "Woman", disability: "no", minorityCommunity: "None",
  parentOccupation: "Farming", firstGeneration: "yes", marksPercent: "70", age: "19",
};
const generalMh: StudentProfile = {
  ...EMPTY_PROFILE, state: "Maharashtra", category: "General", annualIncome: "900000", level: "PG",
  year: "1", courseType: "Engineering and technology", gender: "Man", disability: "no",
  minorityCommunity: "None", parentOccupation: "Salaried — private sector", firstGeneration: "no",
  marksPercent: "68", age: "23",
};

let schemes: Scheme[];
beforeAll(async () => {
  schemes = (await loadAllSchemes()).schemes.filter((s) => s.region === "india");
});
beforeEach(() => clearRankCache());

const ids = (p: StudentProfile) =>
  matchAll(schemes, profileFromUi(p), today).filter((m) => m.verdict !== "not_eligible");

// What the model sent back, for a given list of ids.
const answer = (items: object[]) => JSON.stringify({ ranked: items });
const item = (id: string, why = "You meet the income and category rules.", confirm = "") => ({
  scheme_id: id, why_it_fits: why, to_confirm: confirm,
});
const sentIds = (call: unknown): string[] => {
  const user = (call as { user: string }).user;
  const data = JSON.parse(user.replace(/^<data>\n/, "").replace(/\n<\/data>$/, ""));
  return data.schemes.map((s: { id: string }) => s.id);
};

describe("step 2: the rules go first and ruled-out schemes never reach the AI", () => {
  it("sends only Eligible and Can't tell schemes, with their rules and quotes", async () => {
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([]));
    await rankForProfile(scUp, schemes, deps(chat));
    const sent = sentIds(chat.mock.calls[0][0]);
    const all = matchAll(schemes, profileFromUi(scUp), today);
    const ruledOut = new Set(all.filter((m) => m.verdict === "not_eligible").map((m) => m.scheme.id));
    expect(sent.length).toBeGreaterThan(0);
    expect(sent.some((id) => ruledOut.has(id))).toBe(false);

    const payload = JSON.parse(
      (chat.mock.calls[0][0] as { user: string }).user.replace(/^<data>\n/, "").replace(/\n<\/data>$/, ""),
    );
    expect(payload.student).toMatchObject({ category: "SC", state: "Uttar Pradesh", annual_family_income_inr: 180000 });
    const first = payload.schemes[0];
    expect(Object.keys(first)).toEqual(
      expect.arrayContaining(["id", "name", "provider", "amount", "deadline", "verdict", "rules"]),
    );
    expect(first.rules.some((r: { quote?: string }) => r.quote)).toBe(true);
  });
  it("keeps the request small (under 100 KB)", () => {
    const candidates = buildCandidates(matchAll(schemes, profileFromUi(EMPTY_PROFILE), today));
    expect(JSON.stringify(candidates).length).toBeLessThan(100_000);
    expect(candidates.length).toBeLessThanOrEqual(40);
  });
});

describe("step 5: the AI's answer is checked in code", () => {
  it("keeps valid picks in the AI's order, with source 'ai'", async () => {
    const pool = ids(scUp).filter((m) => m.status.status === "open").slice(0, 3).map((m) => m.scheme.id);
    const picks = [pool[2], pool[0], pool[1]];
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer(picks.map((id) => item(id))));
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.source).toBe("ai");
    expect(r.note).toBeNull();
    expect(r.ranked.map((x) => x.scheme_id)).toEqual(picks);
  });
  it("drops ids we did not send, duplicates, and anything past 8", async () => {
    const pool = ids(scUp).filter((m) => m.status.status === "open").map((m) => m.scheme.id);
    expect(pool.length).toBeGreaterThan(9);
    const chat = vi.fn<ChatFn>().mockResolvedValue(
      answer([item("made_up_scheme"), item(pool[0]), item(pool[0]), ...pool.slice(1, 12).map((id) => item(id))]),
    );
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.ranked).toHaveLength(8);
    expect(r.ranked.map((x) => x.scheme_id)).not.toContain("made_up_scheme");
    expect(new Set(r.ranked.map((x) => x.scheme_id)).size).toBe(8);
  });
  it("cannot bring back a scheme the rules ruled out, and ignores any verdict it sends", async () => {
    const all = matchAll(schemes, profileFromUi(scUp), today);
    const ruledOut = all.find((m) => m.verdict === "not_eligible")!.scheme.id;
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const chat = vi.fn<ChatFn>().mockResolvedValue(
      answer([{ ...item(ruledOut), verdict: "eligible" }, { ...item(good), verdict: "not_eligible" }]),
    );
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.ranked.map((x) => x.scheme_id)).toEqual([good]);
    expect(Object.keys(r.ranked[0]).sort()).toEqual(["scheme_id", "to_confirm", "why_it_fits"]);
  });
  it("never puts a closed or old-cycle scheme in the best list", async () => {
    const closed = ids(scUp).find((m) => m.status.status === "closed" || m.status.status === "stale");
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const picks = closed ? [item(closed.scheme.id), item(good)] : [item(good)];
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer(picks));
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.ranked.map((x) => x.scheme_id)).toEqual([good]);
  });
  it("cuts the text to 25 and 15 words", async () => {
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const long = Array.from({ length: 40 }, () => "fit").join(" ");
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([item(good, long, long)]));
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.ranked[0].why_it_fits.replace("…", "").trim().split(" ")).toHaveLength(25);
    expect(r.ranked[0].to_confirm.replace("…", "").trim().split(" ")).toHaveLength(15);
  });
  it("replaces a reason that contains a number that is not in the data", async () => {
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const chat = vi.fn<ChatFn>().mockResolvedValue(
      answer([item(good, "You will receive ₹9,87,654 every month.")]),
    );
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.source).toBe("ai");
    expect(r.ranked[0].why_it_fits).not.toContain("987654");
    expect(r.ranked[0].why_it_fits).not.toMatch(/9,87,654/);
    expect(r.ranked[0].why_it_fits.length).toBeGreaterThan(10);
  });
  it("keeps a reason whose numbers come from the student's answers", async () => {
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const chat = vi.fn<ChatFn>().mockResolvedValue(
      answer([item(good, "Your family income of 180000 is within the limit.")]),
    );
    const r = await rankForProfile(scUp, schemes, deps(chat));
    expect(r.ranked[0].why_it_fits).toContain("180000");
  });
});

describe("step 5: when the AI fails, our own ranking is used and the page is never blank", () => {
  const expectFallback = (r: Awaited<ReturnType<typeof rankForProfile>>) => {
    expect(r.source).toBe("fallback");
    expect(r.note).toBe(FALLBACK_NOTE);
    expect(r.note).toBe("Showing results ranked by deadline and fit");
    expect(r.ranked.length).toBeGreaterThan(0);
    expect(r.ranked.length).toBeLessThanOrEqual(8);
  };
  it("call fails (timeout, 402, 5xx ...)", async () => {
    expectFallback(await rankForProfile(scUp, schemes, deps(vi.fn<ChatFn>().mockRejectedValue(new Error("timeout")))));
  });
  it("answer is not JSON", async () => {
    expectFallback(await rankForProfile(scUp, schemes, deps(vi.fn<ChatFn>().mockResolvedValue("sorry, here are some schemes"))));
  });
  it("answer has the wrong shape", async () => {
    expectFallback(await rankForProfile(scUp, schemes, deps(vi.fn<ChatFn>().mockResolvedValue('{"schemes":[1,2]}'))));
  });
  it("every id is unknown", async () => {
    expectFallback(await rankForProfile(scUp, schemes, deps(vi.fn<ChatFn>().mockResolvedValue(answer([item("x"), item("y")])))));
  });
  it("uses a 15-second limit", async () => {
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([]));
    await rankForProfile(scUp, schemes, deps(chat));
    expect(chat.mock.calls[0][0].deadlineMs).toBe(15_000);
  });
  it("the fallback ranking only has schemes the rules did not rule out", async () => {
    const r = await rankForProfile(scUp, schemes, deps(vi.fn<ChatFn>().mockRejectedValue(new Error("x"))));
    const ok = new Set(ids(scUp).map((m) => m.scheme.id));
    expect(r.ranked.every((x) => ok.has(x.scheme_id))).toBe(true);
  });
});

describe("step 7: the ranking is cached for 10 minutes by a hash of the profile", () => {
  it("a second request with the same profile does not call the AI again", async () => {
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([item(good)]));
    const a = await rankForProfile(scUp, schemes, deps(chat));
    const b = await rankForProfile({ ...scUp }, schemes, deps(chat, () => 5 * 60 * 1000));
    expect(chat).toHaveBeenCalledTimes(1);
    expect(b).toEqual(a);
  });
  it("expires after 10 minutes", async () => {
    const good = ids(scUp).find((m) => m.status.status === "open")!.scheme.id;
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([item(good)]));
    await rankForProfile(scUp, schemes, deps(chat, () => 0));
    await rankForProfile(scUp, schemes, deps(chat, () => CACHE_MS + 1));
    expect(chat).toHaveBeenCalledTimes(2);
  });
  it("a different profile is a different cache entry", async () => {
    const chat = vi.fn<ChatFn>().mockResolvedValue(answer([]));
    await rankForProfile(scUp, schemes, deps(chat));
    await rankForProfile({ ...scUp, annualIncome: "400000" }, schemes, deps(chat));
    expect(chat).toHaveBeenCalledTimes(2);
  });
  it("failures are not cached", async () => {
    const chat = vi.fn<ChatFn>().mockRejectedValue(new Error("down"));
    await rankForProfile(scUp, schemes, deps(chat));
    await rankForProfile(scUp, schemes, deps(chat));
    expect(chat).toHaveBeenCalledTimes(2);
  });
});

describe("different students get different results", () => {
  it("SC / ₹1.8 lakh / UG / UP vs General / ₹9 lakh / PG / Maharashtra", () => {
    const a = ids(scUp).map((m) => m.scheme.id);
    const b = ids(generalMh).map((m) => m.scheme.id);
    expect(a).not.toEqual(b);
    const onlyA = a.filter((x) => !b.includes(x));
    const onlyB = b.filter((x) => !a.includes(x));
    expect(onlyA.length).toBeGreaterThan(0);
    expect(onlyB.length).toBeGreaterThan(0);
    // the code ranking differs too
    const ra = codeRanking(matchAll(schemes, profileFromUi(scUp), today)).map((x) => x.scheme_id);
    const rb = codeRanking(matchAll(schemes, profileFromUi(generalMh), today)).map((x) => x.scheme_id);
    expect(ra).not.toEqual(rb);
  });
});


describe("the ranking route has its own per-IP rate limit", () => {
  it("allows 20 rankings per IP per 10 minutes, then blocks, per IP", async () => {
    const { rankLimiter, RANK_RATE_LIMIT } = await import("../rateLimit");
    rankLimiter.reset();
    for (let i = 0; i < RANK_RATE_LIMIT.LIMIT; i++) expect(rankLimiter.check("9.9.9.9", 1000).ok).toBe(true);
    expect(rankLimiter.check("9.9.9.9", 1000).ok).toBe(false);
    expect(rankLimiter.check("8.8.8.8", 1000).ok).toBe(true);
    expect(rankLimiter.check("9.9.9.9", 1000 + RANK_RATE_LIMIT.WINDOW_MS + 1).ok).toBe(true);
    expect(RANK_RATE_LIMIT.LIMIT).toBe(20);
  });
});

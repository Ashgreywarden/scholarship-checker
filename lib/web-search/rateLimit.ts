// Limits for the live web search, on top of the shared in-memory limiter in
// lib/rateLimit.ts. On Vercel each warm instance keeps its own memory, so this
// is a soft limit: enough to stop accidental spam and cap cost for a demo.
// Use a shared store (e.g. Upstash Redis) for real traffic.
import { createRateLimiter } from "../rateLimit";

export const WEB_SEARCH_LIMITS = {
  WINDOW_MS: 10 * 60 * 1000, // 10 minutes
  PER_IP: 5, // searches per IP per window
  // Each search costs real money (Google search grounding is billed per query,
  // and one request can run several queries), so the daily default is low.
  // Raise it with WEB_SEARCH_DAILY_CAP if needed.
  DAILY_CAP: Number(process.env.WEB_SEARCH_DAILY_CAP ?? 50), // per instance
};

const perIp = createRateLimiter(WEB_SEARCH_LIMITS.PER_IP, WEB_SEARCH_LIMITS.WINDOW_MS);
let day = new Date().toISOString().slice(0, 10);
let dayCount = 0;

export function checkWebSearchLimit(
  ip: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; reason: "ip" | "daily" } {
  const today = new Date(now).toISOString().slice(0, 10);
  if (today !== day) {
    day = today;
    dayCount = 0;
  }
  if (dayCount >= WEB_SEARCH_LIMITS.DAILY_CAP) return { ok: false, reason: "daily" };
  if (!perIp.check(ip, now).ok) return { ok: false, reason: "ip" };
  dayCount += 1;
  return { ok: true };
}

export function resetWebSearchLimits(): void {
  perIp.reset();
  dayCount = 0;
}

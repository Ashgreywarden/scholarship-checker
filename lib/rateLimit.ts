// Simple in-memory limits: at most `limit` requests per IP per window.
// They live in the server's memory, so they reset when the server restarts and
// each Vercel instance counts separately. Good enough for an MVP demo.

export type RateResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();

  return {
    check(ip: string, now: number = Date.now()): RateResult {
      const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(ip, recent);
        return { ok: false, retryAfterSeconds: Math.ceil((recent[0] + windowMs - now) / 1000) };
      }
      recent.push(now);
      hits.set(ip, recent);

      // Keep memory small: drop IPs with no recent hits.
      if (hits.size > 1000) {
        for (const [k, v] of hits) {
          if (v.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }
      return { ok: true };
    },
    reset(): void {
      hits.clear();
    },
  };
}

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;

// The paste-a-notice route: 10 checks per 10 minutes per IP.
const noticeLimiter = createRateLimiter(LIMIT, WINDOW_MS);
export const checkRateLimit = (ip: string, now?: number): RateResult => noticeLimiter.check(ip, now);
export const resetRateLimit = (): void => noticeLimiter.reset();
export const RATE_LIMIT = { WINDOW_MS, LIMIT };

// The results ranking route: 20 rankings per 10 minutes per IP.
export const RANK_RATE_LIMIT = { WINDOW_MS, LIMIT: 20 };
export const rankLimiter = createRateLimiter(RANK_RATE_LIMIT.LIMIT, RANK_RATE_LIMIT.WINDOW_MS);

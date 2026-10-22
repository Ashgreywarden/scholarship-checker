// A simple in-memory limit: at most LIMIT requests per IP per window.
// It lives in the server's memory, so it resets when the server restarts and
// each Vercel instance counts separately. Good enough for an MVP demo.

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;

const hits = new Map<string, number[]>();

export function checkRateLimit(
  ip: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) {
    hits.set(ip, recent);
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000),
    };
  }
  recent.push(now);
  hits.set(ip, recent);

  // Keep memory small: drop IPs with no recent hits.
  if (hits.size > 1000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return { ok: true };
}

export function resetRateLimit(): void {
  hits.clear();
}

export const RATE_LIMIT = { WINDOW_MS, LIMIT };

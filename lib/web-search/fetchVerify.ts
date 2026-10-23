// Server-only. Fetches a public https page safely and checks whether a quoted
// rule appears word for word in the page text.
import { lookup } from "node:dns/promises";
import net from "node:net";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const MIN_QUOTE_CHARS = 20; // very short quotes prove nothing

// Scholarship listing / aggregator sites. Results from these are dropped.
export const AGGREGATOR_HOSTS = [
  "buddy4study.com",
  "wemakescholars.com",
  "indiascholarships.in",
  "scholarshipsinindia.com",
  "collegedekho.com",
  "shiksha.com",
  "careers360.com",
  "jagranjosh.com",
  "leverageedu.com",
  "getmyuni.com",
  "collegedunia.com",
  "scholarshipportal.com",
];

export function isAggregator(host: string): boolean {
  const h = host.toLowerCase();
  return AGGREGATOR_HOSTS.some((a) => h === a || h.endsWith("." + a));
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const blocked: [string, number][] = [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
      ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
    ];
    return blocked.some(([b, n]) => inV4Range(ip, b, n));
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === "::" || v === "::1") return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
    if (/^f[cd]/.test(v)) return true; // fc00::/7 unique local
    if (/^fe[89ab]/.test(v)) return true; // fe80::/10 link local
    if (v.startsWith("ff")) return true; // multicast
    if (v.startsWith("2001:db8")) return true; // documentation
    return false;
  }
  return true; // not an IP we understand: block
}

async function assertPublicHttpsUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("bad_url");
  }
  if (url.protocol !== "https:") throw new Error("not_https");
  if (url.username || url.password) throw new Error("credentials_in_url");
  if (url.port && url.port !== "443") throw new Error("non_standard_port");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new Error("local_host");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("private_ip");
  } else {
    const addrs = await lookup(host, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      throw new Error("private_ip");
    }
  }
  return url;
}

async function readLimited(res: Response, limit: number): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const room = limit - total;
    if (value.byteLength > room) {
      // Keep the part that fits (a single large chunk must not be dropped whole).
      if (room > 0) chunks.push(value.subarray(0, room));
      await reader.cancel();
      break;
    }
    total += value.byteLength;
    chunks.push(value);
  }
  const buf = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "...",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|td|th)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Same idea as databank/scripts/verify_quotes.py: ignore whitespace,
// quote-style and dash-style differences, nothing else.
export function normalise(text: string): string {
  return text
    .replace(/[‘’‚‛′`]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteAppears(quote: string, pageText: string): boolean {
  const q = normalise(quote);
  if (q.length < MIN_QUOTE_CHARS) return false;
  return normalise(pageText).includes(q);
}

export type VerifyResult =
  | { status: "verified" }
  | { status: "unverified"; reason: string };

export async function verifyQuoteOnPage(rawUrl: string, quote: string): Promise<VerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = await assertPublicHttpsUrl(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "ScholarPath-verifier/1.0", accept: "text/html,text/plain" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return { status: "unverified", reason: "redirect_without_location" };
        // Re-check every hop: a public page must not redirect us to a private address.
        current = await assertPublicHttpsUrl(new URL(loc, current).toString());
        continue;
      }
      if (!res.ok) return { status: "unverified", reason: `http_${res.status}` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) {
        return { status: "unverified", reason: "not_a_web_page" }; // e.g. PDF
      }
      const body = await readLimited(res, MAX_BYTES);
      const text = /html/i.test(type) ? htmlToText(body) : body;
      return quoteAppears(quote, text)
        ? { status: "verified" }
        : { status: "unverified", reason: "quote_not_found" };
    }
    return { status: "unverified", reason: "too_many_redirects" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "fetch_failed";
    return { status: "unverified", reason: controller.signal.aborted ? "timeout" : msg };
  } finally {
    clearTimeout(timer);
  }
}

"use client";

// "Search the web for more scholarships" button + results section.
// Placed under the results list: <WebSearchResults profile={profile} />
import { useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Globe, HelpCircle, Search } from "lucide-react";
import type { WebResult } from "@/lib/web-search/search";

type State = "idle" | "loading" | "done" | "error";

export function WebSearchResults({ profile }: { profile: Record<string, string> | null }) {
  const [state, setState] = useState<State>("idle");
  const [results, setResults] = useState<WebResult[]>([]);
  const [message, setMessage] = useState("");
  const running = useRef(false);

  async function search() {
    if (!profile || running.current) return;
    running.current = true;
    setState("loading");
    setMessage("");
    setResults([]);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    try {
      const res = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error ?? "We could not search the web right now.");
        setState("error");
        return;
      }
      setResults(Array.isArray(data.results) ? data.results : []);
      setMessage(data.note ?? "");
      setState("done");
    } catch {
      setMessage("The web search took too long. Please try again.");
      setState("error");
    } finally {
      clearTimeout(timer);
      running.current = false;
    }
  }

  return (
    <section aria-labelledby="web-search-title" className="mt-12" data-testid="web-search">
      <h2 id="web-search-title" className="font-display text-2xl font-semibold">
        Found on the web (not in our data bank)
      </h2>
      <p className="mt-2 max-w-2xl text-muted">
        We search official pages for more schemes that may fit you, then check the quoted rule
        against the page ourselves. Confirm on the official portal.
      </p>

      <button
        type="button"
        onClick={search}
        disabled={!profile || state === "loading"}
        className="btn-secondary mt-4"
        data-testid="web-search-button"
      >
        <Search size={18} aria-hidden="true" />
        {state === "loading" ? "Searching…" : "Search the web for more scholarships"}
      </button>
      {!profile && (
        <p className="mt-2 text-sm text-muted">Please fill in your profile first.</p>
      )}

      <div aria-live="polite" className="mt-4" data-testid="web-search-status">
        {state === "loading" && (
          <p role="status" className="text-brand">
            Searching official pages. This can take up to 30 seconds.
          </p>
        )}
        {state === "error" && (
          <p role="alert" className="rounded-lg bg-status-amberBg p-4 text-status-amber">
            {message} Your results above are still valid.
          </p>
        )}
        {state === "done" && results.length === 0 && (
          <p className="text-muted">
            {message || "No new official pages found for your profile this time."}
          </p>
        )}
      </div>

      {results.length > 0 && (
        <ul className="mt-4 space-y-4">
          {results.map((r) => (
            <li key={r.official_url} className="card p-5 sm:p-6" data-testid="web-result" data-verified={r.verification}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-greyBg px-3 py-1.5 text-sm font-semibold text-status-grey">
                  <Globe size={16} aria-hidden="true" /> Possible match
                </span>
                {r.verification === "verified" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-greenBg px-3 py-1.5 text-sm font-semibold text-status-green">
                    <CheckCircle2 size={16} aria-hidden="true" /> Rule checked on source
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-amberBg px-3 py-1.5 text-sm font-semibold text-status-amber">
                    <HelpCircle size={16} aria-hidden="true" /> Couldn&apos;t verify the rule. Check the official page before applying
                  </span>
                )}
              </div>
              <p className="mt-4 text-sm text-muted">{r.provider || r.host}</p>
              <h3 className="mt-1 font-display text-xl font-semibold">{r.name}</h3>
              {r.why && <p className="mt-2">{r.why}</p>}
              <blockquote className="mt-3 border-l-2 border-line pl-3 text-muted">“{r.quote}”</blockquote>
              {r.deadline_text && (
                <p className="mt-2 text-sm text-muted">Deadline on the page: {r.deadline_text}</p>
              )}
              <a
                href={r.official_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-link mt-3"
              >
                Open official page ({r.host})
                <ExternalLink size={16} aria-hidden="true" />
                <span className="sr-only">Opens in a new tab</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

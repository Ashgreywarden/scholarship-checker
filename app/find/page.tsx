"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ProfileForm from "@/components/ProfileForm";
import SchemeCard from "@/components/SchemeCard";
import type { SchemesPayload } from "@/lib/databank/types";
import { matchAll, type MatchVerdict } from "@/lib/match/engine";
import type { SchemeStatus } from "@/lib/match/status";
import { EMPTY_PROFILE_INPUT, parseProfileInput, type ProfileInput } from "@/lib/profileInput";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; payload: SchemesPayload };

type VerdictFilter = MatchVerdict | "all";
type StatusFilter = "all" | "open" | "no_date" | "closed";

const PAGE = 20;

const VERDICT_LABEL: Record<MatchVerdict, string> = {
  eligible: "Likely eligible",
  cant_tell: "Can't tell",
  not_eligible: "Not eligible",
};

function statusGroup(s: SchemeStatus, basis: string): StatusFilter {
  if (s === "open") return basis === "date" ? "open" : "no_date";
  if (s === "unknown") return "no_date";
  return "closed"; // closed or stale
}

export default function FindPage() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [input, setInput] = useState<ProfileInput>(EMPTY_PROFILE_INPUT);
  const [searched, setSearched] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("eligible");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/schemes")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? "Could not load the scholarship data bank.");
        if (!cancelled) setLoad({ kind: "ready", payload: data as SchemesPayload });
      })
      .catch((e) => {
        if (!cancelled)
          setLoad({ kind: "error", message: e instanceof Error ? e.message : "Could not load the scholarship data bank." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { profile, problems } = useMemo(() => parseProfileInput(input), [input]);

  // Matching is plain code in the browser: your answers never leave your device
  // and no AI is involved.
  const matches = useMemo(
    () =>
      searched && load.kind === "ready"
        ? matchAll(load.payload.schemes, profile, new Date())
        : [],
    [searched, load, profile],
  );

  const counts = useMemo(() => {
    const c: Record<MatchVerdict, number> = { eligible: 0, cant_tell: 0, not_eligible: 0 };
    for (const m of matches) c[m.verdict]++;
    return c;
  }, [matches]);

  const filtered = useMemo(
    () =>
      matches.filter(
        (m) =>
          (verdictFilter === "all" || m.verdict === verdictFilter) &&
          (statusFilter === "all" || statusGroup(m.status.status, m.status.basis) === statusFilter),
      ),
    [matches, verdictFilter, statusFilter],
  );

  function find() {
    if (load.kind !== "ready") return;
    setSearched(true);
    setShown(PAGE);
    // If nothing is "likely eligible", show the next best group instead of an empty list.
    const eligible = matchAll(load.payload.schemes, profile, new Date()).filter((m) => m.verdict === "eligible").length;
    setVerdictFilter(eligible > 0 ? "eligible" : "cant_tell");
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const total = load.kind === "ready" ? load.payload.schemes.length : 0;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Find my scholarships</h1>
        <p className="mt-2 text-slate-600">
          Answer a few questions and see which of {total > 0 ? total : "our"} Indian scholarships you may qualify for, by the published rules. Every rule shows the official quote.
        </p>
      </header>

      <form
        className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <h2 className="text-lg font-semibold">Your details</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Skip anything you are not sure about. Matching happens in your browser; your answers are never sent anywhere.
        </p>
        <ProfileForm value={input} onChange={setInput} problems={problems} showExtras />
        <button
          type="submit"
          disabled={load.kind !== "ready"}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:bg-indigo-400 sm:w-auto"
        >
          {load.kind === "loading" ? "Loading scholarships…" : "Find my scholarships"}
        </button>
        {load.kind === "error" && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {load.message}
          </p>
        )}
      </form>

      <div ref={resultsRef} className="scroll-mt-4 pt-6" aria-live="polite">
        {searched && load.kind === "ready" && (
          <section aria-labelledby="results-heading">
            <h2 id="results-heading" className="text-lg font-semibold">
              Results
            </h2>
            <p className="mt-1 text-sm text-slate-600" data-testid="disclaimer">
              &ldquo;Likely eligible&rdquo; means likely eligible by the published rules. Confirm on the official portal before you apply. It is not a promise of an award.
            </p>

            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by verdict">
              {(["eligible", "cant_tell", "not_eligible", "all"] as const).map((k) => {
                const n = k === "all" ? matches.length : counts[k];
                const on = verdictFilter === k;
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    data-testid={`chip-${k}`}
                    onClick={() => {
                      setVerdictFilter(k);
                      setShown(PAGE);
                    }}
                    className={`h-10 rounded-full border px-4 text-sm font-medium ${
                      on
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {k === "all" ? "All" : VERDICT_LABEL[k]} ({n})
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <label htmlFor="statusFilter" className="mr-2 text-sm text-slate-700">
                Deadline:
              </label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setShown(PAGE);
                }}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="all">Any</option>
                <option value="open">Open with a closing date</option>
                <option value="no_date">Open or unknown, no closing date</option>
                <option value="closed">Closed or from an older cycle</option>
              </select>
            </div>

            <p className="mt-4 text-sm text-slate-600" data-testid="shown-count">
              Showing {Math.min(shown, filtered.length)} of {filtered.length}
            </p>
            <div className="mt-3 space-y-4">
              {filtered.slice(0, shown).map((m) => (
                <SchemeCard key={m.scheme.id} match={m} />
              ))}
              {filtered.length === 0 && (
                <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Nothing in this group. Try another filter above.
                </p>
              )}
            </div>
            {filtered.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="mt-4 h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Show {Math.min(PAGE, filtered.length - shown)} more
              </button>
            )}
          </section>
        )}
      </div>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Always confirm on the official portal.</p>
        <p className="mt-1">
          Rules come from the official sources listed in our data bank and may have changed. We compare only what you tell us; rules about things we don&apos;t ask are marked &ldquo;Can&apos;t tell&rdquo;.
        </p>
      </footer>
    </main>
  );
}

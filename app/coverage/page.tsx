"use client";

import { useEffect, useMemo, useState } from "react";
import type { SchemesPayload } from "@/lib/databank/types";
import { computeCoverage, levelTotals, PROVIDER_TYPE_LABELS, type CountRow } from "@/lib/match/coverage";

type Load =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; payload: SchemesPayload };

function Stat({ value, label, testid }: { value: string | number; label: string; testid?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl" data-testid={testid}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      <p className="mt-1 text-sm text-slate-600">{label}</p>
    </div>
  );
}

// A list of horizontal bars. All bars share one colour: position and the number
// carry the meaning, not hue.
function Bars({
  title,
  rows,
  total,
  color = "bg-indigo-600",
  testid,
}: {
  title: string;
  rows: CountRow[];
  total: number;
  color?: string;
  testid: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section
      aria-labelledby={`${testid}-h`}
      data-testid={testid}
      className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
    >
      <h2 id={`${testid}-h`} className="text-base font-semibold text-slate-900">
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
            <span className="truncate text-slate-700" title={r.key}>
              {r.key}
            </span>
            <span className="h-3 overflow-hidden rounded-full bg-slate-100">
              <span
                className={`block h-full rounded-full ${color}`}
                style={{ width: `${Math.max(3, (r.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-14 text-right tabular-nums text-slate-900">
              {r.count} <span className="text-xs text-slate-500">({Math.round((r.count / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function CoveragePage() {
  const [load, setLoad] = useState<Load>({ kind: "loading" });

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

  const view = useMemo(() => {
    if (load.kind !== "ready") return null;
    const today = new Date();
    return { today, c: computeCoverage(load.payload.schemes, today) };
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:pt-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">What the data bank covers</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Indian scholarships for undergraduate and postgraduate students, read from official sources. Every rule carries the exact quote from the official text.
        </p>
      </header>

      {load.kind === "loading" && <p className="mt-8 text-slate-600">Loading…</p>}
      {load.kind === "error" && (
        <p role="alert" className="mt-8 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {load.message}
        </p>
      )}

      {load.kind === "ready" && view && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat value={view.c.total} label="Indian scholarships" testid="total" />
            <Stat value={view.c.byStatus.open} label="open now (by today's date)" testid="open-now" />
            <Stat
              value={`${view.c.rulesWithQuote} / ${view.c.rulesTotal}`}
              label="eligibility rules with an official quote"
              testid="quotes"
            />
            <Stat value={view.c.documentsListed} label="required documents listed" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Bars
              title="By provider type"
              testid="by-provider"
              total={view.c.total}
              rows={view.c.byProviderType.map((r) => ({ ...r, key: PROVIDER_TYPE_LABELS[r.key] ?? r.key }))}
            />
            <Bars
              title="By level"
              testid="by-level"
              total={view.c.total}
              rows={[
                { key: "Undergraduate (UG)", count: levelTotals(view.c).ug },
                { key: "Postgraduate (PG)", count: levelTotals(view.c).pg },
                { key: "Both UG and PG", count: view.c.byLevel.both },
              ]}
            />
            <Bars
              title="By status, as of today"
              testid="by-status"
              total={view.c.total}
              color="bg-emerald-600"
              rows={[
                { key: "Open", count: view.c.byStatus.open },
                { key: "No closing date published", count: view.c.byStatus.unknown },
                { key: "Closed", count: view.c.byStatus.closed },
                { key: "Stale (older cycle)", count: view.c.byStatus.stale },
              ]}
            />
            <Bars title="By state" testid="by-state" total={view.c.total} rows={view.c.byState} />
          </div>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 sm:p-5">
            <h2 className="text-base font-semibold text-slate-900">How to read this</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Open</strong>: the closing date is today or later, or the source says applications are open and gives no date.
                <strong> Closed</strong>: the closing date passed within the last year, or the source says closed.
                <strong> Stale</strong>: the date is more than a year old, so it belongs to an older cycle.
              </li>
              <li>
                {view.c.byLevel.both} schemes take both UG and PG students, so the level bars add up to more than {view.c.total}.
              </li>
              <li>
                Status is worked out in code from each closing date and today&apos;s date ({view.today.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}).
                Rules last verified against the official text on {view.c.latestVerified ?? "an unknown date"}.
              </li>
              <li>
                {load.payload.totals.hiddenAbroad} scholarships for study abroad are in the data bank but hidden for now.
              </li>
              {load.payload.register && (
                <li>
                  National Scholarship Portal 2026-27 register: {load.payload.register.rows} central schemes listed,{" "}
                  {load.payload.register.renewalOnly} of them renewal-only this cycle.
                </li>
              )}
              {load.payload.problems.length > 0 && (
                <li className="text-red-800">
                  {load.payload.problems.length} data files could not be read: {load.payload.problems.map((p) => p.file).join(", ")}.
                </li>
              )}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

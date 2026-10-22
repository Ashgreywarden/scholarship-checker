"use client";

import { useId } from "react";
import type { DeadlineRow, DocumentRow } from "@/lib/types";
import { parseIsoDate } from "@/lib/normalize";
import { tidyQuoteForDisplay } from "@/lib/verifyQuote";

function FlagNote() {
  return (
    <p
      data-testid="flag"
      className="mt-1 rounded-md border border-orange-300 bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900"
    >
      ⚠ Quote not found in your text. Not counted.
    </p>
  );
}

export function Documents({
  documents,
  have,
  onToggle,
}: {
  documents: DocumentRow[];
  have: Set<number>;
  onToggle: (index: number) => void;
}) {
  const base = useId();
  const counted = documents.filter((d) => d.quoteVerified);
  const stillNeeded = documents.filter((d, i) => d.quoteVerified && !have.has(i)).length;

  return (
    <section aria-labelledby="docs-heading">
      <h2 id="docs-heading" className="text-lg font-semibold">
        Documents you need
      </h2>
      {documents.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No documents were listed in the text you pasted. Check the official site.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm font-medium text-slate-700" data-testid="docs-summary">
            {counted.length === 0
              ? "No documents could be confirmed from your text."
              : stillNeeded === 0
                ? `You have all ${counted.length} documents.`
                : `${stillNeeded} of ${counted.length} documents still needed`}
          </p>
          <ul className="mt-3 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {documents.map((d, i) => {
              const id = `${base}-doc-${i}`;
              return (
                <li
                  key={i}
                  data-testid="document"
                  className={`px-4 py-3 ${d.quoteVerified ? "" : "bg-orange-50"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={id}
                      type="checkbox"
                      disabled={!d.quoteVerified}
                      checked={d.quoteVerified && have.has(i)}
                      onChange={() => onToggle(i)}
                      className="mt-1 h-5 w-5 shrink-0 accent-indigo-600"
                    />
                    <div className="min-w-0 text-sm">
                      <label htmlFor={id} className="font-medium text-slate-900">
                        {d.name}
                        <span className="ml-2 text-xs font-normal text-slate-500">I have this</span>
                      </label>
                      {!d.quoteVerified && <FlagNote />}
                      <p
                        data-testid="source"
                        className={`mt-1 text-xs ${d.quoteVerified ? "text-slate-500" : "text-orange-800"}`}
                      >
                        Source: <span className="italic">&ldquo;{tidyQuoteForDisplay(d.quote)}&rdquo;</span>
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

function formatDate(iso: string | null): string | null {
  // (shown only for dates read by code from the quoted line)
  const d = parseIsoDate(iso);
  return d
    ? d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : null;
}

export function Deadlines({ deadlines }: { deadlines: DeadlineRow[] }) {
  return (
    <section aria-labelledby="deadline-heading">
      <h2 id="deadline-heading" className="text-lg font-semibold">
        Deadline
      </h2>
      {deadlines.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          No deadline was found in the text you pasted. Check the official site.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {deadlines.map((d, i) => {
            const date = formatDate(d.dateIso);
            return (
              <li
                key={i}
                data-testid="deadline"
                className={`rounded-2xl border p-4 ${
                  d.quoteVerified ? "border-slate-200 bg-white" : "border-orange-200 bg-orange-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{d.label}</p>
                  {d.quoteVerified && date && d.dateIso && (
                    <span className="text-sm text-slate-700" data-testid="deadline-date">
                      {date}
                    </span>
                  )}
                  <span
                    data-testid="deadline-status"
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      !d.quoteVerified || !d.dateIso
                        ? "bg-orange-100 text-orange-900"
                        : d.closed
                          ? "bg-red-100 text-red-900"
                          : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
                {!d.quoteVerified && <FlagNote />}
                {d.dateNote && (
                  <p
                    data-testid="date-note"
                    className="mt-2 rounded-md border border-orange-300 bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900"
                  >
                    ⚠ {d.dateNote}
                  </p>
                )}
                <blockquote
                  className={`mt-2 border-l-4 pl-3 text-sm italic text-slate-600 ${
                    d.quoteVerified ? "border-slate-300" : "border-orange-400"
                  }`}
                >
                  &ldquo;{d.quote}&rdquo;
                </blockquote>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

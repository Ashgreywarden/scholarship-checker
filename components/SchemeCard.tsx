"use client";

import { useId, useState } from "react";
import { ChevronDown, ExternalLink, FileCheck2 } from "lucide-react";
import { formatDate, officialUrl } from "@/lib/ui/format";
import { PROVIDER_LABELS } from "@/lib/ui/adapters";
import type { Scheme } from "@/lib/ui/types";
import { RuleRow } from "./RuleRow";
import { StatusBadge } from "./StatusBadge";

function Quote({ text, flagged = false }: { text: string | null; flagged?: boolean }) {
  if (!text) return null;
  return (
    <blockquote
      className={`mt-1 whitespace-pre-line border-l-2 pl-3 text-sm text-muted ${
        flagged ? "border-accent" : "border-line"
      }`}
    >
      “{text}”
    </blockquote>
  );
}

export function SchemeCard({
  scheme,
  initiallyExpanded = false,
  insight,
}: {
  scheme: Scheme;
  initiallyExpanded?: boolean;
  // A short reason this scheme fits the student, plus one thing to confirm.
  insight?: { why: string; confirm: string };
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [have, setHave] = useState<Set<number>>(new Set());
  const id = useId();
  const titleId = `${id}-title`;
  const panelId = `${id}-panel`;

  const applyUrl = officialUrl(scheme.apply_url);
  const sourceUrl = officialUrl(scheme.source_url);
  const status = scheme.deadline.status;
  const canApply = Boolean(applyUrl) && status !== "closed";

  const counted = scheme.documents.filter((d) => d.verified);
  const stillNeeded = scheme.documents.filter((d, i) => d.verified && !have.has(i)).length;

  function toggleDoc(index: number) {
    setHave((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <article
      className="card overflow-hidden"
      aria-labelledby={titleId}
      data-testid="scheme-card"
      data-id={scheme.id}
      data-verdict={scheme.verdict}
      data-status={status}
    >
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={scheme.verdict} kind="verdict" />
          <StatusBadge status={status} kind="deadline" />
        </div>

        <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row">
          <div className="min-w-0">
            <p className="text-sm text-muted">
              {scheme.provider}
              {scheme.provider_type !== "notice" && (
                <> · {PROVIDER_LABELS[scheme.provider_type]}</>
              )}
              {scheme.states.length > 0 && <> · {scheme.states.join(", ")}</>}
            </p>
            <h2
              id={titleId}
              className="mt-1 font-display text-xl font-semibold sm:text-2xl"
            >
              {scheme.name}
            </h2>
          </div>

          <div className="sm:max-w-64 sm:text-right">
            <p className="line-clamp-3 text-base font-semibold text-brand" data-testid="amount">
              {scheme.amount.text}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted" data-testid="deadline">
              Deadline:{" "}
              {scheme.deadline.date ? formatDate(scheme.deadline.date) : scheme.deadline.text}
            </p>
          </div>
        </div>

        {insight && (
          <div
            className="mt-4 rounded-xl border border-brand/25 bg-brand-light p-3"
            data-testid="insight"
          >
            <p className="text-sm font-semibold text-brand">Why it fits you</p>
            <p className="mt-0.5 text-ink" data-testid="why-it-fits">
              {insight.why}
            </p>
            {insight.confirm && (
              <p className="mt-1 text-sm text-muted" data-testid="to-confirm">
                <span className="font-semibold">To confirm:</span> {insight.confirm}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 rounded-xl bg-paper p-3">
          <p className="text-sm text-ink" data-testid="reason">
            {scheme.summary.text}
          </p>
          <Quote text={scheme.summary.quote} />
          {!scheme.summary.quote && scheme.summary.sourceNote && (
            <p className="mt-1 text-sm text-muted">
              Source: {scheme.summary.sourceNote} (no direct quote)
            </p>
          )}
          {scheme.verdict === "eligible" && (
            <p className="mt-2 text-sm font-semibold text-status-green" data-testid="confirm-note">
              Likely eligible by the published rules. Confirm on the official portal.
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {canApply ? (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              data-testid="apply"
            >
              Apply on official portal
              <ExternalLink size={17} aria-hidden="true" />
              <span className="sr-only">Opens in a new tab</span>
            </a>
          ) : (
            <button type="button" disabled className="btn-primary">
              {status === "closed" ? "Applications closed" : "Official link unavailable"}
            </button>
          )}

          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              Read official source
              <ExternalLink size={16} aria-hidden="true" />
              <span className="sr-only">Opens in a new tab</span>
            </a>
          ) : (
            <p className="text-sm text-muted">Verify on the official portal before applying.</p>
          )}
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
          className="mt-4 flex min-h-11 w-full items-center justify-between gap-3
            rounded-lg text-left font-semibold text-brand"
        >
          {expanded
            ? "Hide rules and documents"
            : `See rules and documents (${scheme.rules.length} rules)`}
          <ChevronDown
            size={20}
            aria-hidden="true"
            className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      <div id={panelId} hidden={!expanded}>
        {expanded && (
          <div className="animate-enter border-t border-line bg-paper/60 p-5 sm:p-6">
            <h3 className="font-semibold">How your profile fits</h3>

            <ul className="relative mt-2">
              <span
                aria-hidden="true"
                className="absolute bottom-8 left-[17px] top-8 w-px bg-line"
              />
              {scheme.rules.map((rule, index) => (
                <RuleRow key={`${rule.label}-${index}`} rule={rule} />
              ))}
            </ul>

            {scheme.amount.quote && (
              <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                <h3 className="font-semibold">Amount</h3>
                <p className="mt-1 text-muted">{scheme.amount.text}</p>
                <Quote text={scheme.amount.quote} />
              </div>
            )}

            {scheme.deadlines && scheme.deadlines.length > 0 && (
              <div className="mt-4 rounded-2xl border border-line bg-white p-4">
                <h3 className="font-semibold">Deadline details</h3>
                <ul className="mt-2 space-y-3">
                  {scheme.deadlines.map((line, index) => (
                    <li key={index} data-testid="deadline-line">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{line.label}</span>
                        {line.date && !line.flagged && (
                          <span className="text-sm text-muted">{formatDate(line.date)}</span>
                        )}
                        <StatusBadge status={line.status} />
                      </div>
                      <p className="mt-1 text-sm text-muted">{line.text}</p>
                      {line.flagged && (
                        <p
                          data-testid="flag"
                          className="mt-1 rounded-lg border border-accent bg-status-amberBg px-3 py-2 text-sm font-semibold text-status-amber"
                        >
                          ⚠ Quote not found in your text. Not counted.
                        </p>
                      )}
                      {line.note && (
                        <p
                          data-testid="date-note"
                          className="mt-1 rounded-lg border border-accent bg-status-amberBg px-3 py-2 text-sm font-semibold text-status-amber"
                        >
                          ⚠ {line.note}
                        </p>
                      )}
                      <Quote text={line.quote} flagged={line.flagged} />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-line bg-white p-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <FileCheck2 size={19} aria-hidden="true" />
                Documents to keep ready
              </h3>
              {scheme.documents.length ? (
                <>
                  <p className="mt-1 text-sm font-medium text-muted" data-testid="docs-summary">
                    {counted.length === 0
                      ? "No documents could be confirmed from the text."
                      : stillNeeded === 0
                        ? `You have all ${counted.length} documents.`
                        : `${stillNeeded} of ${counted.length} documents still needed`}
                  </p>
                  <ul className="mt-3 divide-y divide-line">
                    {scheme.documents.map((doc, index) => {
                      const boxId = `${id}-doc-${index}`;
                      return (
                        <li key={`${doc.name}-${index}`} className="flex items-start gap-3 py-3" data-testid="document">
                          <input
                            id={boxId}
                            type="checkbox"
                            disabled={!doc.verified}
                            checked={doc.verified && have.has(index)}
                            onChange={() => toggleDoc(index)}
                            className="mt-1 size-5 shrink-0 accent-brand"
                          />
                          <div className="min-w-0">
                            <label htmlFor={boxId} className="font-medium">
                              {doc.name}
                              <span className="ml-2 text-sm font-normal text-muted">I have this</span>
                            </label>
                            {!doc.verified && (
                              <p
                                data-testid="flag"
                                className="mt-1 rounded-lg border border-accent bg-status-amberBg px-3 py-2 text-sm font-semibold text-status-amber"
                              >
                                ⚠ Quote not found in your text. Not counted.
                              </p>
                            )}
                            {doc.quote && (
                              <p className="mt-0.5 text-sm text-muted" data-testid="source">
                                Source: <span className="italic">“{doc.quote}”</span>
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-muted">Check the official notice for the document list.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

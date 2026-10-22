import { PROVIDER_TYPE_LABELS } from "@/lib/match/coverage";
import type { MatchRow, MatchVerdict, SchemeMatch } from "@/lib/match/engine";
import type { SchemeStatus } from "@/lib/match/status";

const VERDICT: Record<MatchVerdict, { text: string; cls: string }> = {
  eligible: { text: "Likely eligible", cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  cant_tell: { text: "Can't tell", cls: "bg-amber-100 text-amber-900 border-amber-300" },
  not_eligible: { text: "Not eligible", cls: "bg-red-100 text-red-900 border-red-300" },
};

const STATUS_CLS: Record<SchemeStatus, string> = {
  open: "bg-emerald-50 text-emerald-800 border-emerald-200",
  closed: "bg-red-50 text-red-800 border-red-200",
  stale: "bg-orange-50 text-orange-800 border-orange-200",
  unknown: "bg-slate-100 text-slate-700 border-slate-200",
};

const ROW_PILL: Record<string, string> = {
  pass: "bg-emerald-100 text-emerald-900",
  fail: "bg-red-100 text-red-900",
  unknown: "bg-slate-200 text-slate-800",
};

function Quote({ quote, note }: { quote: string | null; note?: string | null }) {
  if (!quote) {
    return note ? <p className="mt-1 text-xs text-slate-500">Source: {note} (no direct quote)</p> : null;
  }
  return (
    <blockquote className="mt-1 whitespace-pre-line border-l-4 border-slate-300 pl-3 text-xs italic text-slate-600 sm:text-sm">
      &ldquo;{quote}&rdquo;
    </blockquote>
  );
}

function RowItem({ row }: { row: MatchRow }) {
  const pill = !row.checkable ? "Also check" : row.status === "pass" ? "Pass" : row.status === "fail" ? "Fail" : "Can't tell";
  const cls = !row.checkable ? "bg-slate-100 text-slate-700" : ROW_PILL[row.status];
  return (
    <li className="px-3 py-2" data-testid="rule-row">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{pill}</span>
        <span className="text-sm font-medium text-slate-900">{row.label}</span>
      </div>
      <p className="mt-1 text-sm text-slate-700">{row.explanation}</p>
      <Quote quote={row.quote} note={row.sourceNote} />
    </li>
  );
}

function safeUrl(u: string): string | null {
  return /^https?:\/\//i.test(u) ? u : null;
}

export default function SchemeCard({ match }: { match: SchemeMatch }) {
  const { scheme, verdict, reason, deciding, rows, status } = match;
  const v = VERDICT[verdict];
  const apply = safeUrl(scheme.apply_url);
  const where = scheme.state ?? "All India";
  const levels = scheme.level.join(" · ");
  const checked = rows.filter((r) => r.checkable);
  const alsoCheck = rows.filter((r) => !r.checkable);

  return (
    <article
      data-testid="scheme-card"
      data-verdict={verdict}
      data-status={status.status}
      data-id={scheme.id}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span data-testid="verdict" className={`rounded-full border px-3 py-1 text-sm font-bold ${v.cls}`}>
          {v.text}
        </span>
        <span
          data-testid="status"
          className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_CLS[status.status]}`}
        >
          {status.label}
        </span>
      </div>

      <h3 className="mt-3 text-base font-semibold leading-snug text-slate-900 sm:text-lg">{scheme.name}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {scheme.provider} · {PROVIDER_TYPE_LABELS[scheme.provider_type] ?? scheme.provider_type} · {where} · {levels}
      </p>

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-sm text-slate-800" data-testid="reason">
          {reason}
        </p>
        {deciding && <Quote quote={deciding.quote} note={deciding.sourceNote} />}
        {verdict === "eligible" && (
          <p className="mt-2 text-xs font-medium text-emerald-800" data-testid="confirm-note">
            Likely eligible by the published rules. Confirm on the official portal.
          </p>
        )}
      </div>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Amount</dt>
          <dd className="mt-0.5 text-slate-800" data-testid="amount">
            {scheme.amount.text || "Not stated"}
          </dd>
          <Quote quote={scheme.amount.quote.trim() || null} />
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Deadline</dt>
          <dd className="mt-0.5 text-slate-800" data-testid="deadline">
            {scheme.deadline.date ? `${scheme.deadline.date}. ` : ""}
            {scheme.deadline.text || "Not stated"}
          </dd>
          <Quote quote={scheme.deadline.quote.trim() || null} />
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {apply ? (
          <a
            href={apply}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="apply"
            className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Official apply link ↗
          </a>
        ) : (
          <span className="text-sm text-slate-500">No official apply link in the data bank</span>
        )}
        <span className="text-xs text-slate-500">Always confirm on the official portal.</span>
      </div>

      <details className="mt-4 rounded-xl border border-slate-200">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-indigo-800">
          All rules and quotes ({rows.length})
        </summary>
        <ul className="divide-y divide-slate-200 border-t border-slate-200">
          {checked.map((r, i) => (
            <RowItem key={`c${i}`} row={r} />
          ))}
          {alsoCheck.map((r, i) => (
            <RowItem key={`a${i}`} row={r} />
          ))}
        </ul>
      </details>
    </article>
  );
}

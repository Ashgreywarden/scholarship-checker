import type { EvaluatedRow } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/vocab";

function rank(r: EvaluatedRow): number {
  if (!r.quoteVerified) return 5;
  if (r.status === "fail") return 0;
  if (r.status === "pass") return 1;
  return r.unknownKind === "manual" ? 4 : 3;
}

function Pill({ row }: { row: EvaluatedRow }) {
  let text = "Can't tell";
  let cls = "bg-slate-200 text-slate-800";
  if (!row.quoteVerified) {
    text = "Not counted";
    cls = "bg-orange-100 text-orange-900";
  } else if (row.status === "pass") {
    text = "Pass";
    cls = "bg-emerald-100 text-emerald-900";
  } else if (row.status === "fail") {
    text = "Fail";
    cls = "bg-red-100 text-red-900";
  }
  return (
    <span
      data-testid="status"
      className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {text}
    </span>
  );
}

export default function CriteriaTable({ rows }: { rows: EvaluatedRow[] }) {
  const sorted = [...rows].sort((a, b) => rank(a) - rank(b));
  return (
    <section aria-labelledby="criteria-heading">
      <h2 id="criteria-heading" className="text-lg font-semibold">
        Rules found in the notice
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Each rule shows the exact line from the text you pasted.
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[110px_1fr_1.3fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Result</span>
          <span>What it means for you</span>
          <span>Quoted line from your text</span>
        </div>
        <ul className="divide-y divide-slate-200">
          {sorted.map((r) => (
            <li
              key={r.criterion.id}
              data-testid="criterion"
              data-status={r.quoteVerified ? r.status : "flagged"}
              className={`grid grid-cols-1 gap-2 px-4 py-3 md:grid-cols-[110px_1fr_1.3fr] md:gap-4 ${
                r.quoteVerified ? "" : "bg-orange-50"
              }`}
            >
              <div>
                <Pill row={r} />
              </div>
              <div className="text-sm">
                <p className="font-medium text-slate-900">
                  {r.criterion.field === "none" || r.criterion.operator === "judgement"
                    ? "Check this yourself"
                    : FIELD_LABELS[r.criterion.field]}
                </p>
                <p className="mt-0.5 text-slate-600">{r.explanation}</p>
              </div>
              <div className="text-sm">
                {!r.quoteVerified && (
                  <p
                    data-testid="flag"
                    className="mb-1 rounded-md border border-orange-300 bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900"
                  >
                    ⚠ Quote not found in your text. Not counted.
                  </p>
                )}
                <blockquote
                  className={`border-l-4 pl-3 italic text-slate-700 ${
                    r.quoteVerified ? "border-slate-300" : "border-orange-400"
                  }`}
                >
                  &ldquo;{r.criterion.quote}&rdquo;
                </blockquote>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

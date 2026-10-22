import type { EvaluatedRow, Verdict, VerdictResult } from "@/lib/types";
import { FIELD_LABELS } from "@/lib/vocab";

const STYLE: Record<Verdict, { box: string; icon: string; iconBg: string }> = {
  eligible: {
    box: "border-emerald-300 bg-emerald-50 text-emerald-950",
    icon: "✓",
    iconBg: "bg-emerald-600",
  },
  not_eligible: {
    box: "border-red-300 bg-red-50 text-red-950",
    icon: "✕",
    iconBg: "bg-red-600",
  },
  passes_checkable: {
    box: "border-sky-300 bg-sky-50 text-sky-950",
    icon: "✓",
    iconBg: "bg-sky-600",
  },
  cant_tell: {
    box: "border-amber-300 bg-amber-50 text-amber-950",
    icon: "?",
    iconBg: "bg-amber-500",
  },
};

export default function VerdictCard({
  verdict,
  rows,
  scholarshipName,
}: {
  verdict: VerdictResult;
  rows: EvaluatedRow[];
  scholarshipName: string | null;
}) {
  const s = STYLE[verdict.verdict];
  const failed = rows.filter((r) => r.quoteVerified && r.status === "fail");

  return (
    <section
      aria-labelledby="verdict-heading"
      className={`rounded-2xl border-2 p-4 sm:p-6 ${s.box}`}
    >
      {scholarshipName && (
        <p className="text-sm font-medium opacity-80">{scholarshipName}</p>
      )}
      <div className="mt-1 flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white ${s.iconBg}`}
        >
          {s.icon}
        </span>
        <h2 id="verdict-heading" data-testid="verdict" className="text-2xl font-bold leading-tight">
          {verdict.headline}
        </h2>
      </div>
      <p className="mt-2 text-sm" data-testid="verdict-subtitle">
        {verdict.subtitle}
      </p>

      {failed.length > 0 && (
        <ul className="mt-4 space-y-3" data-testid="failed-rules">
          {failed.map((r) => (
            <li key={r.criterion.id} className="rounded-xl bg-white/70 p-3 text-sm">
              <p className="font-semibold">
                {FIELD_LABELS[r.criterion.field]}: {r.explanation}
              </p>
              <blockquote className="mt-2 border-l-4 border-red-400 pl-3 italic">
                &ldquo;{r.criterion.quote}&rdquo;
              </blockquote>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

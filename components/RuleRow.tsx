import { Check, CircleAlert, HelpCircle, Info, X } from "lucide-react";
import type { Rule } from "@/lib/ui/types";

const ruleStyles = {
  pass: {
    Icon: Check,
    label: "Rule met",
    color: "bg-status-greenBg text-status-green",
  },
  fail: {
    Icon: X,
    label: "Rule not met",
    color: "bg-status-redBg text-status-red",
  },
  unknown: {
    Icon: HelpCircle,
    label: "Can't tell",
    color: "bg-status-amberBg text-status-amber",
  },
} as const;

export function RuleRow({ rule }: { rule: Rule }) {
  const base = rule.note
    ? { Icon: Info, label: "Also check", color: "bg-status-greyBg text-status-grey" }
    : rule.flagged
      ? { Icon: CircleAlert, label: "Not counted", color: "bg-status-amberBg text-status-amber" }
      : ruleStyles[rule.result];
  const { Icon, label, color } = base;

  return (
    <li className="relative flex gap-4 py-4" data-testid="rule-row" data-result={rule.flagged ? "flagged" : rule.result}>
      <span
        className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ${color}`}
      >
        <Icon size={19} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </span>

      <div className="min-w-0">
        <p className="font-semibold">{rule.label}</p>
        <p className="text-sm text-muted">{label}</p>
        {rule.explanation && <p className="mt-1 text-muted">{rule.explanation}</p>}

        {rule.flagged && (
          <p
            data-testid="flag"
            className="mt-2 rounded-lg border border-accent bg-status-amberBg px-3 py-2 text-sm font-semibold text-status-amber"
          >
            ⚠ Quote not found in your text. Not counted.
          </p>
        )}

        {rule.quote ? (
          <blockquote
            className={`mt-2 whitespace-pre-line border-l-2 pl-3 text-sm text-muted ${
              rule.flagged ? "border-accent" : "border-line"
            }`}
          >
            “{rule.quote}”
          </blockquote>
        ) : rule.sourceNote ? (
          <p className="mt-2 text-sm text-muted">Source: {rule.sourceNote} (no direct quote)</p>
        ) : null}

        {rule.result === "unknown" && !rule.flagged && !rule.note && rule.question && (
          <div className="mt-3 rounded-lg bg-status-amberBg p-3 text-status-amber">
            <p className="font-semibold">Why can&apos;t we tell?</p>
            <p>{rule.question}</p>
          </div>
        )}
      </div>
    </li>
  );
}

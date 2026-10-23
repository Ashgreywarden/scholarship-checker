"use client";

import { useMemo, useState } from "react";
import { AlertOctagon, CircleHelp, ClipboardCheck, FileText } from "lucide-react";
import { checkApplication, type FlawSeverity } from "@/lib/ui/applicationCheck";
import type { Scheme } from "@/lib/ui/types";

const GROUPS: { severity: FlawSeverity; heading: string; Icon: typeof AlertOctagon; className: string }[] = [
  { severity: "blocker", heading: "Likely to be rejected", Icon: AlertOctagon, className: "border-status-red/30 bg-status-redBg text-status-red" },
  { severity: "gap", heading: "Confirm before you apply", Icon: CircleHelp, className: "border-accent/60 bg-status-amberBg text-status-amber" },
  { severity: "paperwork", heading: "Paperwork that gets applications rejected", Icon: FileText, className: "border-line bg-white text-ink" },
];

const READINESS = {
  blocked: "This application would most likely be rejected as it stands.",
  gaps: "Nothing rules you out, but some points are unconfirmed. Close them first.",
  ready: "Every rule we can check passes. The risk now is in the paperwork.",
};

// The student picks a scheme and sees the weak spots in their application for it.
// Everything here comes from the rule checker and the scheme data, in plain code.
export function ApplicationCheck({ schemes, defaultId }: { schemes: Scheme[]; defaultId?: string }) {
  const [id, setId] = useState(defaultId ?? schemes[0]?.id ?? "");
  const scheme = schemes.find((s) => s.id === id) ?? schemes[0];
  const check = useMemo(() => (scheme ? checkApplication(scheme) : null), [scheme]);

  if (!scheme || !check) return null;

  return (
    <section aria-labelledby="check-heading" className="mt-12" data-testid="application-check">
      <h2 id="check-heading" className="flex items-center gap-2 font-display text-2xl font-semibold">
        <ClipboardCheck size={22} className="text-brand" aria-hidden="true" />
        Check my application
      </h2>
      <p className="mt-2 max-w-2xl text-muted">
        Pick a scheme and we list what could get your application rejected: rules you
        do not meet, rules we could not confirm, and the paperwork that trips most
        students up.
      </p>

      <div className="card mt-4 p-5 sm:p-6">
        <label htmlFor="check-scheme" className="field-label">
          Scheme to check
        </label>
        <select
          id="check-scheme"
          value={scheme.id}
          onChange={(e) => setId(e.target.value)}
          className="field"
        >
          {schemes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.verdict === "not_eligible" ? "Ruled out: " : ""}
              {s.name}
            </option>
          ))}
        </select>

        <p
          className={`mt-5 rounded-lg border-l-4 py-2 pl-4 font-semibold ${
            check.readiness === "blocked"
              ? "border-status-red text-status-red"
              : check.readiness === "gaps"
                ? "border-accent text-status-amber"
                : "border-status-green text-status-green"
          }`}
          data-testid="readiness"
          data-value={check.readiness}
        >
          {READINESS[check.readiness]}
        </p>

        {GROUPS.map(({ severity, heading, Icon, className }) => {
          const items = check.flaws.filter((f) => f.severity === severity);
          if (!items.length) return null;
          return (
            <div key={severity} className="mt-6">
              <h3 className="flex items-center gap-2 font-semibold">
                <Icon size={18} aria-hidden="true" />
                {heading} ({items.length})
              </h3>
              <ul className={`mt-2 grid gap-2 ${severity === "paperwork" ? "sm:grid-cols-2" : ""}`}>
                {items.map((f, i) => (
                  <li key={i} className={`rounded-lg border p-3 ${className}`} data-severity={severity}>
                    <p className="font-semibold">{f.title}</p>
                    <p className="mt-0.5 text-sm text-ink/80">{f.detail}</p>
                    {f.quote && (
                      <p className="mt-1 border-l-2 border-current/40 pl-2 text-sm italic text-muted">
                        &ldquo;{f.quote}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <p className="mt-6 text-sm text-muted">
          This is a check of your answers against the published rules, not a decision.
          The provider decides. Confirm everything on the official portal.
        </p>
      </div>
    </section>
  );
}

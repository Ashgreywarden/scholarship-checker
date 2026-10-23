// "Check my application": the weak spots in an application for one scheme,
// worked out in plain code from the rule checker's results, the deadline and
// the documents list. No AI is involved and no verdict is changed here: a
// failed rule is a flaw, an unconfirmed rule is a gap to close, and the rest is
// paperwork that commonly gets Indian scholarship applications rejected.
import type { Scheme } from "./types";

export type FlawSeverity = "blocker" | "gap" | "paperwork";

export interface ApplicationFlaw {
  severity: FlawSeverity;
  title: string;
  detail: string;
  quote?: string | null;
}

export interface ApplicationCheck {
  // "blocked": a rule fails. "gaps": nothing fails but something is unconfirmed.
  // "ready": every checkable rule passes; only paperwork remains.
  readiness: "blocked" | "gaps" | "ready";
  flaws: ApplicationFlaw[];
}

// Paperwork that often gets an otherwise good application rejected. These are
// checks on the application, not on eligibility: they apply to every scheme.
const PAPERWORK: Record<string, ApplicationFlaw> = {
  income: {
    severity: "paperwork",
    title: "Income certificate must be current",
    detail:
      "Most providers reject income certificates older than a year, or ones not issued by the tehsildar / competent authority. Check the date on yours.",
  },
  category: {
    severity: "paperwork",
    title: "Caste or category certificate in the student's own name",
    detail:
      "A certificate in a parent's name is a common reason for rejection. It must be in your name and from the issuing authority of your state.",
  },
  domicile: {
    severity: "paperwork",
    title: "Domicile certificate matches the state you chose",
    detail:
      "State schemes verify domicile. The state on your certificate, your Aadhaar address and your profile should all agree.",
  },
  bank: {
    severity: "paperwork",
    title: "Bank account in your own name, Aadhaar-seeded",
    detail:
      "Scholarship money is paid by direct benefit transfer. An account not seeded with Aadhaar on the NPCI mapper, or a joint or parent's account, usually fails at payment.",
  },
  marks: {
    severity: "paperwork",
    title: "Marksheets match the marks you entered",
    detail:
      "Enter the percentage exactly as on the marksheet. A mismatch between the form and the uploaded marksheet is treated as a false declaration.",
  },
  institute: {
    severity: "paperwork",
    title: "Institute verification on time",
    detail:
      "Most portal applications are forwarded by your college. Submit early so the institute's nodal officer verifies before their own cut-off, which is often earlier than the student deadline.",
  },
};

function paperworkFor(scheme: Scheme): ApplicationFlaw[] {
  const labels = scheme.rules.map((r) => r.label.toLowerCase());
  const has = (word: string) => labels.some((l) => l.includes(word));
  const flaws: ApplicationFlaw[] = [];
  if (has("income")) flaws.push(PAPERWORK.income);
  if (has("category") || has("caste")) flaws.push(PAPERWORK.category);
  if (has("state") || has("domicile")) flaws.push(PAPERWORK.domicile);
  if (has("marks") || has("percentage")) flaws.push(PAPERWORK.marks);
  flaws.push(PAPERWORK.bank);
  if (["government", "state"].includes(scheme.provider_type)) flaws.push(PAPERWORK.institute);
  return flaws;
}

export function checkApplication(scheme: Scheme): ApplicationCheck {
  const flaws: ApplicationFlaw[] = [];

  for (const rule of scheme.rules) {
    if (rule.note || rule.flagged) continue;
    if (rule.result === "fail") {
      flaws.push({
        severity: "blocker",
        title: `Does not meet: ${rule.label}`,
        detail:
          rule.explanation ??
          "Your answer does not meet this published rule. Applying anyway usually ends in rejection.",
        quote: rule.quote || null,
      });
    } else if (rule.result === "unknown") {
      flaws.push({
        severity: "gap",
        title: `Not confirmed: ${rule.label}`,
        detail:
          rule.question ??
          rule.explanation ??
          "We could not check this rule from your answers. Confirm it on the official page before applying.",
        quote: rule.quote || null,
      });
    }
  }

  const status = scheme.deadline.status;
  if (status === "closed") {
    flaws.push({
      severity: "blocker",
      title: "Applications are closed",
      detail: "The last date in the official notice has passed. Watch for the next cycle.",
    });
  } else if (status === "closing_soon") {
    flaws.push({
      severity: "gap",
      title: "Deadline is close",
      detail: "Late and incomplete submissions are the most common rejection. Gather the documents below today.",
    });
  } else if (status === "stale_cycle") {
    flaws.push({
      severity: "gap",
      title: "Dates are from an old cycle",
      detail: "The notice we have is from a past year. Check the portal for this year's dates before preparing.",
    });
  }

  for (const doc of scheme.documents) {
    flaws.push({
      severity: "paperwork",
      title: `Keep ready: ${doc.name}`,
      detail: doc.verified
        ? "Named in the official notice."
        : "Listed by the provider; confirm the exact format on the portal.",
      quote: doc.quote,
    });
  }
  flaws.push(...paperworkFor(scheme));

  const readiness = flaws.some((f) => f.severity === "blocker")
    ? "blocked"
    : flaws.some((f) => f.severity === "gap")
      ? "gaps"
      : "ready";

  return { readiness, flaws };
}

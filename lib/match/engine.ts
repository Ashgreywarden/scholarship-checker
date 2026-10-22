import type { Scheme } from "../databank/types";
import { normalizeWord } from "../normalize";
import type { Profile } from "../types";
import { evaluateRule, type RuleEval } from "./rules";
import { computeStatus, type StatusResult } from "./status";

// The "Find my scholarships" matching engine. Plain TypeScript: no AI, no
// network. It reads the rules in each scheme file and compares them with the
// student's answers.

export type MatchVerdict = "eligible" | "not_eligible" | "cant_tell";

export interface MatchRow extends RuleEval {
  kind: "rule" | "derived";
  // The official quote for this rule. null for "derived" rows, which come from
  // the data bank's own tags (level, state) rather than from a quoted rule.
  quote: string | null;
  // For derived rows: where the information comes from.
  sourceNote: string | null;
}

export interface SchemeMatch {
  scheme: Scheme;
  verdict: MatchVerdict;
  // One sentence saying why, plus the row that decided it.
  reason: string;
  deciding: MatchRow | null;
  rows: MatchRow[];
  status: StatusResult;
}

// Student level -> the level words used in the data bank.
function schemeLevelOf(p: Profile): string | null {
  switch (p.courseLevel) {
    case "class_1_8":
    case "class_9_10":
    case "class_11_12":
      return "school";
    case "undergraduate":
      return "UG";
    case "postgraduate":
      return "PG";
    case "doctoral":
      return "PhD";
    default:
      return null;
  }
}

function derivedRows(s: Scheme, p: Profile): MatchRow[] {
  const rows: MatchRow[] = [];
  const derived = (e: RuleEval, sourceNote: string): MatchRow => ({
    ...e, kind: "derived", quote: null, sourceNote,
  });

  // Level: from the scheme's "level" tag.
  const mine = schemeLevelOf(p);
  const tagged = s.level.join(", ") || "not stated";
  if (!mine) {
    rows.push(derived(
      { label: "Course level", status: "unknown", unknownKind: "missing", checkable: true,
        explanation: `This scheme is for: ${tagged}. You skipped "Course level".` },
      "Level tag in the scholarship data bank",
    ));
  } else if (s.level.length > 0) {
    const ok = s.level.includes("any") || s.level.includes(mine);
    rows.push(derived(
      { label: "Course level", status: ok ? "pass" : "fail", checkable: true,
        explanation: `This scheme is for: ${tagged}. You are applying at ${mine} level.` },
      "Level tag in the scholarship data bank",
    ));
  }

  // State schemes: the scheme's own state, unless a quoted domicile rule covers it.
  const hasDomicileRule = s.rules.some((r) => r.field === "domicile_state");
  if (s.state && !hasDomicileRule) {
    if (!p.state) {
      rows.push(derived(
        { label: "State", status: "unknown", unknownKind: "missing", checkable: true,
          explanation: `Run by ${s.state}. You skipped "State".` },
        "State of the scheme in the scholarship data bank",
      ));
    } else {
      const same = normalizeWord(p.state) === normalizeWord(s.state);
      rows.push(derived(
        { label: "State", status: same ? "pass" : "fail", checkable: true,
          explanation: `Run by ${s.state} for its own students. You live in ${p.state}.` },
        "State of the scheme in the scholarship data bank",
      ));
    }
  }
  return rows;
}

const ROW_ORDER = (r: MatchRow): number => {
  if (!r.checkable) return 4; // "also check" notes last
  if (r.status === "fail") return 0;
  if (r.status === "unknown") return 1;
  return 2; // pass
};

export function matchScheme(s: Scheme, p: Profile, today: Date): SchemeMatch {
  const ruleRows: MatchRow[] = s.rules.map((r) => ({
    ...evaluateRule(r, p),
    kind: "rule",
    quote: r.quote.trim() === "" ? null : r.quote,
    sourceNote: null,
  }));
  const rows = [...derivedRows(s, p), ...ruleRows].sort((a, b) => ROW_ORDER(a) - ROW_ORDER(b));

  const counted = rows.filter((r) => r.checkable);
  const failed = counted.filter((r) => r.status === "fail");
  const unresolved = counted.filter((r) => r.status === "unknown");
  // "Eligible" needs at least one rule with an official quote that we checked and passed.
  const quotedPasses = counted.filter((r) => r.status === "pass" && r.quote !== null);

  let verdict: MatchVerdict;
  let deciding: MatchRow | null;
  let reason: string;

  if (failed.length > 0) {
    verdict = "not_eligible";
    deciding = failed.find((r) => r.quote !== null) ?? failed[0];
    reason = `Not eligible: ${deciding.label}. ${deciding.explanation}`;
  } else if (unresolved.length > 0) {
    verdict = "cant_tell";
    deciding = unresolved[0];
    reason = `Can't tell: ${deciding.label}. ${deciding.explanation}`;
  } else if (quotedPasses.length === 0) {
    verdict = "cant_tell";
    deciding = rows[0] ?? null;
    reason = "Can't tell: the published rules have nothing we can check against your answers. Read the quotes below.";
  } else {
    verdict = "eligible";
    deciding = quotedPasses[0];
    reason = `${quotedPasses.length} published rule${quotedPasses.length === 1 ? "" : "s"} checked against your answers, and none fail.`;
  }

  return { scheme: s, verdict, reason, deciding, rows, status: computeStatus(s.deadline, today) };
}

const VERDICT_RANK: Record<MatchVerdict, number> = { eligible: 0, cant_tell: 1, not_eligible: 2 };
const STATUS_RANK = { open: 0, unknown: 1, closed: 2, stale: 3 } as const;

// Best first: likely eligible and open, then can't tell, then not eligible.
export function matchAll(schemes: Scheme[], p: Profile, today: Date): SchemeMatch[] {
  return schemes
    .map((s) => matchScheme(s, p, today))
    .sort(
      (a, b) =>
        VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict] ||
        STATUS_RANK[a.status.status] - STATUS_RANK[b.status.status] ||
        (a.status.daysLeft ?? 9999) - (b.status.daysLeft ?? 9999) ||
        a.scheme.name.localeCompare(b.scheme.name),
    );
}

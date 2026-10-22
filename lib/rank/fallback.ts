import type { SchemeMatch } from "../match/engine";
import { MAX_BEST, MAX_CONFIRM_WORDS, MAX_WHY_WORDS, type RankItem } from "./types";

export function clampWords(text: string, max: number): string {
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return words.length <= max ? words.join(" ") : `${words.slice(0, max).join(" ")}…`;
}

// A scheme can be in "Best matches" only if the rules did not rule it out and
// it is not closed or from an old cycle.
export function canBeBest(m: SchemeMatch): boolean {
  return m.verdict !== "not_eligible" && m.status.status !== "closed" && m.status.status !== "stale";
}

// Plain-code wording, built only from the rule results (no AI).
export function codeText(m: SchemeMatch): { why_it_fits: string; to_confirm: string } {
  // Prefer the rule that says most about the student (income, category, marks ...)
  // over generic ones such as citizenship.
  const PREFERRED = ["Family income", "Category", "Marks", "State of domicile", "Age", "Gender"];
  const rank = (label: string) => {
    const i = PREFERRED.indexOf(label);
    return i === -1 ? PREFERRED.length : i;
  };
  const pass = m.rows
    .filter((r) => r.checkable && r.status === "pass" && r.quote)
    .sort((a, b) => rank(a.label) - rank(b.label))[0];
  const open = m.rows.find((r) => r.checkable && r.status === "unknown");
  return {
    why_it_fits: clampWords(
      pass
        ? `You meet this published rule (${pass.label.toLowerCase()}). ${pass.explanation}`
        : "The published rules we checked do not rule you out.",
      MAX_WHY_WORDS,
    ),
    to_confirm: open ? clampWords(open.explanation, MAX_CONFIRM_WORDS) : "",
  };
}

// Our own ranking: the order matchAll() already gives (likely eligible first,
// then open before closed, nearest deadline first).
export function codeRanking(matches: SchemeMatch[], max: number = MAX_BEST): RankItem[] {
  return matches
    .filter(canBeBest)
    .slice(0, max)
    .map((m) => ({ scheme_id: m.scheme.id, ...codeText(m) }));
}

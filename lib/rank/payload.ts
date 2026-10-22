import type { SchemeMatch } from "../match/engine";
import type { StudentProfile } from "../ui/types";

// The compact data sent to Gemini: the student's answers (no name, no contact
// details) and, for each scheme the rules did NOT rule out, its id, name,
// provider, amount, deadline status and its checked rules with their quotes.

export interface CandidateRule {
  rule: string;
  result: "pass" | "unknown";
  quote?: string;
  detail?: string;
}

export interface Candidate {
  id: string;
  name: string;
  provider: string;
  amount: string;
  deadline: string;
  verdict: "eligible" | "cant_tell";
  rules: CandidateRule[];
}

const cut = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
// Smaller requests answer faster, and the AI has only 15 seconds.
const MAX_CANDIDATES = 40;
const MAX_RULES = 5;

export function compactProfile(p: StudentProfile): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  const put = (k: string, v: string, skip: string[] = []) => {
    const t = v.trim();
    if (t && !skip.includes(t)) out[k] = t;
  };
  put("state", p.state);
  put("category", p.category);
  const inc = Number(p.annualIncome);
  if (p.annualIncome.trim() !== "" && Number.isFinite(inc)) out.annual_family_income_inr = inc;
  put("study_level", p.level);
  put("current_year", p.year);
  put("course_type", p.courseType);
  put("gender", p.gender, ["Prefer not to say"]);
  if (p.disability) out.has_disability = p.disability;
  put("minority_community", p.minorityCommunity, ["None", "Prefer not to say"]);
  put("parent_occupation", p.parentOccupation, ["Prefer not to say"]);
  if (p.firstGeneration) out.first_generation_student = p.firstGeneration;
  put("marks_percent", p.marksPercent);
  put("age", p.age);
  put("years_of_work_experience", p.workYears);
  return out;
}

// Drops every scheme the rules clearly rule out, keeps Eligible and Can't tell,
// and caps the list so the request stays small (best code-ranked first).
export function buildCandidates(matches: SchemeMatch[]): Candidate[] {
  return matches
    .filter((m) => m.verdict !== "not_eligible")
    .slice(0, MAX_CANDIDATES)
    .map((m) => {
      const checked = m.rows
        .filter((r) => r.checkable && r.status !== "fail")
        .sort((a, b) => (a.status === "unknown" ? 0 : 1) - (b.status === "unknown" ? 0 : 1))
        .slice(0, MAX_RULES);
      return {
        id: m.scheme.id,
        name: m.scheme.name,
        provider: cut(m.scheme.provider, 80),
        amount: cut(m.scheme.amount.text || "not stated", 120),
        deadline: m.status.label,
        verdict: m.verdict as "eligible" | "cant_tell",
        rules: checked.map((r) => ({
          rule: r.label,
          result: r.status as "pass" | "unknown",
          ...(r.quote ? { quote: cut(r.quote.replace(/\s+/g, " "), 140) } : {}),
          ...(r.status === "unknown" ? { detail: cut(r.explanation, 120) } : {}),
        })),
      };
    });
}

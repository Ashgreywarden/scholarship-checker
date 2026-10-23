import { describe, expect, it } from "vitest";
import { checkApplication } from "./applicationCheck";
import type { Scheme } from "./types";

const base: Scheme = {
  id: "s1",
  name: "Test scheme",
  provider: "Ministry",
  provider_type: "government",
  amount: { text: "Rs 10,000" },
  deadline: { date: "2026-12-31", status: "open", text: "" },
  verdict: "eligible",
  summary: { text: "", quote: null },
  rules: [
    { label: "Annual family income", result: "pass", quote: "Income below Rs 2.5 lakh" },
    { label: "Category", result: "pass", quote: "SC students" },
  ],
  documents: [{ name: "Income certificate", quote: "income certificate", verified: true }],
  apply_url: null,
  source_url: null,
  levels: ["UG"],
  states: ["All India"],
};

describe("checkApplication", () => {
  it("is ready when every rule passes; only paperwork remains", () => {
    const r = checkApplication(base);
    expect(r.readiness).toBe("ready");
    expect(r.flaws.every((f) => f.severity === "paperwork")).toBe(true);
    expect(r.flaws.map((f) => f.title)).toContain("Keep ready: Income certificate");
    expect(r.flaws.map((f) => f.title)).toContain("Income certificate must be current");
    expect(r.flaws.map((f) => f.title)).toContain("Institute verification on time");
  });

  it("a failed rule is a blocker, with the rule's quote", () => {
    const r = checkApplication({
      ...base,
      rules: [{ label: "Category", result: "fail", quote: "SC students only", explanation: "You chose General." }],
    });
    expect(r.readiness).toBe("blocked");
    expect(r.flaws[0]).toMatchObject({ severity: "blocker", title: "Does not meet: Category", detail: "You chose General.", quote: "SC students only" });
  });

  it("an unknown rule is a gap, using the rule's question", () => {
    const r = checkApplication({
      ...base,
      rules: [{ label: "Entrance exam", result: "unknown", quote: "JEE rank", question: "Did you qualify JEE?" }],
    });
    expect(r.readiness).toBe("gaps");
    expect(r.flaws[0]).toMatchObject({ severity: "gap", detail: "Did you qualify JEE?" });
  });

  it("notes and flagged rules are not counted", () => {
    const r = checkApplication({
      ...base,
      rules: [
        { label: "Also check", result: "unknown", quote: "", note: true },
        { label: "Unfound", result: "fail", quote: "x", flagged: true },
      ],
    });
    expect(r.readiness).toBe("ready");
  });

  it("deadline status adds a blocker (closed) or a gap (closing soon, old cycle)", () => {
    expect(checkApplication({ ...base, deadline: { ...base.deadline, status: "closed" } }).readiness).toBe("blocked");
    expect(checkApplication({ ...base, deadline: { ...base.deadline, status: "closing_soon" } }).readiness).toBe("gaps");
    expect(checkApplication({ ...base, deadline: { ...base.deadline, status: "stale_cycle" } }).readiness).toBe("gaps");
  });

  it("never says 'eligible' or 'you will get it'", () => {
    const text = JSON.stringify(checkApplication(base));
    expect(text).not.toMatch(/eligible|you will get/i);
  });
});

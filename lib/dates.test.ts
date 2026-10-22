import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { analyze } from "./analyze";
import { baseProfile, cheveningExtraction } from "./fixtures";
import { datesInText } from "./normalize";
import { tidyQuoteForDisplay } from "./verifyQuote";

const today = new Date(2026, 9, 22); // 22 Oct 2026

describe("datesInText (complete dates only, never guesses a year)", () => {
  it("reads common written formats", () => {
    expect(datesInText("closes on 8 July 2027")).toEqual(["2027-07-08"]);
    expect(datesInText("closes on 8th July, 2027")).toEqual(["2027-07-08"]);
    expect(datesInText("closes July 8, 2027")).toEqual(["2027-07-08"]);
    expect(datesInText("Last date: 31 Oct 2026")).toEqual(["2026-10-31"]);
    expect(datesInText("Last date 31/10/2026")).toEqual(["2026-10-31"]);
    expect(datesInText("Last date 2026-10-31")).toEqual(["2026-10-31"]);
  });
  it("ignores dates with no year, month-only text, and impossible dates", () => {
    expect(datesInText("closes on 7 October")).toEqual([]);
    expect(datesInText("OCTOBER 2026 APPLICATIONS CLOSE")).toEqual([]);
    expect(datesInText("31 February 2027")).toEqual([]);
    expect(datesInText("at least two years (2,800 hours)")).toEqual([]);
  });
  it("finds several dates in one line", () => {
    expect(datesInText("from 1 June 2026 to 30 September 2026")).toEqual(["2026-06-01", "2026-09-30"]);
  });
});

function withDeadline(date_iso: string | null, quote: string, text: string) {
  const extraction = {
    ...cheveningExtraction,
    deadlines: [{ label: "Deadline", date_iso, quote }],
  };
  return analyze(extraction, text, baseProfile, today).deadlines[0];
}

describe("deadline date is read from the quote, not trusted from the AI", () => {
  const quote = "The offer deadline is 17:00 BST on 8 July 2027.";

  it("matching date: shown with a countdown, no warning", () => {
    const d = withDeadline("2027-07-08", quote, quote);
    expect(d.dateIso).toBe("2027-07-08");
    expect(d.dateNote).toBeNull();
    expect(d.status).toBe("259 days left");
  });
  it("AI has the wrong year: we use the quote's date and say so", () => {
    const d = withDeadline("2026-07-08", quote, quote);
    expect(d.dateIso).toBe("2027-07-08");
    expect(d.aiDateIso).toBe("2026-07-08");
    expect(d.dateNote).toMatch(/AI said 2026-07-08.*quoted line says 2027-07-08/);
    expect(d.status).toBe("259 days left"); // not "Closed"
  });
  it("AI gave no date but the quote has a full one: recovered by code", () => {
    expect(withDeadline(null, quote, quote).dateIso).toBe("2027-07-08");
  });
  it("quote has no complete date: AI's date is not shown as a deadline", () => {
    const q = "Applications close in October 2026 at 11:00 UTC.";
    const d = withDeadline("2026-10-07", q, q);
    expect(d.dateIso).toBeNull();
    expect(d.status).toMatch(/not confirmed/i);
    expect(d.dateNote).toMatch(/no complete date/);
    expect(d.closed).toBe(false);
  });
  it("several dates in the quote: AI's date must be one of them", () => {
    const q = "Applications open 1 June 2026 and close on 30 September 2026.";
    expect(withDeadline("2026-09-30", q, q).dateIso).toBe("2026-09-30");
    const bad = withDeadline("2026-12-31", q, q);
    expect(bad.dateIso).toBeNull();
    expect(bad.dateNote).toMatch(/several dates/);
  });
  it("real Chevening timeline: October 2026 close has no day, so no invented date", () => {
    const text = readFileSync(
      path.join(__dirname, "..", "fixtures", "chevening-timeline-real.txt"),
      "utf8",
    );
    const q = "Please refer to your country page for the deadline.";
    expect(withDeadline(null, q, text).dateIso).toBeNull();
  });
});

describe("tidyQuoteForDisplay (display only)", () => {
  it("trims a leading row number and trailing table columns, marking the cut", () => {
    expect(tidyQuoteForDisplay("3 Fee Receipt Yes Yes")).toBe("Fee Receipt …");
    expect(tidyQuoteForDisplay("2 Income Certificate Yes   No")).toBe("Income Certificate …");
  });
  it("leaves normal quotes alone", () => {
    expect(tidyQuoteForDisplay("Income Certificate")).toBe("Income Certificate");
    expect(tidyQuoteForDisplay("Two references from academic or professional referees."))
      .toBe("Two references from academic or professional referees.");
  });
  it("keeps the original if trimming would leave almost nothing", () => {
    expect(tidyQuoteForDisplay("Yes Yes Yes")).toBe("Yes Yes Yes");
  });
});

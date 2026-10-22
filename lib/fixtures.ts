import type { Extraction } from "./schema";
import type { Profile } from "./types";

// A hand-written "AI answer" for fixtures/chevening.txt, so the plain-code
// tests run with no API key and no network. Every quote is copied from the
// fixture file.
export const cheveningExtraction: Extraction = {
  is_scholarship_notice: true,
  reason: "Describes Chevening eligibility criteria and key dates.",
  scholarship_name: "Chevening Scholarship",
  criteria: [
    {
      id: "c1",
      quote: "Be a citizen of a Chevening-eligible country or territory.",
      field: "none",
      operator: "judgement",
      values: [],
      unit: "none",
    },
    {
      id: "c2",
      quote:
        "Have completed all the requirements to gain an undergraduate degree that will allow you to gain a place on a UK postgraduate programme.",
      field: "none",
      operator: "judgement",
      values: [],
      unit: "none",
    },
    {
      id: "c3",
      quote: "Have at least two years (2,800 hours) of work experience.",
      field: "work_experience",
      operator: "gte",
      values: ["2800"],
      unit: "hours",
    },
    {
      id: "c4",
      quote: "Show leadership potential and a strong academic background.",
      field: "none",
      operator: "judgement",
      values: [],
      unit: "none",
    },
  ],
  documents: [
    {
      name: "Two references",
      quote: "Two references from academic or professional referees.",
    },
    {
      name: "Passport or national ID",
      quote: "A copy of your passport or national identity document.",
    },
  ],
  deadlines: [
    {
      label: "Applications close",
      date_iso: "2027-10-07",
      quote: "Applications close at 12:00 (UTC) on 7 October 2027.",
    },
  ],
};

export const baseProfile: Profile = {
  courseLevel: "postgraduate",
  age: 23,
  state: "Bihar",
  category: "obc",
  annualIncomeInr: 250000,
  marksPercent: 72,
  workExperienceYears: 1,
  nationality: "Indian",
};

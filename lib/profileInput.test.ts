import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE_INPUT, parseProfileInput } from "./profileInput";

describe("parseProfileInput", () => {
  it("blank answers become null (skipped), nationality defaults to Indian", () => {
    const { profile, problems } = parseProfileInput(EMPTY_PROFILE_INPUT);
    expect(profile).toMatchObject({
      courseLevel: null,
      age: null,
      state: null,
      category: null,
      annualIncomeInr: null,
      marksPercent: null,
      workExperienceYears: null,
      nationality: "Indian",
    });
    expect(problems).toEqual({});
  });
  it("parses numbers, including commas, and keeps 0", () => {
    const { profile } = parseProfileInput({
      ...EMPTY_PROFILE_INPUT,
      income: "2,50,000",
      workYears: "0",
      marks: "72.5",
    });
    expect(profile.annualIncomeInr).toBe(250000);
    expect(profile.workExperienceYears).toBe(0);
    expect(profile.marksPercent).toBe(72.5);
  });
  it("out-of-range or non-numeric becomes null with a hint, never a guess", () => {
    const { profile, problems } = parseProfileInput({
      ...EMPTY_PROFILE_INPUT,
      marks: "150",
      age: "abc",
      state: "Atlantis",
    });
    expect(profile.marksPercent).toBeNull();
    expect(profile.age).toBeNull();
    expect(profile.state).toBeNull();
    expect(problems.marks).toBeTruthy();
    expect(problems.age).toBeTruthy();
  });
});

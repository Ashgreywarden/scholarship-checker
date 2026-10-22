import { ALL_GROUP_IDS } from "../match/groups";
import type { StudentProfile } from "./types";

export const PROFILE_KEY = "scholarpath.profile.v1";

export const EMPTY_PROFILE: StudentProfile = {
  state: "",
  category: "",
  annualIncome: "",
  level: "",
  year: "",
  courseType: "",
  marksPercent: "",
  gender: "",
  age: "",
  disability: "",
  specialGroups: [],
};

// The course types offered in the form. The matcher groups them (courseType.ts).
export const COURSE_TYPES = [
  "Arts and humanities",
  "Science",
  "Commerce",
  "Engineering and technology",
  "Medicine and health",
  "Law",
  "Management",
  "Agriculture",
  "Education",
  "Fine arts, performing arts or film",
  "Sports",
  "Other",
];

export const STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

// The raw saved text, or null (also null when the browser blocks storage).
export function readRawProfile(): string | null {
  try {
    return localStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
}

// Saves the answers in this browser only. Returns false if the browser refuses.
export function saveProfile(profile: StudentProfile): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    return false;
  }
}

// Only known fields are taken, and each must be a string; a field missing from
// an older saved profile becomes "".
export function parseProfile(raw: string | null): StudentProfile | null {
  try {
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const result: StudentProfile = { ...EMPTY_PROFILE, specialGroups: [] };

    for (const key of Object.keys(EMPTY_PROFILE) as (keyof StudentProfile)[]) {
      const value = (parsed as Record<string, unknown>)[key];
      if (value === undefined) continue;
      if (key === "specialGroups") {
        // Only ids we know; anything else is dropped.
        if (!Array.isArray(value)) return null;
        result.specialGroups = value.filter(
          (v): v is string => typeof v === "string" && ALL_GROUP_IDS.includes(v),
        );
        continue;
      }
      if (typeof value !== "string") return null;
      Object.assign(result, { [key]: value });
    }

    return result;
  } catch {
    return null;
  }
}

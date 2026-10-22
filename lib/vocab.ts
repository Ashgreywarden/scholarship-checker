// The fixed lists of words the app understands. The AI must pick from these
// lists; anything else is treated as "can't tell" by the plain-code checker.

export const COURSE_LEVELS = [
  "class_1_8",
  "class_9_10",
  "class_11_12",
  "undergraduate",
  "postgraduate",
  "doctoral",
] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];

export const COURSE_LEVEL_LABELS: Record<CourseLevel, string> = {
  class_1_8: "Class 1–8",
  class_9_10: "Class 9–10",
  class_11_12: "Class 11–12",
  undergraduate: "Undergraduate (bachelor's)",
  postgraduate: "Postgraduate (master's)",
  doctoral: "Doctoral (PhD)",
};

export const CATEGORIES = ["general", "ews", "obc", "sc", "st"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  general: "General",
  ews: "EWS",
  obc: "OBC",
  sc: "SC",
  st: "ST",
};

export const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

// The 8 profile fields, plus "none" for rules about something we don't collect
// (for example "must not hold another scholarship").
export const FIELDS = [
  "course_level",
  "age",
  "state",
  "category",
  "annual_income",
  "marks_percent",
  "work_experience",
  "nationality",
  "none",
] as const;
export type Field = (typeof FIELDS)[number];

export const FIELD_LABELS: Record<Field, string> = {
  course_level: "Course level",
  age: "Age",
  state: "State",
  category: "Category",
  annual_income: "Annual family income",
  marks_percent: "Marks",
  work_experience: "Work experience",
  nationality: "Nationality",
  none: "Other requirement",
};

export const OPERATORS = [
  "gte", // greater than or equal ("at least")
  "lte", // less than or equal ("not more than")
  "eq", // exactly equal
  "in", // one of a list
  "not_in", // none of a list
  "between", // two values: [low, high]
  "judgement", // subjective, a human must decide
] as const;
export type Operator = (typeof OPERATORS)[number];

export const UNITS = [
  "inr",
  "lakh_inr",
  "crore_inr",
  "other_currency",
  "percent",
  "years",
  "months",
  "hours",
  "none",
] as const;
export type Unit = (typeof UNITS)[number];

// Assumption shown on screen: a full-time working year is about 1,400 hours,
// so Chevening's "2,800 hours" equals two years.
export const HOURS_PER_YEAR = 1400;

// Course-type rules ("only for B.Tech Computer Science", "only for law
// students") are free text in the data bank, so they are read with a keyword
// list. The student's profile has ten broad course types. A scheme counts as a
// clear fit ONLY when one of its listed courses clearly belongs to the same
// broad type as the student's. Anything else, including a restriction we can't
// read, is "Can't tell". It is never a guessed pass or a guessed fail.

export type CourseGroup =
  | "law"
  | "medicine"
  | "engineering"
  | "management"
  | "agriculture"
  | "education"
  | "commerce"
  | "arts_humanities"
  | "science"
  | "creative_arts" // music, dance, theatre, visual arts, film, design
  | "sports";

// First match wins, so more specific words come before general ones
// (for example "B.Tech Computer Science" is engineering, not science).
const GROUP_PATTERNS: [CourseGroup, RegExp][] = [
  ["law", /\bLL\.?\s?[BM]\b|\blaw\b|\blegal\b/i],
  ["medicine", /\bMBBS\b|\bBDS\b|\bmedic|\bnursing\b|\bpharm|\bdental\b|\bhealth\b|\bayush\b/i],
  ["engineering", /\bengineering\b|\bB\.?\s?E\b|\bB\.?\s?Tech\b|\bM\.?\s?Tech\b|\btechnology\b|\barchitecture\b/i],
  ["management", /\bmanagement\b|\bMBA\b|\bPGP\b|\bbusiness admin/i],
  ["agriculture", /\bagricultur|\bhorticultur|\bfisher|\bforestry\b|\bveterinary\b/i],
  ["education", /\bB\.?\s?Ed\b|\bM\.?\s?Ed\b|\bteacher\b/i],
  ["commerce", /\bcommerce\b|\bB\.?\s?Com\b|\baccountancy\b/i],
  ["arts_humanities", /\bhumanit|\bsocial science|\bliterature\b|\bhistory\b|\bsociology\b|\bpolitical\b|\beconomics\b|\bpsychology\b|\bB\.?\s?A\b|\bM\.?\s?A\b/i],
  ["science", /\bscience|\bB\.?\s?Sc\b|\bM\.?\s?Sc\b|\bmathematic|\bphysics\b|\bchemistry\b|\bbiolog|\bstatistics\b|\bastronom/i],
  ["sports", /\bsport|\bathlet/i],
  ["creative_arts", /\bmusic\b|\bdance\b|\btheatre\b|\bmime\b|\bvisual art|\bfolk\b|\bclassical\b|\bfilm\b|\btelevision\b|\bdesign\b|\bjournalism\b|\bcraft|\bpainting\b|\bsculpture\b/i],
];

// Words that describe HOW a course is studied, not WHAT. A rule made only of
// these ("regular degree, not distance") stays a note to read, because we don't
// ask the student about their mode of study.
const FORMAT_ONLY = /\bregular\b|\bfull[- ]?time\b|\bpart[- ]?time\b|\bcorrespondence\b|\bdistance\b|\bonline\b|\bhybrid\b|\bdiploma\b|\bdegree\b/i;

export function groupOfCourseText(text: string): CourseGroup | null {
  for (const [group, pattern] of GROUP_PATTERNS) if (pattern.test(text)) return group;
  return null;
}

const STUDENT_GROUPS: Record<string, CourseGroup | null> = {
  "Arts and humanities": "arts_humanities",
  Science: "science",
  Commerce: "commerce",
  "Engineering and technology": "engineering",
  "Medicine and health": "medicine",
  Law: "law",
  Management: "management",
  Agriculture: "agriculture",
  Education: "education",
  "Fine arts, performing arts or film": "creative_arts",
  Sports: "sports",
  Other: null, // can never be a "clear fit"
};

export function groupOfStudent(courseType: string | null | undefined): CourseGroup | null {
  return courseType ? (STUDENT_GROUPS[courseType] ?? null) : null;
}

export type CourseRuleReading =
  | { kind: "format-only" } // not about the subject: leave as a note
  | { kind: "subject"; groups: (CourseGroup | null)[] };

// Reads the list of courses in a rule.
export function readCourseRule(values: string[]): CourseRuleReading {
  const groups = values.map(groupOfCourseText);
  const anySubject = groups.some((g) => g !== null);
  const allFormat = values.every((v) => FORMAT_ONLY.test(v));
  if (!anySubject && allFormat) return { kind: "format-only" };
  return { kind: "subject", groups };
}

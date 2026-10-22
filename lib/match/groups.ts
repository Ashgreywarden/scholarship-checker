// The optional "Anything else that applies?" answers. Each one is a plain id the
// student ticks; the matcher uses them only to turn a "Can't tell" into a pass.
// An unticked box never turns anything into a fail.

export const MINORITY_GROUPS: Record<string, string> = {
  "minority:muslim": "Muslim",
  "minority:christian": "Christian",
  "minority:sikh": "Sikh",
  "minority:buddhist": "Buddhist",
  "minority:jain": "Jain",
  "minority:parsi": "Parsi",
};

export const OTHER_GROUPS: Record<string, string> = {
  dnt: "I belong to a denotified, nomadic or semi-nomadic tribe",
  ebc: "I am on my state's EBC, SEBC or BC list",
  parent_beedi_cine_mine: "My parent or guardian works (or worked) in beedi, cine or mine work",
  manual_scavenging: "My family has traditionally been in manual scavenging",
};

export const ALL_GROUP_IDS: string[] = [...Object.keys(MINORITY_GROUPS), ...Object.keys(OTHER_GROUPS)];

// Words that appear in scheme rules ("category in [SC, DNT, ...]") -> the group
// ids that would satisfy them. null = not something these answers can settle.
export function groupIdsForCategoryToken(token: string): string[] | null {
  const t = token.trim().toLowerCase();
  if (t === "minority") return Object.keys(MINORITY_GROUPS);
  if (t === "muslim" || t === "christian" || t === "sikh" || t === "buddhist" || t === "jain" || t === "parsi") {
    return [`minority:${t}`];
  }
  if (t === "dnt" || t === "nt" || t === "snt" || t === "vjnt") return ["dnt"];
  if (t === "ebc" || t === "sebc" || t === "bc") return ["ebc"];
  return null;
}

// Parent-occupation rules ("beedi worker", "manual scavenger") -> the group id
// that settles them. Armed-forces / police rules need exact conditions (killed
// on duty, retired ...), so no tick settles those.
export function groupIdForOccupation(value: string): string | null {
  if (/beedi|\bcine\b|\bmine\b|\bore\b|limestone|dolomite/i.test(value)) return "parent_beedi_cine_mine";
  if (/scaveng/i.test(value)) return "manual_scavenging";
  return null;
}

export function labelOfGroup(id: string): string {
  return MINORITY_GROUPS[id] ?? OTHER_GROUPS[id] ?? id;
}

// Server only. Reads the scholarship data bank from disk at request time:
// nothing about any scheme is written into the code. The databank/ folder is
// read-only data; this file never writes to it.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  SchemeSchema,
  type LoadProblem,
  type NspRegisterSummary,
  type Scheme,
  type SchemesPayload,
} from "./types";

const DATABANK = path.join(process.cwd(), "databank");

export async function loadAllSchemes(): Promise<{
  schemes: Scheme[];
  problems: LoadProblem[];
}> {
  const dir = path.join(DATABANK, "schemes");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  const schemes: Scheme[] = [];
  const problems: LoadProblem[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = JSON.parse(await readFile(path.join(dir, file), "utf8"));
        const parsed = SchemeSchema.safeParse(raw);
        if (parsed.success) schemes.push(parsed.data);
        else {
          const issue = parsed.error.issues[0];
          problems.push({ file, message: `${issue.path.join(".")}: ${issue.message}` });
        }
      } catch (e) {
        problems.push({ file, message: e instanceof Error ? e.message : "unreadable file" });
      }
    }),
  );

  schemes.sort((a, b) => a.name.localeCompare(b.name));
  return { schemes, problems };
}

// Minimal CSV reader (handles quoted fields with commas).
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}

// DD-MM-YYYY -> YYYY-MM-DD, or null.
function ddmmyyyyToIso(s: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function summariseRegister(csv: string): NspRegisterSummary {
  const [header, ...rows] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  const close = col("student_close");
  const renewal = col("renewal_only");
  const fetched = col("fetched");
  const source = col("source");

  const byDate = new Map<string, number>();
  let renewalOnly = 0;
  for (const r of rows) {
    const iso = ddmmyyyyToIso(r[close] ?? "");
    if (iso) byDate.set(iso, (byDate.get(iso) ?? 0) + 1);
    if ((r[renewal] ?? "").toLowerCase() === "true") renewalOnly++;
  }
  return {
    rows: rows.length,
    renewalOnly,
    closingDates: [...byDate.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    fetched: rows[0]?.[fetched] ?? null,
    source: rows[0]?.[source] ?? null,
  };
}

async function loadRegister(): Promise<NspRegisterSummary | null> {
  try {
    const csv = await readFile(path.join(DATABANK, "registers", "nsp_central_2026_27.csv"), "utf8");
    return summariseRegister(csv);
  } catch {
    return null; // the register is optional
  }
}

// Domestic schemes only (region "india") unless asked for everything.
// Abroad schemes stay hidden for now.
export async function loadPayload(opts: { includeAbroad?: boolean } = {}): Promise<SchemesPayload> {
  const [{ schemes, problems }, register] = await Promise.all([loadAllSchemes(), loadRegister()]);
  const domestic = schemes.filter((s) => s.region === "india");
  return {
    schemes: opts.includeAbroad ? schemes : domestic,
    problems,
    totals: {
      all: schemes.length,
      domestic: domestic.length,
      hiddenAbroad: schemes.length - domestic.length,
    },
    register,
  };
}

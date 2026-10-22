import { ExtractionSchema, type Extraction } from "./schema";
import { FIELDS, OPERATORS, UNITS } from "./vocab";

const has = (list: readonly string[], v: unknown): boolean =>
  typeof v === "string" && list.includes(v);

// Turns the model's raw text into a checked Extraction.
// Throws if it isn't valid JSON or doesn't match the contract.
// Anything outside our vocabulary is demoted to "none / judgement" (which
// ends up as "Can't tell"); it is never trusted.
export function parseModelOutput(raw: string): Extraction {
  let text = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fenced) text = fenced[1];

  const data: unknown = JSON.parse(text);
  if (data && typeof data === "object" && Array.isArray((data as { criteria?: unknown }).criteria)) {
    const obj = data as { criteria: Record<string, unknown>[] };
    obj.criteria = obj.criteria.map((c) => {
      if (!c || typeof c !== "object") return c;
      const outsideVocab =
        !has(FIELDS, c.field) || !has(OPERATORS, c.operator);
      return {
        ...c,
        field: outsideVocab ? "none" : c.field,
        operator: outsideVocab ? "judgement" : c.operator,
        unit: has(UNITS, c.unit) ? c.unit : "none",
        values: Array.isArray(c.values) ? c.values.map(String) : [],
      };
    });
  }
  return ExtractionSchema.parse(data);
}

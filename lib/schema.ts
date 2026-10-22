import { z } from "zod";
import { FIELDS, OPERATORS, UNITS } from "./vocab";

// The "contract": the only shape of answer we accept from Claude.
// Numbers are sent as strings (e.g. "2800") to keep the schema simple;
// plain code turns them into numbers.
export const ExtractionSchema = z.object({
  is_scholarship_notice: z.boolean(),
  reason: z.string(),
  scholarship_name: z.string().nullable(),
  criteria: z.array(
    z.object({
      id: z.string(),
      quote: z.string(),
      field: z.enum(FIELDS),
      operator: z.enum(OPERATORS),
      values: z.array(z.string()),
      unit: z.enum(UNITS),
    }),
  ),
  documents: z.array(z.object({ name: z.string(), quote: z.string() })),
  deadlines: z.array(
    z.object({
      label: z.string(),
      date_iso: z.string().nullable(),
      quote: z.string(),
    }),
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

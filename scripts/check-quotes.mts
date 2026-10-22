// Usage: node scripts/check-quotes.mts <api-response.json> <notice.txt>
// Runs every quote in a saved /api/analyze response through the same
// quote check the app uses, and prints how many were NOT found.
import { readFileSync } from "node:fs";
import { quoteAppearsIn } from "../lib/verifyQuote.ts";

const [, , jsonPath, textPath] = process.argv;
const { extraction } = JSON.parse(readFileSync(jsonPath, "utf8"));
const text = readFileSync(textPath, "utf8");

let total = 0;
let missing = 0;
const check = (kind: string, id: string, quote: string) => {
  total++;
  const ok = quoteAppearsIn(quote, text);
  if (!ok) missing++;
  console.log(`${ok ? "ok     " : "MISSING"} ${kind} ${id}: ${quote.slice(0, 110)}`);
};

for (const c of extraction.criteria) {
  console.log(`   [${c.field} ${c.operator} ${JSON.stringify(c.values)} ${c.unit}]`);
  check("criterion", c.id, c.quote);
}
for (const d of extraction.documents) check("document", d.name, d.quote);
for (const d of extraction.deadlines) {
  console.log(`   [date_iso ${d.date_iso}]`);
  check("deadline", d.label, d.quote);
}
console.log(`\n${total} quotes, ${missing} not found.`);

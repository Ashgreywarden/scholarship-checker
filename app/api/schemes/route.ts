import { connection } from "next/server";
import { loadPayload } from "@/lib/databank/load";

// Serves the scholarship data bank (read from databank/schemes/*.json on every
// request, so edits to the data show up without a rebuild). Domestic schemes
// only; the abroad ones stay hidden for now.
export async function GET() {
  await connection(); // read the files at request time, not at build time
  try {
    return Response.json(await loadPayload());
  } catch {
    return Response.json(
      { error: { code: "databank_unreadable", message: "The scholarship data bank could not be read." } },
      { status: 500 },
    );
  }
}

import { Suspense } from "react";
import { connection } from "next/server";
import { Landing } from "@/components/Landing";
import { loadPayload } from "@/lib/databank/load";

// The scheme count comes from the real data bank, read at request time.
async function LandingWithCount() {
  await connection();
  let count: number | null = null;
  try {
    count = (await loadPayload()).totals.domestic;
  } catch {
    count = null; // the page still works without the number
  }
  return <Landing schemeCount={count} />;
}

export default function HomePage() {
  return (
    <Suspense fallback={<Landing schemeCount={null} />}>
      <LandingWithCount />
    </Suspense>
  );
}

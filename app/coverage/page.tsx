"use client";

import { useMemo } from "react";
import { CoveragePage } from "@/components/CoveragePage";
import { ErrorState, LoadingState } from "@/components/FeedbackState";
import { toUiSchemeForCoverage } from "@/lib/ui/adapters";
import { useSchemes } from "@/lib/ui/useSchemes";

export default function CoverageRoute() {
  const { load, reload } = useSchemes();

  // Counted from the real data bank (domestic schemes).
  const view = useMemo(() => {
    if (load.kind !== "ready") return null;
    const today = new Date();
    const dates = load.payload.schemes
      .map((s) => s.verified_on)
      .filter((v): v is string => !!v)
      .sort();
    return {
      schemes: load.payload.schemes.map((s) => toUiSchemeForCoverage(s, today)),
      updatedAt: dates.at(-1),
    };
  }, [load]);

  if (load.kind === "loading") {
    return (
      <main id="main-content" className="page">
        <LoadingState message="Loading the data bank…" />
      </main>
    );
  }
  if (load.kind === "error" || !view) {
    return (
      <main id="main-content" className="page">
        <ErrorState
          message={load.kind === "error" ? load.message : undefined}
          onRetry={reload}
        />
      </main>
    );
  }

  return <CoveragePage schemes={view.schemes} updatedAt={view.updatedAt} />;
}

"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/FeedbackState";
import { ResultsPage } from "@/components/ResultsPage";
import { matchAll } from "@/lib/match/engine";
import { profileFromUi, toUiScheme } from "@/lib/ui/adapters";
import { useSchemes } from "@/lib/ui/useSchemes";
import { useStoredProfile } from "@/lib/ui/useStoredProfile";

export default function ScholarshipsPage() {
  const { load, reload } = useSchemes();
  const profile = useStoredProfile(); // undefined until the browser has been read

  // Matching is plain code in the browser: the profile never leaves this device.
  const schemes = useMemo(() => {
    if (load.kind !== "ready" || !profile) return [];
    const matches = matchAll(load.payload.schemes, profileFromUi(profile), new Date());
    return matches.map(toUiScheme);
  }, [load, profile]);

  if (profile === null) {
    return (
      <main id="main-content" className="page">
        <EmptyState
          title="Tell us about you first"
          message="Answer a few questions and we'll compare the published rules with your answers. They stay in this browser."
        />
      </main>
    );
  }

  return (
    <ResultsPage
      schemes={schemes}
      state={
        profile === undefined || load.kind === "loading"
          ? "loading"
          : load.kind === "error"
            ? "error"
            : "success"
      }
      onRetry={reload}
    />
  );
}

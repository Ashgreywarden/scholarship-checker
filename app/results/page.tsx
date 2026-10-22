"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/FeedbackState";
import { ResultsPage, type BestMatch } from "@/components/ResultsPage";
import { matchAll } from "@/lib/match/engine";
import { codeRanking } from "@/lib/rank/fallback";
import { FALLBACK_NOTE, MAX_BEST, type RankItem } from "@/lib/rank/types";
import { profileFromUi, toUiScheme } from "@/lib/ui/adapters";
import { useRanking } from "@/lib/ui/useRanking";
import { useSchemes } from "@/lib/ui/useSchemes";
import { useStoredProfile } from "@/lib/ui/useStoredProfile";

export default function ScholarshipsPage() {
  const { load, reload } = useSchemes();
  const profile = useStoredProfile(); // undefined until the browser has been read
  const ranking = useRanking(profile);

  // Step 1-2: our rule checker runs on the data bank, in this browser.
  const matches = useMemo(() => {
    if (load.kind !== "ready" || !profile) return [];
    return matchAll(load.payload.schemes, profileFromUi(profile), new Date());
  }, [load, profile]);
  const schemes = useMemo(() => matches.map(toUiScheme), [matches]);

  // The best picks: the AI's ranking, or our own if the AI could not be used.
  const { best, note, rankedByAi } = useMemo(() => {
    const byId = new Map(schemes.map((s) => [s.id, s]));
    let items: RankItem[] = [];
    let note: string | null = null;
    let rankedByAi = false;

    if (ranking.status === "ready") {
      items = ranking.response.ranked;
      note = ranking.response.note;
      rankedByAi = ranking.response.source === "ai";
    } else if (ranking.status === "failed") {
      items = codeRanking(matches, MAX_BEST);
      note = FALLBACK_NOTE;
    }

    // Only schemes our own checker did not rule out can be "best matches".
    const best: BestMatch[] = items
      .map((item) => ({ item, scheme: byId.get(item.scheme_id) }))
      .filter((x) => x.scheme && x.scheme.verdict !== "not_eligible")
      .map((x) => ({ scheme: x.scheme!, why: x.item.why_it_fits, confirm: x.item.to_confirm }));
    return { best, note, rankedByAi };
  }, [ranking, schemes, matches]);

  if (profile === null) {
    return (
      <main id="main-content" className="page">
        <EmptyState
          title="Tell us about you first"
          message="Answer a few questions and we'll compare the published rules with your answers."
        />
      </main>
    );
  }

  return (
    <ResultsPage
      schemes={schemes}
      best={best}
      bestState={ranking.status === "loading" ? "loading" : "ready"}
      rankingNote={note}
      rankedByAi={rankedByAi}
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

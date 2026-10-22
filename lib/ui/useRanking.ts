"use client";

import { useEffect, useState } from "react";
import type { RankResponse } from "../rank/types";
import type { StudentProfile } from "./types";

export type RankingState =
  | { status: "loading" }
  | { status: "ready"; response: RankResponse }
  | { status: "failed" };

// Asks /api/rank (Gemini on the server) to rank the schemes for this profile.
// If the request fails the page uses our own code ranking instead.
export function useRanking(profile: StudentProfile | null | undefined): RankingState {
  const key = profile ? JSON.stringify(profile) : null;
  const [done, setDone] = useState<{ key: string; value: RankingState } | null>(null);

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    // The server gives Gemini 15 seconds; if we hear nothing in 25, use our own ranking.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 25_000);
    fetch("/api/rank", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: JSON.parse(key) }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !Array.isArray(data.ranked)) throw new Error("rank failed");
        setDone({ key, value: { status: "ready", response: data as RankResponse } });
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError" && !timedOut) return;
        setDone({ key, value: { status: "failed" } });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);

  return key && done?.key === key ? done.value : { status: "loading" };
}

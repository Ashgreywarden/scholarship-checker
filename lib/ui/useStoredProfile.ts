"use client";

import { useMemo, useSyncExternalStore } from "react";
import { parseProfile, readRawProfile } from "./profile";
import type { StudentProfile } from "./types";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// The profile saved in this browser.
//   undefined = not read yet (server render / first paint)
//   null      = nothing saved
export function useStoredProfile(): StudentProfile | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    readRawProfile,
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : parseProfile(raw)), [raw]);
}

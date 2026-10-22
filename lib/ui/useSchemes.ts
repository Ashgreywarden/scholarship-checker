"use client";

import { useCallback, useEffect, useState } from "react";
import type { SchemesPayload } from "../databank/types";

export type SchemesLoad =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; payload: SchemesPayload };

// Loads the scholarship data bank from /api/schemes (domestic schemes only).
export function useSchemes(): { load: SchemesLoad; reload: () => void } {
  const [load, setLoad] = useState<SchemesLoad>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/schemes")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.schemes) {
          throw new Error(data?.error?.message ?? "Could not load the scholarship data bank.");
        }
        if (!cancelled) setLoad({ kind: "ready", payload: data as SchemesPayload });
      })
      .catch((e) => {
        if (!cancelled) {
          setLoad({
            kind: "error",
            message: e instanceof Error ? e.message : "Could not load the scholarship data bank.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setLoad({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { load, reload };
}

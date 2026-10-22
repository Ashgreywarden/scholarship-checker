"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CriteriaTable from "@/components/CriteriaTable";
import { Deadlines, Documents } from "@/components/DocsAndDeadline";
import ErrorPanel from "@/components/ErrorPanel";
import NoticeInput from "@/components/NoticeInput";
import ProfileForm from "@/components/ProfileForm";
import VerdictCard from "@/components/VerdictCard";
import { analyze } from "@/lib/analyze";
import { checkNoticeText } from "@/lib/inputCheck";
import {
  EMPTY_PROFILE_INPUT,
  parseProfileInput,
  type ProfileInput,
} from "@/lib/profileInput";
import type { Extraction } from "@/lib/schema";

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "done"; extraction: Extraction; text: string };

export default function Home() {
  const [input, setInput] = useState<ProfileInput>(EMPTY_PROFILE_INPUT);
  const [notice, setNotice] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [have, setHave] = useState<Set<number>>(new Set());
  const resultRef = useRef<HTMLDivElement>(null);

  const { profile, problems } = useMemo(() => parseProfileInput(input), [input]);

  // The comparing is plain code in the browser, so the result updates
  // instantly if the student changes an answer. The profile is never sent.
  const analysis = useMemo(
    () =>
      phase.kind === "done"
        ? analyze(phase.extraction, phase.text, profile, new Date())
        : null,
    [phase, profile],
  );

  useEffect(() => {
    if (phase.kind === "done" || phase.kind === "error") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [phase]);

  async function check() {
    const problem = checkNoticeText(notice);
    if (problem) {
      setPhase({ kind: "error", message: problem });
      return;
    }
    setPhase({ kind: "loading" });
    setHave(new Set());
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: notice }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.extraction) {
        setPhase({
          kind: "error",
          message: data?.error?.message ?? "Something went wrong. Please try again.",
        });
        return;
      }
      setPhase({ kind: "done", extraction: data.extraction, text: notice });
    } catch {
      setPhase({
        kind: "error",
        message: "Could not reach the server. Check your internet connection and try again.",
      });
    }
  }

  const loading = phase.kind === "loading";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Scholarship Checker</h1>
        <p className="mt-2 text-slate-600">
          Paste a scholarship notice. See whether you qualify, which documents you need, and the deadline.
        </p>
      </header>

      <form
        className="mt-6 space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) void check();
        }}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">1. Your details</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">
            Skip anything you are not sure about. Your answers stay in your browser and are never sent anywhere.
          </p>
          <ProfileForm value={input} onChange={setInput} problems={problems} />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold">2. Paste the notice</h2>
          <div className="mt-3">
            <NoticeInput value={notice} onChange={setNotice} />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-base font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-wait disabled:bg-indigo-400 sm:w-auto"
          >
            {loading && (
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
              />
            )}
            {loading ? "Reading the notice…" : "Check my eligibility"}
          </button>
          {loading && (
            <p className="mt-2 text-sm text-slate-600" role="status">
              This usually takes under 20 seconds.
            </p>
          )}
        </section>
      </form>

      <div ref={resultRef} className="scroll-mt-4 space-y-8 pt-6" aria-live="polite">
        {phase.kind === "error" && <ErrorPanel message={phase.message} />}

        {phase.kind === "done" && analysis && (
          <>
            <VerdictCard
              verdict={analysis.verdict}
              rows={analysis.rows}
              scholarshipName={phase.extraction.scholarship_name}
            />
            <CriteriaTable rows={analysis.rows} />
            <Documents
              documents={analysis.documents}
              have={have}
              onToggle={(i) =>
                setHave((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                })
              }
            />
            <Deadlines deadlines={analysis.deadlines} />
            <p className="text-xs text-slate-500">
              Results update as you change your answers above. Work experience given in hours is counted at 1,400 hours per year.
            </p>
          </>
        )}
      </div>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Always confirm on the official site.</p>
        <p className="mt-1">
          This tool only reads the text you paste. It can miss a rule, and notices change. Quoted lines are checked against your text; any line that is not found is marked and ignored.
        </p>
      </footer>
    </main>
  );
}

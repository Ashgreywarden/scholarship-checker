"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ClipboardPaste, LockKeyhole } from "lucide-react";
import { checkNoticeText, MAX_NOTICE_CHARS } from "@/lib/inputCheck";
import type { Scheme, StudentProfile } from "@/lib/ui/types";
import { useStoredProfile } from "@/lib/ui/useStoredProfile";
import { SchemeCard } from "./SchemeCard";
import { ErrorState, LoadingState } from "./FeedbackState";

// Thrown by onCheck so the screen can show the real reason (not a scholarship
// notice, too many requests, out of credits ...) instead of a generic message.
export class NoticeCheckError extends Error {}

export function NoticeChecker({
  onCheck,
}: {
  onCheck: (
    notice: string,
    profile: StudentProfile,
    // Asked here, not in the profile, because no Indian scheme in the data bank
    // needs it; only some notices (for example Chevening) do.
    extras: { workYears: string },
  ) => Promise<Scheme>;
}) {
  const stored = useStoredProfile(); // undefined until the browser has been read
  const ready = stored !== undefined;
  const profile = stored ?? null;
  const [notice, setNotice] = useState("");
  const [workYears, setWorkYears] = useState("");
  const [result, setResult] = useState<Scheme | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [validation, setValidation] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const resultRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const requests = requestId;
    return () => { requests.current += 1; };
  }, []);

  useEffect(() => {
    if (state === "success" || state === "error") {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (state === "success") resultRef.current?.focus();
  }, [state]);

  async function check(event?: FormEvent) {
    event?.preventDefault();

    // Empty, tiny or oversized text is rejected here, before any AI call.
    const problem = checkNoticeText(notice);
    if (problem) {
      setValidation(problem);
      setResult(null);
      setState("idle");
      document.getElementById("notice-text")?.focus();
      return;
    }
    if (!profile) return;

    setValidation("");
    setResult(null);
    setErrorMessage("");

    const current = ++requestId.current;
    setState("loading");

    try {
      const nextResult = await onCheck(notice.trim(), profile, { workYears });
      if (current !== requestId.current) return;
      setResult(nextResult);
      setState("success");
    } catch (error) {
      if (current !== requestId.current) return;
      setErrorMessage(
        error instanceof NoticeCheckError
          ? error.message
          : "We could not check this notice. Your pasted text is still on this page.",
      );
      setState("error");
    }
  }

  return (
    <main id="main-content" className="page max-w-4xl">
      <p className="eyebrow">Check a notice</p>
      <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
        Does this scholarship fit you?
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Paste the notice text. We read its rules, show the exact line for each one,
        and compare them with your saved profile. A notice alone does not confirm
        that a scheme is genuine.
      </p>

      {ready && !profile && (
        <div className="card mt-6 p-5" data-testid="need-profile">
          <p className="font-semibold">Create your profile first</p>
          <p className="mt-1 text-muted">We need your answers to check the rules.</p>
          <Link href="/profile" className="text-link mt-2">Fill my profile</Link>
        </div>
      )}

      <form onSubmit={check} className="card mt-6 p-5 sm:p-7">
        <label htmlFor="notice-text" className="field-label">
          Scholarship notice
        </label>
        <p id="notice-help" className="mb-3 text-sm text-muted">
          Include eligibility rules, amount, deadline and source details if available.
          Do not paste Aadhaar numbers, bank details or passwords.
        </p>
        <textarea
          id="notice-text"
          value={notice}
          rows={12}
          disabled={state === "loading"}
          onChange={(event) => {
            requestId.current += 1;
            setNotice(event.target.value);
            setResult(null);
            setState("idle");
            setValidation("");
          }}
          placeholder="Paste the notice text here…"
          className="field resize-y"
          aria-invalid={Boolean(validation)}
          aria-describedby={`notice-help${validation ? " notice-error" : ""}`}
        />
        <div className="mt-2 flex justify-between gap-3 text-sm text-muted">
          <span>Text only. Up to {MAX_NOTICE_CHARS.toLocaleString("en-IN")} characters.</span>
          <span className={notice.length > MAX_NOTICE_CHARS ? "font-semibold text-status-red" : ""}>
            {notice.length.toLocaleString("en-IN")}/{MAX_NOTICE_CHARS.toLocaleString("en-IN")}
          </span>
        </div>
        {validation && (
          <p id="notice-error" role="alert" className="mt-2 text-status-red" data-testid="validation">
            {validation}
          </p>
        )}

        <div className="mt-5">
          <label htmlFor="workYears" className="field-label">
            Years of full-time work <span className="font-normal text-muted">(optional)</span>
          </label>
          <p id="work-hint" className="mb-2 text-sm text-muted">
            Only needed if the notice asks for work experience. Use 0 if none.
          </p>
          <input
            id="workYears"
            type="number"
            inputMode="decimal"
            min="0"
            max="80"
            step="any"
            value={workYears}
            disabled={state === "loading"}
            onChange={(event) => setWorkYears(event.target.value)}
            className="field sm:max-w-48"
            aria-describedby="work-hint"
          />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={!ready || !profile || state === "loading"}
            className="btn-primary"
          >
            <ClipboardPaste size={19} aria-hidden="true" />
            {state === "loading" ? "Reading the notice…" : "Check against my profile"}
          </button>
          <Link href="/profile" className="text-link">Edit my profile</Link>
        </div>

        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <LockKeyhole size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          Only the notice text is sent to our server. Your profile stays in this browser.
        </p>
      </form>

      <section aria-label="Notice check result" className="mt-6" aria-live="polite">
        {state === "loading" && (
          <LoadingState message="Reading the notice. This usually takes under 20 seconds." />
        )}
        {state === "error" && (
          <div ref={resultRef} tabIndex={-1}>
            <ErrorState
              title="We couldn't check this"
              message={`${errorMessage} No verdict is shown.`}
              onRetry={() => { void check(); }}
            />
          </div>
        )}
        {result && state === "success" && (
          <div ref={resultRef} tabIndex={-1}>
            <h2 className="mb-4 font-display text-2xl font-semibold">Your fit check</h2>
            <SchemeCard scheme={result} initiallyExpanded />
            <p className="mt-4 text-sm text-muted">
              Results use your saved profile. Work experience given in hours is counted at 1,400 hours per year.
              Always confirm on the official site.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

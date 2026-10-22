"use client";

import { AlertCircle, ArrowRight, SearchX } from "lucide-react";
import Link from "next/link";

export function LoadingState({
  message = "Finding your scholarships…",
}: {
  message?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <p className="font-semibold text-brand">{message}</p>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          aria-hidden="true"
          className="card space-y-4 p-6 motion-safe:animate-pulse"
        >
          <div className="h-5 w-28 rounded bg-line" />
          <div className="h-7 w-3/4 rounded bg-line" />
          <div className="h-4 w-1/2 rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message = "We could not load the scholarships. Your saved answers are still in this browser.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="card p-6" data-testid="error-panel">
      <AlertCircle className="text-status-red" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-xl text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  filtered = false,
  onClear,
  title,
  message,
}: {
  filtered?: boolean;
  onClear?: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <div className="card px-6 py-12 text-center" role="status">
      <SearchX size={32} className="mx-auto text-brand" aria-hidden="true" />
      <h2 className="mt-4 font-display text-2xl font-semibold">
        {title ?? (filtered ? "No schemes match these filters" : "No schemes to show yet")}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-muted">
        {message ??
          (filtered
            ? "Try fewer filters or search with another word."
            : "This does not mean you cannot get support. Review your profile or check again when more schemes are added.")}
      </p>
      {filtered && onClear ? (
        <button type="button" onClick={onClear} className="btn-secondary mt-5">
          Clear filters
        </button>
      ) : (
        <Link href="/profile" className="btn-secondary mt-5">
          Review my profile
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

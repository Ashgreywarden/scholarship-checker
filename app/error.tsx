"use client";

import { ErrorState } from "@/components/FeedbackState";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main-content" className="page">
      <ErrorState onRetry={reset} />
    </main>
  );
}

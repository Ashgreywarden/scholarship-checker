import { LoadingState } from "@/components/FeedbackState";

export default function Loading() {
  return (
    <main id="main-content" className="page">
      <LoadingState message="Getting your next step ready…" />
    </main>
  );
}

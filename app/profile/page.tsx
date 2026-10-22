"use client";

import { useRouter } from "next/navigation";
import { LoadingState } from "@/components/FeedbackState";
import { ProfileStepper } from "@/components/ProfileStepper";
import { EMPTY_PROFILE } from "@/lib/ui/profile";
import { useStoredProfile } from "@/lib/ui/useStoredProfile";

export default function ProfilePage() {
  const router = useRouter();
  const saved = useStoredProfile(); // undefined until the browser has been read

  if (saved === undefined) {
    return (
      <main id="main-content" className="page">
        <LoadingState message="Loading your saved answers…" />
      </main>
    );
  }

  return (
    <ProfileStepper
      initial={saved ?? EMPTY_PROFILE}
      onComplete={() => {
        // ProfileStepper has already saved the answers in this browser.
        router.push("/results");
      }}
    />
  );
}

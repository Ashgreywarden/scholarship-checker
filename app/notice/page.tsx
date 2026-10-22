"use client";

import { NoticeCheckError, NoticeChecker } from "@/components/NoticeChecker";
import { analyze } from "@/lib/analyze";
import { ExtractionSchema } from "@/lib/schema";
import { noticeToUiScheme, profileFromUi } from "@/lib/ui/adapters";
import type { Scheme, StudentProfile } from "@/lib/ui/types";

// Sends ONLY the pasted text to the existing /api/analyze route (Gemini reads
// the notice). The comparing happens here, in the browser, with plain code, so
// the profile is never sent anywhere.
async function checkNotice(notice: string, profile: StudentProfile): Promise<Scheme> {
  let res: Response;
  try {
    res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: notice }),
    });
  } catch {
    throw new NoticeCheckError(
      "Could not reach the server. Check your internet connection and try again.",
    );
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new NoticeCheckError(
      data?.error?.message ?? "Something went wrong. Please try again.",
    );
  }

  const parsed = ExtractionSchema.safeParse(data?.extraction);
  if (!parsed.success) {
    throw new NoticeCheckError("The answer from the server could not be read. Please try again.");
  }

  const today = new Date();
  const analysis = analyze(parsed.data, notice, profileFromUi(profile), today);
  return noticeToUiScheme(analysis, parsed.data.scholarship_name, today);
}

export default function NoticePage() {
  return <NoticeChecker onCheck={checkNotice} />;
}

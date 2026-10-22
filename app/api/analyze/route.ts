import { AiError, extractNotice } from "@/lib/ai";
import { cheveningExtraction } from "@/lib/fixtures";
import { checkNoticeText } from "@/lib/inputCheck";
import { checkRateLimit } from "@/lib/rateLimit";

// Vercel: allow up to 60 s for the AI call.
export const maxDuration = 60;

function fail(status: number, code: string, message: string, extra?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers: extra });
}

// Receives ONLY the pasted notice text. The student's profile never reaches
// the server or the AI; the browser compares it afterwards.
export async function POST(request: Request) {
  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return fail(400, "bad_request", "Could not read the request.");
  }
  if (typeof text !== "string") {
    return fail(400, "bad_request", "Please paste the notice text.");
  }

  const problem = checkNoticeText(text);
  if (problem) return fail(400, "bad_input", problem);

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.ok) {
    return fail(
      429,
      "rate_limited",
      "Too many checks from your network. Please wait a few minutes and try again.",
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }

  try {
    // Dev-only switch used to demo the "fake quote" warning on screen.
    const extraction =
      process.env.NODE_ENV !== "production" && process.env.MOCK_AI === "tamper"
        ? {
            ...cheveningExtraction,
            criteria: [
              ...cheveningExtraction.criteria,
              {
                id: "fake",
                quote: "Applicants must be under 20 years of age.",
                field: "age" as const,
                operator: "lte" as const,
                values: ["20"],
                unit: "years" as const,
              },
            ],
          }
        : await extractNotice(text);

    if (!extraction.is_scholarship_notice) {
      return fail(
        422,
        "not_a_notice",
        `This doesn't look like a scholarship notice. ${extraction.reason}`.trim(),
      );
    }
    if (extraction.criteria.length === 0) {
      return fail(
        422,
        "no_rules",
        "We couldn't find any eligibility rules in this text. Paste the eligibility section of the notice.",
      );
    }
    return Response.json({ extraction });
  } catch (e) {
    if (e instanceof AiError) {
      const status =
        e.code === "out_of_credits" ? 402
        : e.code === "rate_limited" ? 429
        : e.code === "config" || e.code === "auth" ? 500
        : 502;
      return fail(status, e.code, e.message);
    }
    console.error("[analyze] unexpected error");
    return fail(500, "unexpected", "Something went wrong. Please try again.");
  }
}

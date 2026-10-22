# Scholarship Eligibility Checker

Paste a scholarship notice, fill in an 8-field profile, and see: do I qualify, which documents do I need, and what is the deadline. Every rule shows the exact line from your pasted text.

## How it works

- **The AI only reads.** Gemini (via OpenRouter) turns the pasted notice into a list of rules, documents and deadlines, each with a quote. It never sees your profile and never decides eligibility.
- **Plain code decides.** The comparisons (numbers, dates), the check that every quote really appears in your pasted text, and the verdict are ordinary code in `lib/`. A quote that is not found is flagged on screen and not counted.
- Your profile stays in your browser. Only the notice text is sent to the server.

## Run it

1. Copy `.env.example` to `.env.local` and put your OpenRouter key in `OPENROUTER_API_KEY`. This file is git-ignored; never commit or paste the key anywhere.
2. `npm install`
3. `npm run dev`, then open http://localhost:3000
4. `npm test` runs the plain-code tests (no key or network needed).

## AI provider rules

- Gemini through OpenRouter only (`https://openrouter.ai/api/v1/chat/completions`). Never Google AI Studio or Vertex directly.
- Only `google/` model ids; default `google/gemini-3.7-flash` (override with `OPENROUTER_MODEL`).
- Every request carries `provider: { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false }`.
- All of this is in one file, `lib/ai.ts`, so the provider can be swapped.
- 429 / 5xx are retried up to 3 times with backoff. 402 (out of credits) stops with a clear error.

## Deploy

Vercel: import the repo and set `OPENROUTER_API_KEY` in the project's environment variables.

## Limits

The AI can miss a rule; the quote check catches invented rules, not omissions. Always confirm on the official site.

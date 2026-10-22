# Scholarship Eligibility Checker

Paste a scholarship notice, fill in an 8-field profile, and see: **do I qualify, which documents am I missing, and what is the deadline.** Every rule shows the exact line from your pasted text, so you can check it yourself.

Built for first-generation, low-income Indian students (first year of college, or final year looking at a master's abroad). Hackathon MVP: one screen, no login, no database.

## The job to be done

> When I find a scholarship notice (in India or abroad), I want to know whether I qualify, which documents I'm missing and the deadline, so I can decide whether to apply instead of spending weeks reading rules.

## The 3 tests the MVP must pass

1. **Chevening.** Fill the 8-field profile (course level, age, state, category, annual family income, marks %, years of work experience, nationality), paste Chevening's eligibility page, and within 30 seconds see Eligible / Not eligible / Can't tell. With 1 year of work experience it must say **Not eligible** and show the 2,800-hour rule quoted from the pasted text. Every other rule shows pass / fail / can't tell.
2. **An unseen notice** (for example an NSP guideline). See the rules extracted, a verdict, the documents needed and the deadline, with the exact line from the pasted text for every rule.
3. **Bad input.** Empty text or text that isn't a scholarship notice gives a clear error and no verdict. If the AI quotes a line that is not in the pasted text, that rule is flagged on screen instead of shown as fact.

## Current vs future workflow

| | Today (without this tool) | With this tool (built) | Future (not built) |
|---|---|---|---|
| Find the rules | Read long PDFs and web pages, often in dense legal English | Paste the text, wait about 10–20 seconds | Paste a link instead of text |
| Check yourself against them | Compare each rule to your own marks, income, category by hand | Plain code compares your 8 answers to each rule | Remember your profile between visits |
| Know what to collect | Hunt through the notice, miss a certificate | Documents list with "I have this" checkboxes and "4 of 6 still needed" | Read a photo of your certificate to fill the profile |
| Know the deadline | Easy to miss | Date read from the quoted line, with days left | Reminders before the deadline |
| Decide | Weeks later, after asking seniors | Same day: apply, skip, or go and check the rules marked "Can't tell" | Compare several scholarships side by side |

Out of scope on purpose: login, database, saving history, fetching URLs, reading certificate photos, applying for the student, payments, predicting the chance of winning.

## Architecture: Input → AI → Logic → Action → Output

```
INPUT                  AI                      LOGIC (plain code)            ACTION             OUTPUT
8-field profile   ┐                                                                          Verdict badge
(stays in the     │   Gemini reads the       verify every quote is in      Student ticks      Rules table with
browser)          ├─▶ pasted notice and  ──▶ the pasted text, convert  ──▶ documents, checks  quoted lines and
Pasted notice     │   returns rules,         units, compare numbers,       "Can't tell" rules  orange flags
text (sent to     ┘   documents, dates       read the date from the        and confirms on     Documents checklist
the server only)      with quotes (JSON)     quote, decide the verdict     the official site   Deadline + days left
```

- **Input.** For a pasted notice, the profile never leaves the browser: only the notice text goes to the server (`app/api/analyze/route.ts`), after a size check and a per-IP rate limit. For `/results`, a summary of the answers goes to `/api/rank` (see below).
- **AI.** One call, in one file (`lib/ai.ts`). The model only reads the notice.
- **Logic.** Everything after the AI call is ordinary code in `lib/`, runs in the browser, and has unit tests.
- **Action.** The app does not apply for anyone. The student decides, ticks off documents, and checks the official site.
- **Output.** One screen, built to read on a phone.

## Where AI is used (and where it is not)

AI is used **once**: Gemini (via OpenRouter) turns the messy notice text into structured data:

- each eligibility rule as `{ quote, field, operator, value, unit }`, or `judgement` when it is subjective
- each required document with a quote
- each date with a quote

The prompt ([lib/prompt.ts](lib/prompt.ts)) says: quote exactly, never invent a rule, and treat the notice as data, not instructions. When reading a notice, the AI **never sees your profile and never decides eligibility.** (The results ranking does see a summary of the profile, but it only orders and explains; see below.)

Plain code does everything that must be exactly right:

| Job | Where |
|---|---|
| Check that each quote really appears in the pasted text (ignoring only case, spacing, curly quotes and dashes) | [lib/verifyQuote.ts](lib/verifyQuote.ts) |
| Convert units (lakh to rupees, months or hours to years at 1,400 hours per year) and compare numbers | [lib/normalize.ts](lib/normalize.ts), [lib/evaluate.ts](lib/evaluate.ts) |
| Read the deadline date from the quoted line, not from the AI's date field | [lib/analyze.ts](lib/analyze.ts) |
| Combine rows into the verdict | [lib/verdict.ts](lib/verdict.ts) |
| Reject empty, tiny or oversized text before any AI call | [lib/inputCheck.ts](lib/inputCheck.ts) |

Verdicts: **Not eligible** (a rule that was verified in your text fails), **Passes all checkable rules** (nothing fails; the rest need your judgement), **Eligible** (every rule passes and none needs judgement), **Can't tell**. Plain "Eligible" is never shown when a judgement rule exists.

## What stays human

- **Judgement rules** (leadership, motivation, essay quality, "good character") always show "Can't tell". Software can't decide them.
- **Rules about things we don't ask** (for example "no previous UK scholarship") are marked "Check this yourself".
- **The decision to apply**, collecting the documents, and the application itself.
- **Confirming on the official site.** The tool reads only what you paste. It can miss a rule, and notices change.
- **Your answers.** If you skip a field or enter something wrong, the matching rules show "Can't tell" or a wrong result. The tool does not guess.

## Why these tools

- **Next.js on Vercel.** One app, one screen, one deploy. The API route keeps the key on the server.
- **Gemini through OpenRouter.** The organisers' rule: Gemini only, reached only through OpenRouter. Model `google/gemini-3.7-flash` is fast enough for the 30-second target and supports structured JSON (`json_schema`), so answers come back in a fixed shape. All provider code is in `lib/ai.ts`, so it is swappable.
- **Plain code for comparing.** Numbers, units and dates must be exact and testable. A language model can be fluent and wrong; a comparison function with a test cannot.
- **zod.** Checks the AI's JSON. Anything outside our vocabulary becomes "Can't tell", never a guess.
- **Vitest.** 51 tests run in under a second with no key and no network.

## Failure cases and what happens

| Failure | What the student sees |
|---|---|
| Empty or tiny text | Clear error, no verdict, no AI call |
| Text over 30,000 characters | Error asking to paste only the eligibility section. Never silently cut |
| Text isn't a scholarship notice | "This doesn't look like a scholarship notice", no verdict |
| AI quotes a line that isn't in the text | Orange "Quote not found in your text. Not counted." and the rule is left out of the verdict |
| AI's date disagrees with its quote | We use the date written in the quote and show a warning. If the quote has no complete date (no year, or "October 2026" only), no deadline is shown |
| Messy PDF table text | Quotes can be short fragments. The server re-asks the model once about unverified quotes (see test results). Whatever is still not found is flagged |
| AI returns unreadable JSON | One automatic retry, then "The AI gave an answer we couldn't read" |
| Words outside our vocabulary | Rule becomes "Can't tell" |
| Income in pounds or dollars, CGPA instead of percent, unknown units | "Can't tell" |
| You skipped a profile field | The rules that need it show "Can't tell" |
| Too many requests from one network | Rate-limit message with a wait time |
| OpenRouter busy (429) or down (5xx) | Up to 3 retries with backoff, then a clear error |
| Out of credits (402) | Stops at once with a clear message |
| Instructions hidden inside a pasted notice | Treated as data, not followed |
| **The AI misses a rule** | **Not caught.** The quote check finds invented rules, not missing ones. This is why the footer says to confirm on the official site |

## Test results

All numbers are from real runs against the live model (`google/gemini-3.7-flash` via OpenRouter), using the real Chevening eligibility page, the real Chevening application timeline page, and a real Ministry of Tribal Affairs scholarship guideline for a scheme applied for through the National Scholarship Portal (Part B of a PDF copied from nia.nic.in, about 9,000 characters including messy tables). This is not the NSP post-matric scheme itself. The saved texts are in `fixtures/`.

**The 3 tests, in the browser preview**

| Test | Result | Evidence |
|---|---|---|
| 1. Chevening, 1 year of work experience | **PASS** | "Not eligible" in 7.1 s. The work-experience row fails and quotes "Have at least two years' work experience, … equivalent to 2,800 hours." With 2 years it becomes "Passes all checkable rules". |
| 2. Unseen NSP guideline | **PASS** | 5 rules, verdict "Passes all checkable rules", 6 documents with sources. The text has no deadline, and the screen says so instead of inventing one. |
| 3a. Empty text | **PASS** | Error panel, 0 API calls, no verdict |
| 3b. A recipe | **PASS** | "This doesn't look like a scholarship notice", no verdict |
| 3c. Fake quote (dev switch `MOCK_AI=tamper`) | **PASS** | Orange flag on the made-up rule; verdict unchanged; "1 rule ignored" |

**Deadline check on the real Chevening pages.** The eligibility page contains no date. On the application timeline page, "OCTOBER 2026 APPLICATIONS CLOSE" says "Please refer to your country page for the deadline", so there is no day to show and the tool shows none. The one full date is returned like this:

- Quote: "The deadline to receive and submit at least one unconditional UK university offer is 17:00 BST (UK time) on 8 July 2027."
- Date parsed by code from the quote: **2027-07-08**, shown as "8 Jul 2027, 259 days left" (counted from 22 Oct 2026).
- Unit tests cover the AI giving the wrong year (the quote's date wins and a warning is shown), no date in the quote, and several dates in one quote.

**Flagged quotes: what went wrong first, and the fix.** The target is 0 quotes flagged "not found".

| Stage | Flagged | What happened |
|---|---|---|
| First NSP run, first prompt | 5 of 12 | The model joined words from different table columns into one tidy phrase that is not in the text |
| After a prompt rule ("quote only the uninterrupted run of words") | 0 in 6 scripted runs | Looked solved |
| First NSP run in the browser | 4 of 6 document quotes | The prompt fix alone was not reliable |
| After the **repair retry** | 0 in 3 browser runs, then 0 in 2 more scripted runs and 1 more browser run | The server checks every quote against the pasted text. If any are missing, it asks the model once more, naming them, and keeps the new answer only if it has fewer bad quotes |
| Chevening eligibility + timeline pasted together | 0 of 16 | |

One more false alarm: my first scripted Chevening run showed 2 of 13 quotes missing. That was a bug in my own test script (PowerShell decoded the response as the wrong text encoding), not the app.

These are small samples (3–6 runs per page). Response time was 5–21 s; the slowest was the combined Chevening text at 21 s from a script (10.8 s in the browser). All were under the 30-second target, but a slow model day or a repair call could push a long notice past it.

**Known rough edge.** When a pasted PDF table splits a document's name across columns, the only exact quote available is a fragment, such as "the bank passbook" or "qualifying". The document name is always shown clearly, with the quote in a small "Source" line. We trim leading row numbers and trailing column words like "Yes Yes" for display only; checking always uses the full quote.

## Find my scholarships and Coverage

Besides checking one pasted notice, the app can match a student against the **scholarship data bank** in `databank/` (read-only data: one JSON file per scheme, each rule with a verbatim official quote).

Pages (the ScholarPath design):

| Route | What it does |
|---|---|
| `/` | Landing page (no scheme counts) |
| `/profile` | Five-step profile. Answers are saved in this browser only (localStorage) |
| `/results` | **Best matches for you** (up to 8, ranked by Gemini, each with a one-line reason), then **More schemes you may qualify for**. Every card shows the verdict, the deciding rule with its official quote, amount, deadline and status, and the official apply link. Schemes the rules rule out are hidden until you tick the box. The paste-a-notice link sits at the bottom of this page only |
| `/notice` | Paste a notice (not in the main navigation; linked from the bottom of `/results`: "Got a scholarship message on WhatsApp? Check it here."). Gemini reads it through `/api/analyze`; the browser compares it with the saved profile |
| `/coverage` | Counts by provider type, status, level (UG/PG) and state, from the real data bank |
| `/find` | Old link; redirects to `/profile` |

How the design connects to the engine: `lib/ui/adapters.ts` is the only place that turns a data-bank scheme plus its match result into the UI's `Scheme` type, the profile form into the engine's profile, and a pasted-notice analysis into a `Scheme`. The UI never decides eligibility. Styling is Tailwind v4 (CSS-first): the theme lives in `app/globals.css`; there is no `tailwind.config.ts`.
- **Who decides what.** Plain TypeScript in `lib/match/` decides every verdict. Gemini never changes a verdict: it only ranks the schemes the rules did not rule out, and writes one short reason for each.
- **Loaded at runtime.** `app/api/schemes` reads `databank/schemes/*.json` on each request, so no scheme name or rule is written in the code. Only schemes with `region: "india"` are shown; the abroad ones are hidden for now.
- **Status is computed in code** from the closing date and today's date: open (date is today or later), closed (passed within a year), stale (more than a year ago). If a scheme has no closing date, we repeat what the source says and label it "as stated by the source".
- **Rules we don't understand are never guessed.** A rule that applies only in a sub-case ("SC/ST/PwD"), is written in words, or is about something we don't ask (for example "wards of police personnel") gives "Can't tell". **Course type** works the same way: a scheme limited to certain courses (law, B.Tech, music and dance ...) says "Can't tell" unless your course type clearly matches one of them; a clear mismatch is also "Can't tell", never "Not eligible", because the course lists are free text read with keywords. A rule that only says how a course is studied ("regular degree, not distance") stays a note under "Also check". "Likely eligible" always means "by the published rules; confirm on the official portal".

### How the best matches are chosen (`/api/rank`)

1. The student fills the profile (saved in this browser).
2. Our rule evaluator runs first on the data bank, on the server. Every scheme the rules clearly rule out (Not eligible) is dropped. Eligible and Can't tell stay.
3. The remaining schemes (at most 40) go to Gemini through the same OpenRouter setup as the notice reader: only `google/` models, only the `google-vertex` and `google-ai-studio` providers, no fallbacks, key only in `OPENROUTER_API_KEY`, server side only. The payload is compact: a summary of the student's answers, and for each scheme its id, name, provider, amount, deadline status and up to 5 checked rules with their quotes and pass/unknown result.
4. Gemini returns JSON only: up to 8 items, each with `scheme_id`, `why_it_fits` (25 words at most) and `to_confirm` (15 words at most, or empty).
5. Code checks the answer. Unknown ids and duplicates are dropped, closed or old-cycle schemes cannot be best matches, texts are cut to the word limits, and a reason that contains a number that is not in the data we sent is replaced with plain-code wording. The AI cannot change a verdict (it never supplies one), add a scheme or add a rule.
6. If the call fails, returns something invalid, or takes longer than 15 seconds, the page uses our own ranking (verdict, then open before closed, then nearest deadline) and says "Showing results ranked by deadline and fit". The page is never blank.
7. A successful ranking is cached in memory for 10 minutes by a hash of the profile. `/api/rank` allows 20 rankings per IP per 10 minutes; over that, it answers with our own ranking.

**Privacy and the profile questions.** The profile has only questions that decide eligibility for at least one scheme: state, category, family income, study level, current year, course type, marks (optional), gender (optional), age (optional), disability (optional, with 'Prefer not to say'), and an optional last step ('Anything else that applies?': minority community, denotified or nomadic tribe, EBC/SEBC/BC list, beedi/cine/mine work, manual scavenging). Religion, a parent's job, first-generation status and work experience are **not** profile questions (work experience is asked on the notice page, only when you want it). Answers are saved in the browser. When the results page opens, they are sent to our server so the rule checker can run (nothing is stored; only a hash and the ranking are cached for 10 minutes). **Only state, category, income, study level, year, course type, marks and age are passed on to Gemini. Gender, disability and the optional last step are never sent to the AI.** The pasted-notice checker is different: only the notice text is sent, and the comparing happens in the browser.
## Run it

1. Copy `.env.example` to `.env.local` and put your OpenRouter key in `OPENROUTER_API_KEY`. This file is git-ignored. Never commit or paste the key anywhere.
2. `npm install`
3. `npm run dev`, then open http://localhost:3000
4. `npm test` runs the plain-code and AI-client tests (no key or network needed).
5. `node scripts/check-quotes.mts <saved-response.json> <notice.txt>` re-checks every quote in a saved API response.

To demo the fake-quote warning, run with `MOCK_AI=tamper` (development only; ignored in production).

## AI provider rules (organisers')

- Gemini through OpenRouter only (`https://openrouter.ai/api/v1/chat/completions`). Never Google AI Studio or Vertex directly.
- Only `google/` model ids; default `google/gemini-3.7-flash` (override with `OPENROUTER_MODEL`).
- Every request carries `provider: { only: ["google-vertex", "google-ai-studio"], allow_fallbacks: false }`.
- 429 and 5xx are retried up to 3 times with backoff. 402 (out of credits) stops with a clear error.
- The key is read from `OPENROUTER_API_KEY` at call time and is never logged or put in an error message.

## Deploy

Vercel: import the repo and set `OPENROUTER_API_KEY` in the project's environment variables. The API route allows up to 60 seconds.

## Limits

The AI can miss a rule; the quote check catches invented rules, not omissions. The 1,400 hours per year conversion is an assumption (it makes Chevening's 2,800 hours equal two years). The rate limit is in memory and resets when the server restarts. Always confirm on the official site.

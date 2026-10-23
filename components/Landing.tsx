import Link from "next/link";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";

const STEPS = [
  ["Tell us about you", "A short profile, one step at a time."],
  ["Understand your options", "See the best matches and the rules behind them."],
  ["Take your next step", "Apply through the official portal."],
] as const;

// No scheme counts here: the landing page makes no numeric claims about the data.
export function Landing() {
  return (
    <main id="main-content" className="page">
      <section className="grid items-center gap-10 py-4 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:py-12">
        <div>
          <h1 className="max-w-3xl font-display text-5xl font-bold leading-[1.02] tracking-tight text-ink sm:text-7xl">
            Find scholarships that may fit you.
          </h1>
          <p className="mt-6 max-w-lg text-xl leading-relaxed text-muted">
            Answer a few questions. See support for college, understand the rules,
            and know where to apply.
          </p>

          <Link href="/profile" className="btn-primary mt-8 px-6 text-lg">
            Find my scholarships
            <ArrowRight size={20} aria-hidden="true" />
          </Link>

          <div className="mt-6 space-y-2 text-muted">
            <p className="flex items-start gap-2">
              <Check size={18} className="mt-1 shrink-0 text-status-green" aria-hidden="true" />
              Every rule is quoted from the official source
            </p>
            <p className="flex items-start gap-2">
              <LockKeyhole size={17} className="mt-1 shrink-0" aria-hidden="true" />
              No login, no name, no phone number. Your answers are saved in your browser, not on our server.
            </p>
          </div>
        </div>

        {/* An exam answer sheet: the three steps written on ruled lines, numbered in the margin. */}
        <div className="ruled-sheet relative rotate-[-0.6deg] rounded-card border border-line pb-8 pl-14 pr-6 pt-8 shadow-card sm:pr-8">
          <p className="font-display text-2xl font-bold leading-8 text-brand">How it works</p>
          <ol className="mt-8">
            {STEPS.map(([title, description], index) => (
              <li key={title} className="relative pb-8 last:pb-0">
                <span
                  aria-hidden="true"
                  className="absolute -left-11 top-0 w-8 text-right font-display text-2xl font-bold leading-8 text-margin"
                >
                  {index + 1}.
                </span>
                <h2 className="font-display text-xl font-semibold leading-8 text-ink">{title}</h2>
                <p className="leading-8 text-muted">{description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8">
            <Link href="/coverage" className="text-link min-h-8 text-sm">
              See what the data bank covers
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <p className="mt-4 max-w-2xl border-l-4 border-accent pl-4 text-muted">
        A match is a starting point. The scholarship provider makes the final
        decision.
      </p>
    </main>
  );
}

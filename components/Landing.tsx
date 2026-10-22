import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, Route } from "lucide-react";

export function Landing({ schemeCount }: { schemeCount: number | null }) {
  return (
    <main id="main-content" className="page">
      <section className="grid items-center gap-10 py-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-14">
        <div>
          <p className="eyebrow">Your next step, made clearer</p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
            Find scholarships
            <br />
            <span className="text-brand">that may fit you.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg text-muted">
            Answer a few questions. See support for college, understand the rules,
            and know where to apply.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/profile" className="btn-primary">
              Find my scholarships
              <ArrowRight size={20} aria-hidden="true" />
            </Link>
            <Link href="/notice" className="btn-secondary">
              Check a notice I found
            </Link>
          </div>

          <div className="mt-5 space-y-2 text-sm text-muted">
            <p className="flex items-start gap-2">
              <Check size={18} className="shrink-0 text-brand" aria-hidden="true" />
              Every rule is quoted from the official source
            </p>
            <p className="flex items-start gap-2">
              <LockKeyhole size={17} className="shrink-0" aria-hidden="true" />
              No login. Your answers stay in your browser.
            </p>
          </div>
        </div>

        <div className="card relative overflow-hidden p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -right-12 -top-12 size-40 rounded-full bg-accent/25"
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-brand">
              <Route size={22} aria-hidden="true" />
              <p className="font-semibold">A little clarity goes a long way</p>
            </div>

            <ol className="mt-8">
              {[
                ["Tell us about you", "A short profile. One step at a time."],
                ["Understand your options", "See the rules behind every result."],
                ["Take your next step", "Apply through the official portal."],
              ].map(([title, description], index) => (
                <li key={title} className="relative flex gap-4 pb-8 last:pb-0">
                  {index < 2 && (
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-5 top-10 w-px bg-brand/25"
                    />
                  )}
                  <span className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-ink">
                    {index + 1}
                  </span>
                  <div>
                    <h2 className="font-semibold">{title}</h2>
                    <p className="mt-1 text-muted">{description}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-6">
              <div>
                <p
                  className="font-display text-4xl font-semibold text-brand"
                  data-testid="scheme-count"
                >
                  {schemeCount === null ? "…" : schemeCount.toLocaleString("en-IN")}
                </p>
                <p className="mt-1 text-sm text-muted">Indian schemes in the data bank</p>
              </div>
              <Link href="/coverage" className="text-link text-sm">
                See coverage
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="max-w-2xl border-l-4 border-accent pl-4 text-muted">
        A match is a starting point. The scholarship provider makes the final
        decision.
      </p>
    </main>
  );
}

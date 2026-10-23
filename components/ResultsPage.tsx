"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpDown, MessageCircle, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { AsyncState, Scheme } from "@/lib/ui/types";
import { SchemeCard } from "./SchemeCard";
import { ApplicationCheck } from "./ApplicationCheck";
import { EmptyState, ErrorState, LoadingState } from "./FeedbackState";

const FILTERS = [
  ["open", "Open now"],
  ["UG", "UG"],
  ["PG", "PG"],
  ["government", "Govt"],
  ["private", "Private"],
] as const;

type Filter = (typeof FILTERS)[number][0];
type Sort = "recommended" | "amount" | "deadline";

const PAGE_SIZE = 20;
const GOVERNMENT_TYPES = ["government", "state", "foreign_government"];

export interface BestMatch {
  scheme: Scheme;
  why: string;
  confirm: string;
}

export function ResultsPage({
  schemes,
  best,
  bestState,
  rankingNote,
  rankedByAi,
  state = "success",
  onRetry,
  webSearch,
}: {
  // The "Search the web for more scholarships" section, if any.
  webSearch?: ReactNode;
  // Every scheme with its verdict from the rule checker, best code-ranked first.
  schemes: Scheme[];
  // The top picks (AI-ranked, or code-ranked as a fallback), with a reason each.
  best: BestMatch[];
  bestState: "loading" | "ready";
  rankingNote: string | null;
  rankedByAi: boolean;
  state?: AsyncState;
  onRetry?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const [sort, setSort] = useState<Sort>("recommended");
  const [showRuledOut, setShowRuledOut] = useState(false);
  const [shown, setShown] = useState(PAGE_SIZE);

  const likelyMatches = schemes.filter((item) => item.verdict === "eligible");
  const closingMatches = likelyMatches.filter(
    (item) => item.deadline.status === "closing_soon",
  ).length;
  const ruledOut = schemes.filter((item) => item.verdict === "not_eligible").length;
  const bestIds = useMemo(() => new Set(best.map((b) => b.scheme.id)), [best]);

  const passes = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-IN");
    const selectedLevels = filters.filter((item) => item === "UG" || item === "PG");
    const selectedProviders = filters.filter(
      (item) => item === "government" || item === "private",
    );

    return (scheme: Scheme): boolean => {
      const matchesQuery =
        !term ||
        `${scheme.name} ${scheme.provider} ${scheme.states.join(" ")}`
          .toLocaleLowerCase("en-IN")
          .includes(term);

      const matchesOpen =
        !filters.includes("open") ||
        ["open", "closing_soon"].includes(scheme.deadline.status);

      const matchesLevel =
        !selectedLevels.length ||
        selectedLevels.some((level) => scheme.levels.includes(level as "UG" | "PG"));

      const isGovernment = GOVERNMENT_TYPES.includes(scheme.provider_type);
      const matchesProvider =
        !selectedProviders.length ||
        (selectedProviders.includes("government") && isGovernment) ||
        (selectedProviders.includes("private") && !isGovernment);

      return matchesQuery && matchesOpen && matchesLevel && matchesProvider;
    };
  }, [query, filters]);

  const checkable = useMemo(
    () => [
      ...best.map((b) => b.scheme),
      ...schemes.filter((s) => !bestIds.has(s.id) && s.verdict !== "not_eligible"),
      // Ruled-out schemes last: picking one shows exactly which rule fails.
      ...schemes.filter((s) => s.verdict === "not_eligible"),
    ],
    [best, schemes, bestIds],
  );

  const bestVisible = useMemo(() => best.filter((b) => passes(b.scheme)), [best, passes]);

  // "More schemes": everyone else the rules did not rule out (and, if asked, the
  // ones they did), under the chosen sort.
  const more = useMemo(() => {
    const list = schemes.filter(
      (scheme) =>
        !bestIds.has(scheme.id) &&
        (showRuledOut || scheme.verdict !== "not_eligible") &&
        passes(scheme),
    );

    const verdictOrder = { eligible: 0, passes_checkable: 0, cant_tell: 1, not_eligible: 2 };
    const statusOrder = { closing_soon: 0, open: 1, unknown: 2, closed: 3, stale_cycle: 4 };
    const deadlineValue = (scheme: Scheme) =>
      scheme.deadline.date
        ? Date.parse(`${scheme.deadline.date}T00:00:00Z`) || Infinity
        : Infinity;

    return list.sort((a, b) => {
      if (sort === "amount") {
        return (b.amount.annual_value ?? -1) - (a.amount.annual_value ?? -1);
      }
      if (sort === "deadline") {
        return deadlineValue(a) - deadlineValue(b);
      }
      return (
        verdictOrder[a.verdict] - verdictOrder[b.verdict] ||
        statusOrder[a.deadline.status] - statusOrder[b.deadline.status] ||
        deadlineValue(a) - deadlineValue(b) ||
        a.name.localeCompare(b.name)
      );
    });
  }, [schemes, bestIds, passes, showRuledOut, sort]);

  function toggle(filter: Filter) {
    setFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    );
    setShown(PAGE_SIZE);
  }

  function clear() {
    setQuery("");
    setFilters([]);
    setSort("recommended");
    setShown(PAGE_SIZE);
  }

  const hasFilters = Boolean(query.trim() || filters.length);
  const loading = state === "loading";

  return (
    <main id="main-content" className="page">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Your scholarship path</p>
          <h1
            className="mt-3 font-display text-3xl font-semibold sm:text-4xl"
            data-testid="results-heading"
          >
            {loading
              ? "Checking your options…"
              : state === "error"
                ? "Your scholarships"
                : `${likelyMatches.length} likely ${likelyMatches.length === 1 ? "match" : "matches"}, ${closingMatches} closing soon`}
          </h1>
          <p className="mt-3 max-w-2xl text-muted" data-testid="disclaimer">
            Likely eligible by the published rules. Confirm on the official portal.
          </p>
        </div>
        <Link href="/profile" className="text-link">Edit my profile</Link>
      </header>

      {loading ? (
        <div className="mt-8">
          <LoadingState />
        </div>
      ) : state === "error" ? (
        <div className="mt-8">
          <ErrorState onRetry={onRetry} />
        </div>
      ) : (
        <>
          <section aria-labelledby="best-heading" className="mt-8" data-testid="best-section">
            <h2 id="best-heading" className="flex items-center gap-2 font-display text-2xl font-semibold">
              <Sparkles size={22} className="text-brand" aria-hidden="true" />
              Best matches for you
            </h2>
            {bestState === "loading" ? (
              <div className="mt-3" data-testid="best-loading">
                <LoadingState message="Ranking the best matches for you…" />
              </div>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted" data-testid="ranking-note">
                  {rankedByAi
                    ? "Ranked by AI from the published rules. Whether you are eligible is decided by our rule checker, not the AI."
                    : (rankingNote ?? "")}
                </p>
                {bestVisible.length ? (
                  <div className="mt-4 space-y-4">
                    {bestVisible.map((b) => (
                      <SchemeCard
                        key={b.scheme.id}
                        scheme={b.scheme}
                        insight={{ why: b.why, confirm: b.confirm }}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="card mt-4 p-5 text-muted" data-testid="best-empty">
                    {best.length
                      ? "None of your best matches fit these filters."
                      : "No open schemes stand out for your answers yet. See the other schemes below."}
                  </p>
                )}
              </>
            )}
          </section>

          {/* Weak spots in an application: every scheme, best matches first, ruled-out last. */}
          {bestState === "ready" && checkable.length > 0 && (
            <ApplicationCheck schemes={checkable} defaultId={best[0]?.scheme.id} />
          )}

          <section aria-labelledby="more-heading" className="mt-12">
            <h2 id="more-heading" className="font-display text-2xl font-semibold">
              More schemes you may qualify for
            </h2>

            <div aria-label="Search and filter scholarships" className="my-5 space-y-4" role="group">
              <div className="grid gap-3 sm:grid-cols-[1fr_230px]">
                <div className="relative">
                  <label htmlFor="scheme-search" className="sr-only">Search scholarships</label>
                  <Search
                    size={20}
                    aria-hidden="true"
                    className="absolute left-4 top-4 text-muted"
                  />
                  <input
                    id="scheme-search"
                    type="search"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setShown(PAGE_SIZE);
                    }}
                    placeholder="Search a scheme or provider"
                    className="field pl-12"
                  />
                </div>
                <div>
                  <label htmlFor="scheme-sort" className="sr-only">Sort scholarships</label>
                  <select
                    id="scheme-sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as Sort)}
                    className="field"
                  >
                    <option value="recommended">Best fit first</option>
                    <option value="deadline">Nearest deadline</option>
                    <option value="amount">Highest annual amount</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <SlidersHorizontal size={18} className="mr-1 text-muted" aria-hidden="true" />
                {FILTERS.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filters.includes(value)}
                    data-testid={`filter-${value}`}
                    onClick={() => toggle(value)}
                    className={`min-h-11 rounded-full border px-4 py-2 font-semibold transition-colors ${
                      filters.includes(value)
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-white text-muted hover:border-brand"
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={sort === "amount"}
                  onClick={() => setSort(sort === "amount" ? "recommended" : "amount")}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 font-semibold ${
                    sort === "amount"
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-white text-muted"
                  }`}
                >
                  Amount
                  <ArrowUpDown size={16} aria-hidden="true" />
                </button>
                {hasFilters && (
                  <button type="button" onClick={clear} className="text-link px-2">
                    Clear
                  </button>
                )}
              </div>
              <p className="text-sm text-muted">
                Govt includes central and state schemes. Private includes corporate, trust and foundation schemes.
              </p>

              <label className="flex min-h-11 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={showRuledOut}
                  data-testid="show-ruled-out"
                  onChange={(event) => {
                    setShowRuledOut(event.target.checked);
                    setShown(PAGE_SIZE);
                  }}
                  className="size-5 accent-brand"
                />
                <span>
                  Also show schemes the published rules rule out{" "}
                  <span className="text-muted">({ruledOut})</span>
                </span>
              </label>
            </div>

            <p
              role="status"
              aria-live="polite"
              className="mb-4 text-sm text-muted"
              data-testid="shown-count"
            >
              Showing {Math.min(shown, more.length)} of {more.length} more schemes
              {!showRuledOut && ruledOut > 0 && ` (${ruledOut} ruled out are hidden)`}
            </p>
            {more.length ? (
              <>
                <div className="space-y-4">
                  {more.slice(0, shown).map((scheme) => (
                    <SchemeCard key={scheme.id} scheme={scheme} />
                  ))}
                </div>
                {more.length > shown && (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + PAGE_SIZE)}
                    className="btn-secondary mt-5"
                  >
                    Show {Math.min(PAGE_SIZE, more.length - shown)} more
                  </button>
                )}
              </>
            ) : (
              <EmptyState
                filtered={hasFilters}
                onClear={clear}
                title={hasFilters ? undefined : "No other schemes to show"}
                message={
                  hasFilters
                    ? undefined
                    : "Everything the published rules do not rule out is already in your best matches."
                }
              />
            )}
          </section>
        </>
      )}

      {/* Live web search: below the data-bank results, above the notice link.
          It runs on its own, so a failure there never affects the rest. */}
      {!loading && webSearch}

      <aside className="mt-10 rounded-card border border-dashed border-brand/40 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageCircle size={20} className="text-brand" aria-hidden="true" />
          Got a scholarship message on WhatsApp?
        </h2>
        <p className="mt-1 text-muted">
          Paste it and we will read its rules and compare them with your profile.
        </p>
        <Link href="/notice" className="text-link mt-2" data-testid="notice-link">
          Check it here
        </Link>
      </aside>
    </main>
  );
}

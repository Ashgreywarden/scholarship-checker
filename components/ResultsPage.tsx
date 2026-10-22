"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, Search, SlidersHorizontal } from "lucide-react";
import type { AsyncState, Scheme } from "@/lib/ui/types";
import { SchemeCard } from "./SchemeCard";
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

export function ResultsPage({
  schemes,
  state = "success",
  onRetry,
}: {
  schemes: Scheme[];
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

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("en-IN");
    const selectedLevels = filters.filter((item) => item === "UG" || item === "PG");
    const selectedProviders = filters.filter(
      (item) => item === "government" || item === "private",
    );

    const list = schemes.filter((scheme) => {
      if (!showRuledOut && scheme.verdict === "not_eligible") return false;

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
        selectedLevels.some((level) =>
          scheme.levels.includes(level as "UG" | "PG"),
        );

      const isGovernment = GOVERNMENT_TYPES.includes(scheme.provider_type);
      const matchesProvider =
        !selectedProviders.length ||
        (selectedProviders.includes("government") && isGovernment) ||
        (selectedProviders.includes("private") && !isGovernment);

      return matchesQuery && matchesOpen && matchesLevel && matchesProvider;
    });

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
  }, [schemes, query, filters, sort, showRuledOut]);

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

  return (
    <main id="main-content" className="page">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Your scholarship path</p>
          <h1
            className="mt-3 font-display text-3xl font-semibold sm:text-4xl"
            data-testid="results-heading"
          >
            {state === "loading"
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

      <section aria-label="Search and filter scholarships" className="my-7 space-y-4">
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
      </section>

      {state === "loading" ? (
        <LoadingState />
      ) : state === "error" ? (
        <ErrorState onRetry={onRetry} />
      ) : (
        <>
          <p
            role="status"
            aria-live="polite"
            className="mb-4 text-sm text-muted"
            data-testid="shown-count"
          >
            Showing {Math.min(shown, visible.length)} of {visible.length} schemes
            {!showRuledOut && ruledOut > 0 && ` (${ruledOut} ruled out are hidden)`}
          </p>
          {visible.length ? (
            <>
              <div className="space-y-4">
                {visible.slice(0, shown).map((scheme) => (
                  <SchemeCard key={scheme.id} scheme={scheme} />
                ))}
              </div>
              {visible.length > shown && (
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE_SIZE)}
                  className="btn-secondary mt-5"
                >
                  Show {Math.min(PAGE_SIZE, visible.length - shown)} more
                </button>
              )}
            </>
          ) : (
            <EmptyState filtered={hasFilters} onClear={clear} />
          )}
        </>
      )}

      <aside className="mt-8 rounded-card border border-dashed border-brand/40 p-5">
        <h2 className="font-semibold">Found another scholarship notice?</h2>
        <p className="mt-1 text-muted">Paste it to check how the published rules fit your profile.</p>
        <Link href="/notice" className="text-link mt-2">Check a notice</Link>
      </aside>
    </main>
  );
}

"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Database, GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import type { ProviderType, Scheme } from "@/lib/ui/types";
import { PROVIDER_LABELS } from "@/lib/ui/adapters";
import { EmptyState } from "./FeedbackState";

const PROVIDER_COLORS: Partial<Record<ProviderType, string>> = {
  government: "#115E59",
  state: "#527570",
  foundation: "#7A4B2A",
  corporate: "#92400E",
  trust: "#6D5B89",
  foreign_government: "#1D4ED8",
  institute: "#0F766E",
};

const STATUSES = [
  { key: "open", name: "Open", color: "#166534" },
  { key: "closing_soon", name: "Closing soon", color: "#92400E" },
  { key: "closed", name: "Closed", color: "#B91C1C" },
  { key: "stale_cycle", name: "Old cycle", color: "#9CA3AF" },
  { key: "unknown", name: "No closing date", color: "#4B5563" },
] as const;

function BreakdownTable({
  rows,
  caption,
  testid,
}: {
  rows: { name: string; value: number; color?: string }[];
  caption: string;
  testid: string;
}) {
  return (
    <table className="mt-5 w-full text-left text-sm" data-testid={testid}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line text-muted">
          <th scope="col" className="py-2 font-medium">Group</th>
          <th scope="col" className="py-2 text-right font-medium">Schemes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-b border-line last:border-0">
            <th scope="row" className="py-2 font-normal">
              {row.color && (
                <span
                  aria-hidden="true"
                  className="mr-2 inline-block size-3 rounded-full align-middle"
                  style={{ backgroundColor: row.color }}
                />
              )}
              {row.name}
            </th>
            <td className="py-2 text-right font-semibold tabular-nums">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function CoveragePage({
  schemes,
  updatedAt,
}: {
  schemes: Scheme[];
  updatedAt?: string;
}) {
  const data = useMemo(() => {
    const provider = (Object.keys(PROVIDER_COLORS) as ProviderType[])
      .map((key) => ({
        name: PROVIDER_LABELS[key],
        value: schemes.filter((scheme) => scheme.provider_type === key).length,
        color: PROVIDER_COLORS[key] as string,
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value);

    const status = STATUSES.map((group) => ({
      name: group.name,
      value: schemes.filter((scheme) => scheme.deadline.status === group.key).length,
      color: group.color,
    })).filter((item) => item.value > 0);

    const level = [
      { name: "UG", value: schemes.filter((scheme) => scheme.levels.includes("UG")).length },
      { name: "PG", value: schemes.filter((scheme) => scheme.levels.includes("PG")).length },
    ];

    const stateCounts = new Map<string, number>();
    for (const scheme of schemes) {
      for (const state of new Set(scheme.states)) {
        stateCounts.set(state, (stateCounts.get(state) ?? 0) + 1);
      }
    }
    const states = [...stateCounts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const quotedRules = schemes.reduce(
      (n, scheme) => n + scheme.rules.filter((rule) => rule.quote.trim() !== "").length,
      0,
    );

    return { provider, status, level, states, quotedRules };
  }, [schemes]);

  const openCount = schemes.filter((scheme) =>
    ["open", "closing_soon"].includes(scheme.deadline.status),
  ).length;
  const nationwide = schemes.filter((scheme) => scheme.states.includes("All India")).length;
  const stateSpecificCount = data.states.filter((item) => item.name !== "All India").length;

  const stats = [
    { label: "Indian schemes in the data bank", value: schemes.length, Icon: Database, id: "total" },
    { label: "Open now, including closing soon", value: openCount, Icon: ShieldCheck, id: "open" },
    { label: "States / UTs with their own schemes", value: stateSpecificCount, Icon: MapPin, id: "states" },
    { label: "Nationwide schemes", value: nationwide, Icon: GraduationCap, id: "nationwide" },
  ];

  return (
    <main id="main-content" className="page">
      <header className="max-w-3xl">
        <p className="eyebrow">The data behind your next step</p>
        <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">
          More clarity. Visible coverage.
        </h1>
        <p className="mt-4 text-lg text-muted">
          Explore the scholarship data bank by provider, study level, location and application status.
        </p>
        <p className="mt-3 text-sm text-muted" data-testid="quoted-rules">
          {data.quotedRules.toLocaleString("en-IN")} published rules, each with its official quote.{" "}
          {updatedAt ? `Rules last checked against the official text on ${updatedAt}.` : ""}
        </p>
      </header>

      <section aria-label="Coverage totals" className="my-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, id }, index) => (
          <div
            key={label}
            className={`rounded-card border p-5 ${
              index === 0
                ? "border-brand bg-brand text-white"
                : "border-line bg-white"
            }`}
          >
            <Icon size={23} aria-hidden="true" />
            <p
              className="mt-5 font-display text-5xl font-semibold tabular-nums"
              data-testid={`stat-${id}`}
            >
              {value.toLocaleString("en-IN")}
            </p>
            <h2 className={`mt-3 text-sm font-medium ${
              index === 0 ? "text-white" : "text-muted"
            }`}>
              {label}
            </h2>
          </div>
        ))}
      </section>

      {!schemes.length ? (
        <EmptyState />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5 sm:p-6" aria-labelledby="provider-chart-title">
            <h2 id="provider-chart-title" className="font-display text-2xl font-semibold">
              Who provides the support?
            </h2>
            <p className="mt-2 text-muted">Number of schemes by provider type.</p>
            <div className="mt-5 h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.provider} layout="vertical" margin={{ left: 4, right: 20 }}>
                  <CartesianGrid stroke="#DCE3DE" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: "#526260", fontSize: 14 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    tick={{ fill: "#172B2A", fontSize: 14 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip cursor={{ fill: "#E8F3F0" }} />
                  <Bar dataKey="value" name="Schemes" radius={[0, 6, 6, 0]} isAnimationActive={false}>
                    {data.provider.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <BreakdownTable rows={data.provider} caption="Schemes by provider type" testid="table-provider" />
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="status-chart-title">
            <h2 id="status-chart-title" className="font-display text-2xl font-semibold">
              What is open?
            </h2>
            <p className="mt-2 text-muted">
              Application status today, worked out from each closing date. Schemes with no published date repeat what the source says.
            </p>
            <div className="relative mt-5 h-64" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.status}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="88%"
                    paddingAngle={4}
                    stroke="#FFFFFF"
                    isAnimationActive={false}
                  >
                    {data.status.map((item) => <Cell key={item.name} fill={item.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-4xl font-semibold">{schemes.length}</span>
                <span className="text-sm text-muted">total schemes</span>
              </div>
            </div>
            <BreakdownTable rows={data.status} caption="Schemes by application status" testid="table-status" />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold">Support by study level</h2>
            <p className="mt-2 text-muted">
              A scheme may support both UG and PG. These counts can overlap.
            </p>
            <div className="mt-6 space-y-5" aria-hidden="true">
              {data.level.map((item) => (
                <div key={item.name}>
                  <div className="mb-2 flex justify-between font-semibold">
                    <span>{item.name}</span>
                    <span>{item.value}</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-brand-light">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${(item.value / schemes.length) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <BreakdownTable rows={data.level} caption="Schemes by study level" testid="table-level" />
          </section>

          <section className="card p-5 sm:p-6">
            <h2 className="font-display text-2xl font-semibold">Where support reaches</h2>
            <p className="mt-2 text-muted">
              Location tags, with nationwide schemes shown separately.
            </p>
            <div className="max-h-80 overflow-y-auto">
              <BreakdownTable rows={data.states} caption="Schemes by state or nationwide coverage" testid="table-state" />
            </div>
          </section>
        </div>
      )}

      <p className="mt-6 max-w-3xl text-sm text-muted">
        Coverage describes the data bank, not all scholarships available in India.
        Open status does not confirm an individual student’s eligibility.
      </p>
    </main>
  );
}

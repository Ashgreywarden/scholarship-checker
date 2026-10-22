"use client";

import type { ReactNode } from "react";
import type { ProfileInput, ProfileParse } from "@/lib/profileInput";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COURSE_LEVELS,
  COURSE_LEVEL_LABELS,
  STATES,
} from "@/lib/vocab";

const inputClass =
  "mt-1 block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200";

function Field({
  id,
  label,
  hint,
  problem,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  problem?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {problem ? (
        <p className="mt-1 text-xs text-red-700">{problem}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export default function ProfileForm({
  value,
  onChange,
  problems,
}: {
  value: ProfileInput;
  onChange: (next: ProfileInput) => void;
  problems: ProfileParse["problems"];
}) {
  const set = (key: keyof ProfileInput) => (v: string) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field id="courseLevel" label="Course level you are applying for">
        <select
          id="courseLevel"
          className={inputClass}
          value={value.courseLevel}
          onChange={(e) => set("courseLevel")(e.target.value)}
        >
          <option value="">Not sure / skip</option>
          {COURSE_LEVELS.map((c) => (
            <option key={c} value={c}>
              {COURSE_LEVEL_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>

      <Field id="age" label="Age (years)" problem={problems.age}>
        <input
          id="age"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          className={inputClass}
          placeholder="Leave blank if unsure"
          value={value.age}
          onChange={(e) => set("age")(e.target.value)}
        />
      </Field>

      <Field id="state" label="State / UT you live in">
        <select
          id="state"
          className={inputClass}
          value={value.state}
          onChange={(e) => set("state")(e.target.value)}
        >
          <option value="">Not sure / skip</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <Field id="category" label="Category">
        <select
          id="category"
          className={inputClass}
          value={value.category}
          onChange={(e) => set("category")(e.target.value)}
        >
          <option value="">Not sure / skip</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id="income"
        label="Annual family income (₹)"
        hint="Per year, from all sources. For example 250000."
        problem={problems.income}
      >
        <input
          id="income"
          type="number"
          inputMode="numeric"
          min={0}
          className={inputClass}
          placeholder="Leave blank if unsure"
          value={value.income}
          onChange={(e) => set("income")(e.target.value)}
        />
      </Field>

      <Field
        id="marks"
        label="Marks in last exam (%)"
        hint="Percentage, not CGPA."
        problem={problems.marks}
      >
        <input
          id="marks"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step="any"
          className={inputClass}
          placeholder="Leave blank if unsure"
          value={value.marks}
          onChange={(e) => set("marks")(e.target.value)}
        />
      </Field>

      <Field
        id="workYears"
        label="Years of work experience"
        hint="Full-time work after your degree. Use 0 if none."
        problem={problems.workYears}
      >
        <input
          id="workYears"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          className={inputClass}
          placeholder="Leave blank if unsure"
          value={value.workYears}
          onChange={(e) => set("workYears")(e.target.value)}
        />
      </Field>

      <Field id="nationality" label="Nationality">
        <input
          id="nationality"
          type="text"
          className={inputClass}
          placeholder="For example Indian"
          value={value.nationality}
          onChange={(e) => set("nationality")(e.target.value)}
        />
      </Field>
    </div>
  );
}

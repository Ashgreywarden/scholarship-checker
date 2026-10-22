"use client";

import { MAX_NOTICE_CHARS } from "@/lib/inputCheck";

export default function NoticeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const over = value.length > MAX_NOTICE_CHARS;
  return (
    <div>
      <label htmlFor="notice" className="block text-sm font-medium text-slate-800">
        Text of the scholarship notice
      </label>
      <textarea
        id="notice"
        rows={9}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        placeholder="Copy the eligibility section of the notice or web page and paste it here."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p
        className={`mt-1 text-right text-xs ${over ? "font-medium text-red-700" : "text-slate-500"}`}
      >
        {value.length.toLocaleString("en-IN")} / {MAX_NOTICE_CHARS.toLocaleString("en-IN")} characters
      </p>
    </div>
  );
}

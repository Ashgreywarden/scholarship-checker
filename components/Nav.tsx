"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Check a notice" },
  { href: "/find", label: "Find my scholarships" },
  { href: "/coverage", label: "Coverage" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="border-b border-slate-200 bg-white">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 py-2">
        {LINKS.map((l) => {
          const active = pathname === l.href;
          return (
            <li key={l.href} className="shrink-0">
              <Link
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-indigo-50 text-indigo-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

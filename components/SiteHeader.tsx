"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Route } from "lucide-react";

// The paste-a-notice tool is not in the main navigation: it is linked only at
// the bottom of the results page.
const LINKS = [
  { href: "/results", label: "Scholarships" },
  { href: "/coverage", label: "Coverage" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-paper">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-3 text-white
          focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-5 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="ScholarPath home"
          className="inline-flex min-h-11 items-center gap-2"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand text-white">
            <Route size={23} aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-semibold">ScholarPath</span>
        </Link>

        <nav aria-label="Main navigation" className="w-full sm:w-auto">
          <ul className="flex flex-wrap gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-semibold ${
                      active
                        ? "bg-brand-light text-brand"
                        : "text-muted hover:bg-white hover:text-brand"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}

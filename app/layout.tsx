import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Baloo_2, Mukta } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

// Both families are from Ek Type, an Indian type foundry, and cover Latin and Devanagari.
const body = Mukta({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body-nf",
  display: "swap",
});

const display = Baloo_2({
  subsets: ["latin", "devanagari"],
  weight: ["600", "700"],
  variable: "--font-display-nf",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ScholarPath — Find scholarships that may fit you",
    template: "%s | ScholarPath",
  },
  description:
    "Understand scholarship rules and find support for undergraduate and postgraduate study in India.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <footer className="mx-auto mt-8 max-w-6xl border-t border-line px-4 py-6 text-sm text-muted sm:px-6 lg:px-8">
          ScholarPath helps you understand published rules. Providers make the
          final decision. Always confirm details on the official portal.
        </footer>
      </body>
    </html>
  );
}

import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/ui/theme-toggle";

export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-ink">
      <header className="border-b border-border/80 bg-background/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Link className="inline-flex min-h-11 items-center gap-2 font-display text-2xl" href="/">
            <Sparkle aria-hidden="true" className="text-coral" size={21} weight="fill" />
            Museboard
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink"
              href="/pricing"
            >
              Pricing
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink"
              href="/login"
            >
              Log in
            </Link>
            <ThemeToggle />
            <Link
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-background transition hover:bg-coral"
              href="/onboarding"
            >
              Try the sample workspace
              <ArrowRight aria-hidden="true" size={17} weight="bold" />
            </Link>
          </nav>
        </div>
      </header>

      {children}

      <footer className="border-t border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Museboard. Make the next thing with intention.</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link className="min-h-11 py-2.5 hover:text-ink" href="/pricing">Pricing</Link>
            <Link className="min-h-11 py-2.5 hover:text-ink" href="/signup">Sample access</Link>
            <span className="min-h-11 py-2.5">No live accounts connected</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}

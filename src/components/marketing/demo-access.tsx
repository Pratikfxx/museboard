import { ArrowRight, LockSimple, Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing/marketing-shell";

export function DemoAccess({
  mode,
  configurationUnavailable = false,
}: {
  mode: "login" | "signup";
  configurationUnavailable?: boolean;
}) {
  const isLogin = mode === "login";

  return (
    <MarketingShell>
      <main className="px-4 py-12 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-surface shadow-xl lg:grid-cols-[1fr_1.05fr]">
          <section className="bg-sage/20 p-7 sm:p-10 lg:p-12">
            <Sparkle aria-hidden="true" className="text-coral" size={32} weight="fill" />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-coral">
              A calmer creator system
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">
              Your next post starts with a better question.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-muted">
              Build a sample workspace around your audience, formats, voice, boundaries, and real weekly capacity.
            </p>
            <ul className="mt-8 space-y-3 text-sm font-semibold">
              <li>Five relevant starter opportunities</li>
              <li>A first hook you can edit</li>
              <li>A manual plan that stays free</li>
            </ul>
          </section>

          <section className="p-7 sm:p-10 lg:p-12" aria-labelledby="access-heading">
            <div className="inline-flex items-center gap-2 rounded-full border border-warning/35 bg-butter/20 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-warning">
              <LockSimple aria-hidden="true" size={16} />
              {configurationUnavailable ? "Account access temporarily unavailable" : "Demo access · not production authentication"}
            </div>
            <h1 className="mt-6 font-display text-4xl sm:text-5xl" id="access-heading">
              {isLogin ? "Welcome back" : "Create your creator workspace"}
            </h1>
            <p className="mt-4 leading-7 text-muted">
              {configurationUnavailable
                ? "Production account settings are incomplete, so Museboard has disabled sign-in safely. The local sample remains available without credentials."
                : isLogin
                ? "Production sign-in is not enabled in this sample build. Continue to the local workspace already stored in this browser, or start fresh."
                : "Account creation is not enabled in this sample build. Set up a local workspace without entering personal details, connecting a social account, or adding a card."}
            </p>

            <Link
              className="mt-8 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-bold text-background transition hover:bg-coral sm:w-auto"
              href="/onboarding"
            >
              {isLogin ? "Continue to sample workspace" : "Start sample setup"}
              <ArrowRight aria-hidden="true" size={18} weight="bold" />
            </Link>

            <div className="mt-8 border-t border-border pt-6 text-sm text-muted">
              {isLogin ? (
                <p>
                  New here?{" "}
                  <Link className="font-bold text-cobalt underline-offset-4 hover:underline" href="/signup">
                    See sample setup
                  </Link>
                </p>
              ) : (
                <p>
                  Returning to this browser?{" "}
                  <Link className="font-bold text-cobalt underline-offset-4 hover:underline" href="/login">
                    Open sample access
                  </Link>
                </p>
              )}
            </div>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}

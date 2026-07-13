import { Check, Minus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/marketing/marketing-shell";
import { PLAN_CATALOG, type Plan } from "@/domain/entitlements";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Transparent Museboard plans, including free manual planning without a card.",
};

const planOrder: Plan[] = ["free", "creator", "pro", "studio"];

function plural(value: number, singular: string) {
  return `${value} ${singular}${value === 1 ? "" : "s"}`;
}

export default function PricingPage() {
  return (
    <MarketingShell>
      <main className="px-4 py-14 sm:px-6 sm:py-20">
        <section className="mx-auto max-w-7xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Clear limits, no mystery meter</p>
          <h1 className="mt-4 font-display text-5xl leading-none sm:text-7xl">Pricing that grows with your rhythm</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted">
            Manual planning stays unlimited on every plan. Provider-powered opportunities and strategist packs reset on the period shown.
          </p>
        </section>

        <section className="mx-auto mt-12 grid max-w-7xl gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Museboard plans">
          {planOrder.map((planId) => {
            const plan = PLAN_CATALOG[planId];
            const featured = planId === "creator";
            const features = [
              plural(plan.workspaces, "workspace"),
              plural(plan.members, "member"),
              `${plan.opportunities.limit} opportunities per ${plan.opportunities.resetPeriod}`,
              `${plan.strategistPacks.limit} strategist packs per ${plan.strategistPacks.resetPeriod}`,
              "Unlimited manual planning",
              `${plan.exportHistoryDays}-day export history`,
              `${plan.metricHistory.limit} ${plan.metricHistory.unit} of metric history`,
              `${plan.platformVariants} platform ${plan.platformVariants === 1 ? "variant" : "variants"}`,
            ];

            return (
              <article
                className={`relative flex flex-col rounded-3xl border p-6 ${featured ? "border-coral bg-coral/10 shadow-lg" : "border-border bg-surface"}`}
                key={planId}
              >
                {featured ? (
                  <span className="absolute -top-3 left-5 rounded-full bg-coral px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white">A focused start</span>
                ) : null}
                <h2 className="font-display text-4xl">{plan.name}</h2>
                <p className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-bold">{plan.priceUsdMonthly === 0 ? "$0" : `$${plan.priceUsdMonthly}`}</span>
                  <span className="pb-1 text-sm text-muted">/ month</span>
                </p>
                <ul className="mt-7 flex-1 space-y-3 text-sm">
                  {features.map((feature) => (
                    <li className="flex gap-2.5 leading-6" key={feature}>
                      <Check aria-hidden="true" className="mt-1 shrink-0 text-success" size={17} weight="bold" />
                      <span>{feature}</span>
                    </li>
                  ))}
                  <li className="flex gap-2.5 leading-6">
                    {plan.commentsAndApprovals ? (
                      <Check aria-hidden="true" className="mt-1 shrink-0 text-success" size={17} weight="bold" />
                    ) : (
                      <Minus aria-hidden="true" className="mt-1 shrink-0 text-muted" size={17} />
                    )}
                    <span>{plan.commentsAndApprovals ? "Comments and approvals" : "No comments or approvals"}</span>
                  </li>
                </ul>
                <Link
                  className={`mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-5 py-3 text-sm font-bold transition ${featured ? "bg-coral text-white hover:bg-ink hover:text-background" : "border border-border bg-background text-ink hover:border-coral"}`}
                  href="/onboarding"
                >
                  {planId === "free" ? "Try Free without a card" : `Preview ${plan.name} in sample`}
                </Link>
              </article>
            );
          })}
        </section>

        <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-6 text-muted">
          This build provides a credential-free sample workspace. Paid checkout and live provider services are not enabled or simulated.
        </p>
      </main>
    </MarketingShell>
  );
}

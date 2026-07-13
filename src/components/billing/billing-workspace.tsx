"use client";

import { ArrowSquareOut, CheckCircle, CreditCard, ShieldCheck } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { PLAN_CATALOG, type Plan } from "@/domain/entitlements";
import type { BillingMode } from "@/lib/config/features";
import { useMuseboardStore } from "@/lib/store/museboard-store";

import styles from "./billing.module.css";

const paidPlans = ["creator", "pro", "studio"] as const;

interface BillingWorkspaceProps {
  mode: BillingMode;
  unavailableReason?: string;
}

async function openBillingEndpoint(
  endpoint: "/api/billing/checkout" | "/api/billing/portal",
  body?: object,
): Promise<void> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = (await response.json()) as { url?: string; error?: string };
  if (!response.ok || !result.url) throw new Error(result.error ?? "Billing is unavailable");
  window.location.assign(result.url);
}

export function BillingWorkspace({ mode, unavailableReason }: BillingWorkspaceProps) {
  const currentPlan = useMuseboardStore((state) => state.entitlementUsage.plan);
  const setDemoPlan = useMuseboardStore((state) => state.setDemoPlan);
  const [status, setStatus] = useState<string>();
  const [pending, setPending] = useState<string>();

  const choosePlan = async (plan: Exclude<Plan, "free">) => {
    if (mode === "demo") {
      setDemoPlan(plan);
      setStatus(`${PLAN_CATALOG[plan].name} is active in this browser. No payment was made.`);
      return;
    }
    if (mode !== "live") return;
    setPending(plan);
    setStatus("Opening Stripe Checkout. Your plan changes only after Stripe confirms payment.");
    try {
      await openBillingEndpoint("/api/billing/checkout", { plan });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Checkout is unavailable");
      setPending(undefined);
    }
  };

  const manageBilling = async () => {
    if (mode !== "live") return;
    setPending("portal");
    setStatus("Opening the secure Stripe Customer Portal…");
    try {
      await openBillingEndpoint("/api/billing/portal");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Billing portal is unavailable");
      setPending(undefined);
    }
  };

  const eyebrow =
    mode === "demo"
      ? "Sample billing · no charge"
      : mode === "live"
        ? "Stripe test or live mode"
        : "Billing unavailable";

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p>{eyebrow}</p>
          <h1>Choose more room<br />when the work earns it.</h1>
        </div>
        <div className={styles.modeNote} data-mode={mode}>
          <ShieldCheck aria-hidden="true" size={22} weight="duotone" />
          <span>
            {mode === "demo"
              ? "Plan changes stay in this sample workspace on this device. They do not create a card, invoice, or subscription."
              : mode === "live"
                ? "Checkout and account management happen on Stripe. Museboard updates access from signed webhooks."
                : unavailableReason ?? "Live billing is not fully configured."}
          </span>
        </div>
      </header>

      <div className={styles.current}>
        <span>Current workspace plan</span>
        <strong>{PLAN_CATALOG[currentPlan].name}</strong>
        <small>
          {mode === "demo" ? "Local sample entitlement" : "Access is confirmed by the billing service"}
        </small>
      </div>

      <div aria-label="Museboard plans" className={styles.plans}>
        {paidPlans.map((plan) => {
          const details = PLAN_CATALOG[plan];
          const selected = currentPlan === plan;
          return (
            <article data-featured={plan === "pro"} key={plan}>
              <div className={styles.planName}>
                <span>{details.name}</span>
                {plan === "pro" ? <small>Best for a working creator</small> : null}
              </div>
              <div className={styles.price}>
                <strong>${details.priceUsdMonthly}</strong>
                <span>USD / month</span>
              </div>
              <ul>
                <li><CheckCircle aria-hidden="true" /> {details.strategistPacks.limit} strategist packs / month</li>
                <li><CheckCircle aria-hidden="true" /> {details.opportunities.limit} opportunity refreshes / month</li>
                <li><CheckCircle aria-hidden="true" /> {details.members} {details.members === 1 ? "seat" : "team seats"}</li>
              </ul>
              <button
                disabled={mode === "unavailable" || pending !== undefined || (mode === "live" && selected)}
                onClick={() => void choosePlan(plan)}
                type="button"
              >
                {pending === plan ? "Opening checkout…" : mode === "demo" ? `Try ${details.name} in sample workspace` : selected ? "Current plan" : `Choose ${details.name}`}
                <ArrowSquareOut aria-hidden="true" size={18} />
              </button>
            </article>
          );
        })}
      </div>

      <footer className={styles.footer}>
        <div aria-live="polite" className={styles.status}>
          <CreditCard aria-hidden="true" size={20} />
          <span>{status ?? (mode === "demo" ? "Explore paid capabilities freely. No payment was made." : "Plan access changes only after a verified billing event.")}</span>
        </div>
        <div className={styles.footerActions}>
          <Link href="/app/settings/data">Data controls</Link>
          <button disabled={mode !== "live" || pending !== undefined} onClick={() => void manageBilling()} type="button">
            {pending === "portal" ? "Opening portal…" : "Manage billing on Stripe"}
          </button>
        </div>
      </footer>
    </section>
  );
}

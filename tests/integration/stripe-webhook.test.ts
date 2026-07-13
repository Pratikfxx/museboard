import type Stripe from "stripe";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  handleStripeEvent,
  projectStripeEntitlements,
  type BillingEventRepository,
  type StripeSubscriptionSnapshot,
} from "@/lib/stripe/webhook";

const active: StripeSubscriptionSnapshot = {
  id: "sub_123",
  customerId: "cus_123",
  organizationId: "org_123",
  status: "active",
  priceId: "price_pro",
  periodEnd: "2026-08-13T00:00:00.000Z",
  cancelAtPeriodEnd: true,
};

describe("Stripe webhook projection", () => {
  it("retains access until period end for cancel-at-period-end subscriptions", () => {
    expect(
      projectStripeEntitlements(active, {
        eventCreatedAt: "2026-07-13T00:00:00.000Z",
        pricePlans: { price_pro: "pro" },
      }),
    ).toMatchObject({ plan: "pro", activeUntil: active.periodEnd });
  });

  it("anchors the seven-day grace period once instead of extending it", () => {
    const first = projectStripeEntitlements(
      { ...active, status: "past_due", cancelAtPeriodEnd: false },
      {
        eventCreatedAt: "2026-07-13T00:00:00.000Z",
        pricePlans: { price_pro: "pro" },
      },
    );
    const retry = projectStripeEntitlements(
      { ...active, status: "past_due", cancelAtPeriodEnd: false },
      {
        eventCreatedAt: "2026-07-16T00:00:00.000Z",
        pricePlans: { price_pro: "pro" },
        previous: first,
      },
    );

    expect(first.graceEndsAt).toBe("2026-07-20T00:00:00.000Z");
    expect(retry.graceEndsAt).toBe(first.graceEndsAt);
  });

  it("claims duplicate events once and fetches the current subscription", async () => {
    const writes: string[] = [];
    let claimed = false;
    const repository: BillingEventRepository = {
      claimEvent: async () => {
        if (claimed) return "duplicate";
        claimed = true;
        return "claimed";
      },
      getEntitlement: async () => undefined,
      projectEntitlement: async (projection) => {
        writes.push(projection.plan);
      },
      markProcessed: async () => undefined,
      markFailed: async () => undefined,
    };
    const event = {
      id: "evt_123",
      type: "customer.subscription.updated",
      created: 1_784_937_600,
      data: { object: { id: "sub_123" } },
    } as unknown as Stripe.Event;
    const fetchSubscription = vi.fn(async () => active);

    await expect(
      handleStripeEvent(event, {
        repository,
        fetchSubscription,
        pricePlans: { price_pro: "pro" },
      }),
    ).resolves.toEqual({ duplicate: false, projected: true });
    await expect(
      handleStripeEvent(event, {
        repository,
        fetchSubscription,
        pricePlans: { price_pro: "pro" },
      }),
    ).resolves.toEqual({ duplicate: true });
    expect(fetchSubscription).toHaveBeenCalledTimes(1);
    expect(writes).toEqual(["pro"]);
  });

  it("verifies Stripe against the untouched request body", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/stripe/webhook/route.ts"),
      "utf8",
    );
    expect(route).toContain("const rawBody = await request.text()");
    expect(route).toContain("stripe.webhooks.constructEvent(");
    expect(route.indexOf("request.text()"))
      .toBeLessThan(route.indexOf("stripe.webhooks.constructEvent("));
    expect(route).not.toContain("request.json()");
  });
});

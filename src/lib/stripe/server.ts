import Stripe from "stripe";

import type { Plan } from "@/domain/entitlements";
import { requireLiveBillingConfig } from "@/lib/config/features";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  BillingEventRepository,
  EntitlementProjection,
  StripeSubscriptionSnapshot,
} from "@/lib/stripe/webhook";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  const config = requireLiveBillingConfig();
  stripeClient ??= new Stripe(config.stripe.secretKey, {
    apiVersion: "2026-06-24.dahlia",
    typescript: true,
  });
  return stripeClient;
}

export function getPricePlanMap(): Record<string, Exclude<Plan, "free">> {
  const prices = requireLiveBillingConfig().stripe.priceIds;
  return {
    [prices.creator]: "creator",
    [prices.pro]: "pro",
    [prices.studio]: "studio",
  };
}

export function priceIdForPlan(plan: Exclude<Plan, "free">): string {
  return requireLiveBillingConfig().stripe.priceIds[plan];
}

export function checkoutIdempotencyKey(
  organizationId: string,
  requestKey: string,
): string {
  return `museboard:checkout:${organizationId}:${requestKey}`;
}

export function hasManageableSubscription(input: {
  stripeSubscriptionId?: string;
  stripeStatus?: string;
  activeUntil?: string;
}, now = new Date()): boolean {
  if (!input.stripeSubscriptionId) return false;
  if (!["canceled", "incomplete_expired"].includes(input.stripeStatus ?? "")) {
    return true;
  }
  return input.activeUntil
    ? new Date(input.activeUntil).getTime() > now.getTime()
    : false;
}

export function assertRequestOrigin(request: Request, appUrl: string): void {
  const expected = new URL(appUrl).origin;
  const actual = request.headers.get("origin");
  if (!actual || actual !== expected) {
    throw new Error("Request origin is not allowed");
  }
}

export function toSubscriptionSnapshot(
  subscription: Stripe.Subscription,
): StripeSubscriptionSnapshot {
  const item = subscription.items.data[0];
  const organizationId = subscription.metadata.organization_id;
  if (!item || !organizationId) {
    throw new Error("Subscription is missing a price or organization mapping");
  }
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  return {
    id: subscription.id,
    customerId,
    organizationId,
    status: subscription.status,
    priceId: item.price.id,
    periodEnd: new Date(item.current_period_end * 1_000).toISOString(),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function createBillingEventRepository(): BillingEventRepository {
  const supabase = createAdminClient();
  return {
    async claimEvent(event) {
      const { data, error } = await supabase.rpc("claim_stripe_event", {
        p_event_id: event.id,
        p_event_type: event.type,
        p_created_at: new Date(event.created * 1_000).toISOString(),
      });
      throwOnError(error);
      return data === "claimed" ? "claimed" : "duplicate";
    },
    async getEntitlement(organizationId) {
      const { data, error } = await supabase
        .from("subscription_entitlements")
        .select(
          "organization_id, stripe_subscription_id, stripe_customer_id, stripe_price_id, stripe_status, plan, active_until, grace_started_at, grace_ends_at, source_event_created_at",
        )
        .eq("organization_id", organizationId)
        .maybeSingle();
      throwOnError(error);
      if (!data) return undefined;
      return {
        organizationId: data.organization_id,
        stripeSubscriptionId: data.stripe_subscription_id,
        stripeCustomerId: data.stripe_customer_id,
        stripePriceId: data.stripe_price_id,
        stripeStatus: data.stripe_status,
        plan: data.plan as Plan,
        activeUntil: data.active_until ?? undefined,
        graceStartedAt: data.grace_started_at ?? undefined,
        graceEndsAt: data.grace_ends_at ?? undefined,
        sourceEventCreatedAt: data.source_event_created_at,
      };
    },
    async projectEntitlement(projection: EntitlementProjection) {
      const { error } = await supabase.rpc("project_subscription_entitlement", {
        p_organization_id: projection.organizationId,
        p_subscription_id: projection.stripeSubscriptionId,
        p_customer_id: projection.stripeCustomerId,
        p_price_id: projection.stripePriceId,
        p_status: projection.stripeStatus,
        p_plan: projection.plan,
        p_active_until: projection.activeUntil ?? null,
        p_grace_started_at: projection.graceStartedAt ?? null,
        p_grace_ends_at: projection.graceEndsAt ?? null,
        p_event_created_at: projection.sourceEventCreatedAt,
      });
      throwOnError(error);
    },
    async markProcessed(eventId) {
      const { error } = await supabase.rpc("mark_stripe_event_processed", {
        p_event_id: eventId,
      });
      throwOnError(error);
    },
    async markFailed(eventId, reason) {
      const { error } = await supabase.rpc("mark_stripe_event_failed", {
        p_event_id: eventId,
        p_reason: reason,
      });
      throwOnError(error);
    },
  };
}

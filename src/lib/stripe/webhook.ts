import type Stripe from "stripe";

import type { Plan } from "@/domain/entitlements";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

export interface StripeSubscriptionSnapshot {
  id: string;
  customerId: string;
  organizationId: string;
  status: string;
  priceId: string;
  periodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface EntitlementProjection {
  organizationId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  stripePriceId: string;
  stripeStatus: string;
  plan: Plan;
  activeUntil?: string;
  graceStartedAt?: string;
  graceEndsAt?: string;
  sourceEventCreatedAt: string;
}

interface ProjectionOptions {
  eventCreatedAt: string;
  pricePlans: Record<string, Exclude<Plan, "free">>;
  previous?: EntitlementProjection;
}

export function projectStripeEntitlements(
  subscription: StripeSubscriptionSnapshot,
  options: ProjectionOptions,
): EntitlementProjection {
  const plan = options.pricePlans[subscription.priceId];
  if (!plan) throw new Error("Stripe price is not mapped to a Museboard plan");

  const projection: EntitlementProjection = {
    organizationId: subscription.organizationId,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: subscription.customerId,
    stripePriceId: subscription.priceId,
    stripeStatus: subscription.status,
    plan,
    sourceEventCreatedAt: options.eventCreatedAt,
  };

  if (["active", "trialing"].includes(subscription.status)) {
    projection.activeUntil = subscription.periodEnd;
    return projection;
  }

  if (["past_due", "unpaid"].includes(subscription.status)) {
    const graceStartedAt =
      options.previous?.graceStartedAt ?? options.eventCreatedAt;
    const graceEndsAt =
      options.previous?.graceEndsAt ??
      new Date(new Date(graceStartedAt).getTime() + SEVEN_DAYS_MS).toISOString();
    projection.graceStartedAt = graceStartedAt;
    projection.graceEndsAt = graceEndsAt;
    projection.activeUntil = graceEndsAt;
    return projection;
  }

  if (subscription.cancelAtPeriodEnd) {
    projection.activeUntil = subscription.periodEnd;
  }
  return projection;
}

export interface BillingEventRepository {
  claimEvent(event: Stripe.Event): Promise<"claimed" | "duplicate">;
  getEntitlement(organizationId: string): Promise<EntitlementProjection | undefined>;
  projectEntitlement(projection: EntitlementProjection): Promise<void>;
  markProcessed(eventId: string): Promise<void>;
  markFailed(eventId: string, reason: string): Promise<void>;
}

interface WebhookDependencies {
  repository: BillingEventRepository;
  fetchSubscription(subscriptionId: string): Promise<StripeSubscriptionSnapshot>;
  pricePlans: Record<string, Exclude<Plan, "free">>;
}

function subscriptionIdFromEvent(event: Stripe.Event): string | undefined {
  const object = event.data.object as unknown as Record<string, unknown>;
  if (event.type.startsWith("customer.subscription.")) {
    return typeof object.id === "string" ? object.id : undefined;
  }
  if (event.type === "checkout.session.completed") {
    return typeof object.subscription === "string"
      ? object.subscription
      : (object.subscription as { id?: string } | undefined)?.id;
  }
  const parent = object.parent as
    | { subscription_details?: { subscription?: string | { id?: string } } }
    | undefined;
  const subscription = parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id;
}

export async function handleStripeEvent(
  event: Stripe.Event,
  dependencies: WebhookDependencies,
): Promise<{ duplicate: boolean; projected?: boolean }> {
  const claimed = await dependencies.repository.claimEvent(event);
  if (claimed === "duplicate") return { duplicate: true };

  try {
    const subscriptionId = subscriptionIdFromEvent(event);
    if (!subscriptionId) {
      await dependencies.repository.markProcessed(event.id);
      return { duplicate: false, projected: false };
    }
    const snapshot = await dependencies.fetchSubscription(subscriptionId);
    const previous = await dependencies.repository.getEntitlement(
      snapshot.organizationId,
    );
    const projection = projectStripeEntitlements(snapshot, {
      eventCreatedAt: new Date(event.created * 1_000).toISOString(),
      pricePlans: dependencies.pricePlans,
      previous,
    });
    await dependencies.repository.projectEntitlement(projection);
    await dependencies.repository.markProcessed(event.id);
    return { duplicate: false, projected: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Webhook projection failed";
    await dependencies.repository.markFailed(event.id, reason.slice(0, 500));
    throw error;
  }
}

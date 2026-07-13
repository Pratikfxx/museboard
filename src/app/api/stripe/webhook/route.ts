import { NextResponse } from "next/server";

import { requireLiveBillingConfig } from "@/lib/config/features";
import {
  createBillingEventRepository,
  getPricePlanMap,
  getStripe,
  toSubscriptionSnapshot,
} from "@/lib/stripe/server";
import { handleStripeEvent } from "@/lib/stripe/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let config;
  try {
    config = requireLiveBillingConfig();
  } catch {
    return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();
  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.stripe.webhookSecret,
    );
    const result = await handleStripeEvent(event, {
      repository: createBillingEventRepository(),
      pricePlans: getPricePlanMap(),
      fetchSubscription: async (subscriptionId) =>
        toSubscriptionSnapshot(
          await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["items.data.price"],
          }),
        ),
    });
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed";
    const invalidSignature = message.toLocaleLowerCase().includes("signature");
    return NextResponse.json(
      { error: invalidSignature ? "Invalid Stripe signature" : "Webhook processing failed" },
      { status: invalidSignature ? 400 : 500 },
    );
  }
}

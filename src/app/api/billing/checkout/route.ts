import { NextResponse } from "next/server";
import { z } from "zod";

import { BillingAuthorizationError, requireBillingOwner } from "@/lib/auth/session";
import { requireLiveBillingConfig } from "@/lib/config/features";
import {
  assertRequestOrigin,
  checkoutIdempotencyKey,
  getStripe,
  hasManageableSubscription,
  priceIdForPlan,
} from "@/lib/stripe/server";

const checkoutRequest = z.object({
  plan: z.enum(["creator", "pro", "studio"]),
  organizationId: z.uuid(),
  idempotencyKey: z.uuid(),
});

export async function POST(request: Request) {
  try {
    const config = requireLiveBillingConfig();
    assertRequestOrigin(request, config.appUrl);
    const input = checkoutRequest.parse(await request.json());
    const owner = await requireBillingOwner(input.organizationId);
    if (hasManageableSubscription(owner)) {
      return NextResponse.json(
        {
          code: "subscription_exists",
          error: "This workspace already has a Stripe subscription. Manage its plan instead of creating another one.",
        },
        { status: 409 },
      );
    }
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "subscription",
        line_items: [{ price: priceIdForPlan(input.plan), quantity: 1 }],
        success_url: `${config.appUrl}/app/settings/billing?checkout=return`,
        cancel_url: `${config.appUrl}/app/settings/billing?checkout=cancelled`,
        allow_promotion_codes: true,
        client_reference_id: owner.organizationId,
        customer: owner.stripeCustomerId,
        customer_email: owner.stripeCustomerId ? undefined : owner.email,
        metadata: { organization_id: owner.organizationId },
        subscription_data: { metadata: { organization_id: owner.organizationId } },
      },
      {
        idempotencyKey: checkoutIdempotencyKey(
          owner.organizationId,
          input.idempotencyKey,
        ),
      },
    );
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a valid Museboard plan" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Checkout unavailable";
    const status = message.includes("origin") ? 403 : message.includes("unavailable") ? 503 : 500;
    return NextResponse.json({ error: status === 500 ? "Checkout unavailable" : message }, { status });
  }
}

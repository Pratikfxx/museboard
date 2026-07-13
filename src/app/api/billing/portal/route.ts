import { NextResponse } from "next/server";

import { BillingAuthorizationError, requireBillingOwner } from "@/lib/auth/session";
import { requireLiveBillingConfig } from "@/lib/config/features";
import { assertRequestOrigin, getStripe } from "@/lib/stripe/server";

export async function POST(request: Request) {
  try {
    const config = requireLiveBillingConfig();
    assertRequestOrigin(request, config.appUrl);
    const owner = await requireBillingOwner();
    if (!owner.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe billing account exists for this workspace" },
        { status: 409 },
      );
    }
    const session = await getStripe().billingPortal.sessions.create({
      customer: owner.stripeCustomerId,
      return_url: `${config.appUrl}/app/settings/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof BillingAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Billing portal unavailable";
    const status = message.includes("origin") ? 403 : message.includes("unavailable") ? 503 : 500;
    return NextResponse.json({ error: status === 500 ? "Billing portal unavailable" : message }, { status });
  }
}

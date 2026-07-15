import { NextResponse } from "next/server";
import { z } from "zod";

import { BillingAuthorizationError, requireBillingOwner } from "@/lib/auth/session";
import { requireLiveBillingConfig } from "@/lib/config/features";
import { assertRequestOrigin, getStripe } from "@/lib/stripe/server";

const portalRequest = z.object({ organizationId: z.uuid() });

export async function POST(request: Request) {
  try {
    const config = requireLiveBillingConfig();
    assertRequestOrigin(request, config.appUrl);
    const input = portalRequest.parse(await request.json());
    const owner = await requireBillingOwner(input.organizationId);
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Choose a valid workspace" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Billing portal unavailable";
    const status = message.includes("origin") ? 403 : message.includes("unavailable") ? 503 : 500;
    return NextResponse.json({ error: status === 500 ? "Billing portal unavailable" : message }, { status });
  }
}

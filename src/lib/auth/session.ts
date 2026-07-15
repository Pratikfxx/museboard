import { createClient } from "@/lib/supabase/server";

export class BillingAuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403 = 401,
  ) {
    super(message);
  }
}

export interface BillingOwnerContext {
  userId: string;
  email?: string;
  organizationId: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeStatus?: string;
  activeUntil?: string;
}

/** Uses an Auth server round trip for sensitive billing operations. */
export async function requireBillingOwner(
  organizationId: string,
): Promise<BillingOwnerContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new BillingAuthorizationError("Sign in to manage billing");
  }

  const membership = await supabase
    .from("organization_memberships")
    .select("organization_id, role, status")
    .eq("organization_id", organizationId)
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .eq("role", "owner")
    .maybeSingle();
  if (membership.error || !membership.data) {
    throw new BillingAuthorizationError("Only a workspace owner can manage billing", 403);
  }

  const billingAccount = await supabase
    .from("billing_accounts")
    .select("stripe_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const entitlement = await supabase
    .from("subscription_entitlements")
    .select("stripe_subscription_id, stripe_status, active_until")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (billingAccount.error || entitlement.error) {
    throw new Error("The workspace billing record could not be loaded");
  }

  return {
    userId: data.user.id,
    email: data.user.email,
    organizationId,
    stripeCustomerId: billingAccount.data?.stripe_customer_id ?? undefined,
    stripeSubscriptionId:
      entitlement.data?.stripe_subscription_id ?? undefined,
    stripeStatus: entitlement.data?.stripe_status ?? undefined,
    activeUntil: entitlement.data?.active_until ?? undefined,
  };
}

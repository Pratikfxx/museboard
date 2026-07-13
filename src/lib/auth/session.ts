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
}

/** Uses an Auth server round trip for sensitive billing operations. */
export async function requireBillingOwner(): Promise<BillingOwnerContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new BillingAuthorizationError("Sign in to manage billing");
  }

  const membership = await supabase
    .from("organization_memberships")
    .select("organization_id, role, status")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (membership.error || !membership.data) {
    throw new BillingAuthorizationError("Only a workspace owner can manage billing", 403);
  }

  const billingAccount = await supabase
    .from("billing_accounts")
    .select("stripe_customer_id")
    .eq("organization_id", membership.data.organization_id)
    .maybeSingle();

  return {
    userId: data.user.id,
    email: data.user.email,
    organizationId: membership.data.organization_id,
    stripeCustomerId: billingAccount.data?.stripe_customer_id ?? undefined,
  };
}

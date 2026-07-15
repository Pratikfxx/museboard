import { cookies } from "next/headers";
import { z } from "zod";

import type { Plan } from "@/domain/entitlements";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "museboard-active-workspace";

const membershipSchema = z.object({
  organization_id: z.uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
  status: z.literal("active"),
});

const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});

const profileSchema = z.object({ display_name: z.string() });

const entitlementSchema = z.object({
  plan: z.enum(["creator", "pro", "studio"]),
  stripe_status: z.string(),
  stripe_subscription_id: z.string(),
  active_until: z.string().nullable(),
  grace_ends_at: z.string().nullable(),
});

export interface AuthenticatedWorkspace {
  userId: string;
  email?: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: "owner" | "editor" | "viewer";
  displayName: string;
  plan: Plan;
  stripeStatus?: string;
  stripeSubscriptionId?: string;
  activeUntil?: string;
}

export function effectivePlanFromEntitlement(
  entitlement: z.infer<typeof entitlementSchema> | undefined,
  now = new Date(),
): Plan {
  if (!entitlement) return "free";
  if (["active", "trialing"].includes(entitlement.stripe_status)) {
    return entitlement.plan;
  }
  const graceEndsAt = entitlement.grace_ends_at
    ? new Date(entitlement.grace_ends_at).getTime()
    : Number.NEGATIVE_INFINITY;
  const activeUntil = entitlement.active_until
    ? new Date(entitlement.active_until).getTime()
    : Number.NEGATIVE_INFINITY;
  return Math.max(graceEndsAt, activeUntil) > now.getTime()
    ? entitlement.plan
    : "free";
}

export async function ensureAuthenticatedWorkspace(input?: {
  displayName?: string;
  workspaceName?: string;
}): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ensure_user_workspace", {
    p_display_name: input?.displayName ?? null,
    p_workspace_name: input?.workspaceName ?? null,
  });
  if (error) throw new Error(error.message);
  const row = z
    .array(z.object({ organization_id: z.uuid() }))
    .min(1)
    .parse(data)[0];
  return row.organization_id;
}

export async function getAuthenticatedWorkspace(): Promise<AuthenticatedWorkspace | null> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  let membershipResult = await supabase
    .from("organization_memberships")
    .select("organization_id, role, status")
    .eq("user_id", userData.user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  if (!membershipResult.data?.length) {
    await ensureAuthenticatedWorkspace();
    membershipResult = await supabase
      .from("organization_memberships")
      .select("organization_id, role, status")
      .eq("user_id", userData.user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true });
  }
  if (membershipResult.error) throw new Error(membershipResult.error.message);
  const memberships = z.array(membershipSchema).parse(membershipResult.data ?? []);
  if (!memberships.length) throw new Error("No active Museboard workspace is available");

  const cookieStore = await cookies();
  const requestedOrganizationId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const membership =
    memberships.find(({ organization_id }) => organization_id === requestedOrganizationId) ??
    memberships[0];

  const [organizationResult, profileResult, entitlementResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", membership.organization_id)
      .single(),
    supabase
      .from("creator_profiles")
      .select("display_name")
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
    supabase
      .from("subscription_entitlements")
      .select("plan, stripe_status, stripe_subscription_id, active_until, grace_ends_at")
      .eq("organization_id", membership.organization_id)
      .maybeSingle(),
  ]);
  if (organizationResult.error) throw new Error(organizationResult.error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (entitlementResult.error) throw new Error(entitlementResult.error.message);

  const organization = organizationSchema.parse(organizationResult.data);
  const profile = profileResult.data
    ? profileSchema.parse(profileResult.data)
    : undefined;
  const entitlement = entitlementResult.data
    ? entitlementSchema.parse(entitlementResult.data)
    : undefined;

  return {
    userId: userData.user.id,
    email: userData.user.email,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    role: membership.role,
    displayName:
      profile?.display_name ??
      userData.user.email?.split("@")[0] ??
      "Museboard creator",
    plan: effectivePlanFromEntitlement(entitlement),
    stripeStatus: entitlement?.stripe_status,
    stripeSubscriptionId: entitlement?.stripe_subscription_id,
    activeUntil: entitlement?.active_until ?? undefined,
  };
}

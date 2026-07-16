import { cookies } from "next/headers";
import { z } from "zod";

import type { Plan } from "@/domain/entitlements";
import type { Entitlement } from "@/domain/entitlements";
import type { Membership } from "@/domain/collaboration";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_WORKSPACE_COOKIE = "museboard-active-workspace";

const membershipSchema = z.object({
  organization_id: z.uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
  status: z.literal("active"),
});

const organizationMembershipSchema = z.object({
  user_id: z.uuid(),
  role: z.enum(["owner", "editor", "viewer"]),
  status: z.enum(["pending", "active", "removed"]),
  email_snapshot: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

const usageLedgerSchema = z.object({
  entitlement: z.enum(["manual_planning", "strategist_pack", "opportunity_refresh", "export_pack"]),
  operation: z.enum(["reserve", "commit", "release"]),
  amount: z.number().int().positive(),
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
  memberships: Membership[];
  currentActorMembershipId: string;
  used: Partial<Record<Entitlement, number>>;
  reserved: Partial<Record<Entitlement, number>>;
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

  const [organizationResult, profileResult, entitlementResult, membersResult, usageResult] = await Promise.all([
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
    supabase
      .from("organization_memberships")
      .select("user_id, role, status, email_snapshot, created_at, updated_at")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("usage_ledger")
      .select("entitlement, operation, amount")
      .eq("organization_id", membership.organization_id)
      .gt("period_ended_at", new Date().toISOString()),
  ]);
  if (organizationResult.error) throw new Error(organizationResult.error.message);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (entitlementResult.error) throw new Error(entitlementResult.error.message);
  if (membersResult.error) throw new Error(membersResult.error.message);
  if (usageResult.error) throw new Error(usageResult.error.message);

  const organization = organizationSchema.parse(organizationResult.data);
  const profile = profileResult.data
    ? profileSchema.parse(profileResult.data)
    : undefined;
  const entitlement = entitlementResult.data
    ? entitlementSchema.parse(entitlementResult.data)
    : undefined;
  const serverMemberships = z.array(organizationMembershipSchema).parse(membersResult.data ?? []);
  const displayNameFor = (row: z.infer<typeof organizationMembershipSchema>) => {
    const email = row.user_id === userData.user.id
      ? userData.user.email ?? row.email_snapshot
      : row.email_snapshot;
    return row.role === "owner"
      ? profile?.display_name ?? email?.split("@")[0] ?? "Museboard creator"
      : email?.split("@")[0] ?? "Museboard collaborator";
  };
  const authoritativeMemberships: Membership[] = serverMemberships.map((row) => ({
    id: row.user_id,
    email: (row.user_id === userData.user.id ? userData.user.email : row.email_snapshot)
      ?? `${row.user_id}@members.museboard.invalid`,
    displayNameSnapshot: displayNameFor(row),
    role: row.role,
    status: row.status,
    invitedAt: row.created_at,
    ...(row.status === "active" ? { joinedAt: row.updated_at } : {}),
    ...(row.status === "removed" ? { removedAt: row.updated_at } : {}),
  }));
  const used: Partial<Record<Entitlement, number>> = {};
  const reserved: Partial<Record<Entitlement, number>> = {};
  for (const entry of z.array(usageLedgerSchema).parse(usageResult.data ?? [])) {
    if (entry.operation === "reserve") reserved[entry.entitlement] = (reserved[entry.entitlement] ?? 0) + entry.amount;
    if (entry.operation === "commit") {
      reserved[entry.entitlement] = Math.max(0, (reserved[entry.entitlement] ?? 0) - entry.amount);
      used[entry.entitlement] = (used[entry.entitlement] ?? 0) + entry.amount;
    }
    if (entry.operation === "release") reserved[entry.entitlement] = Math.max(0, (reserved[entry.entitlement] ?? 0) - entry.amount);
  }

  return {
    userId: userData.user.id,
    email: userData.user.email,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationSlug: organization.slug,
    role: membership.role,
    displayName: membership.role === "owner"
      ? profile?.display_name ?? userData.user.email?.split("@")[0] ?? "Museboard creator"
      : userData.user.email?.split("@")[0] ?? "Museboard collaborator",
    plan: effectivePlanFromEntitlement(entitlement),
    stripeStatus: entitlement?.stripe_status,
    stripeSubscriptionId: entitlement?.stripe_subscription_id,
    activeUntil: entitlement?.active_until ?? undefined,
    memberships: authoritativeMemberships,
    currentActorMembershipId: userData.user.id,
    used,
    reserved,
  };
}

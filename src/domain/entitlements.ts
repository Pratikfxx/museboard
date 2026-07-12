import { z } from "zod";

export type Plan = "free" | "creator" | "pro" | "studio";
export type Entitlement =
  | "manual_planning"
  | "strategist_pack"
  | "opportunity_refresh"
  | "export_pack";

export type QuotaResetPeriod = "week" | "month";

export interface PlanCatalogEntry {
  name: "Free" | "Creator" | "Pro" | "Studio";
  priceUsdMonthly: 0 | 19 | 39 | 79;
  workspaces: number;
  members: number;
  opportunities: { limit: number; resetPeriod: QuotaResetPeriod };
  strategistPacks: { limit: number; resetPeriod: "month" };
  manualPlanning: "unlimited";
  exportHistoryDays: number;
  metricHistory: { limit: number; unit: "posts" | "days" };
  commentsAndApprovals: boolean;
  platformVariants: number;
}

export const PLAN_CATALOG = {
  free: {
    name: "Free",
    priceUsdMonthly: 0,
    workspaces: 1,
    members: 1,
    opportunities: { limit: 5, resetPeriod: "week" },
    strategistPacks: { limit: 2, resetPeriod: "month" },
    manualPlanning: "unlimited",
    exportHistoryDays: 30,
    metricHistory: { limit: 10, unit: "posts" },
    commentsAndApprovals: false,
    platformVariants: 1,
  },
  creator: {
    name: "Creator",
    priceUsdMonthly: 19,
    workspaces: 1,
    members: 1,
    opportunities: { limit: 30, resetPeriod: "month" },
    strategistPacks: { limit: 30, resetPeriod: "month" },
    manualPlanning: "unlimited",
    exportHistoryDays: 365,
    metricHistory: { limit: 365, unit: "days" },
    commentsAndApprovals: false,
    platformVariants: 3,
  },
  pro: {
    name: "Pro",
    priceUsdMonthly: 39,
    workspaces: 1,
    members: 2,
    opportunities: { limit: 100, resetPeriod: "month" },
    strategistPacks: { limit: 100, resetPeriod: "month" },
    manualPlanning: "unlimited",
    exportHistoryDays: 730,
    metricHistory: { limit: 730, unit: "days" },
    commentsAndApprovals: true,
    platformVariants: 5,
  },
  studio: {
    name: "Studio",
    priceUsdMonthly: 79,
    workspaces: 3,
    members: 6,
    opportunities: { limit: 250, resetPeriod: "month" },
    strategistPacks: { limit: 250, resetPeriod: "month" },
    manualPlanning: "unlimited",
    exportHistoryDays: 730,
    metricHistory: { limit: 730, unit: "days" },
    commentsAndApprovals: true,
    platformVariants: 5,
  },
} as const satisfies Record<Plan, PlanCatalogEntry>;

export interface EntitlementPolicy {
  limit: number | null;
  resetPeriod: QuotaResetPeriod | null;
}

export interface EntitlementUsage {
  plan: Plan;
  used: Partial<Record<Entitlement, number>>;
  reserved: Partial<Record<Entitlement, number>>;
  resetAt: string;
}

export type EntitlementDecision =
  | { allowed: true; remaining?: number }
  | { allowed: false; resetAt: string };

export const entitlementUsageSchema: z.ZodType<EntitlementUsage> = z.object({
  plan: z.enum(["free", "creator", "pro", "studio"]),
  used: z.record(z.string(), z.number().int().nonnegative()),
  reserved: z.record(z.string(), z.number().int().nonnegative()),
  resetAt: z.iso.datetime(),
});

/**
 * Periodic provider services reset on the catalog period. Manual planning and
 * export creation do not reset because they are unlimited; export retention is
 * governed separately by `exportHistoryDays` in the plan catalog.
 */
export function getEntitlementPolicy(
  plan: Plan,
  entitlement: Entitlement,
): EntitlementPolicy {
  const catalog = PLAN_CATALOG[plan];

  switch (entitlement) {
    case "opportunity_refresh":
      return catalog.opportunities;
    case "strategist_pack":
      return catalog.strategistPacks;
    case "manual_planning":
    case "export_pack":
      return { limit: null, resetPeriod: null };
  }
}

function assertPositiveInteger(amount: number): void {
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) {
    throw new Error("Quota amount must be a positive integer");
  }
}

export function checkEntitlement(
  usage: EntitlementUsage,
  entitlement: Entitlement,
): EntitlementDecision {
  const quota = getEntitlementPolicy(usage.plan, entitlement).limit;

  if (quota === null) {
    return { allowed: true };
  }

  const consumed =
    (usage.used[entitlement] ?? 0) + (usage.reserved[entitlement] ?? 0);

  if (consumed >= quota) {
    return { allowed: false, resetAt: usage.resetAt };
  }

  return { allowed: true, remaining: quota - consumed };
}

export function reserveEntitlement(
  usage: EntitlementUsage,
  entitlement: Entitlement,
  amount = 1,
): { decision: EntitlementDecision; usage: EntitlementUsage } {
  assertPositiveInteger(amount);

  const decision = checkEntitlement(usage, entitlement);
  if (!decision.allowed || decision.remaining === undefined) {
    return { decision, usage };
  }

  if (decision.remaining < amount) {
    return {
      decision: { allowed: false, resetAt: usage.resetAt },
      usage,
    };
  }

  return {
    decision: { allowed: true, remaining: decision.remaining - amount },
    usage: {
      ...usage,
      reserved: {
        ...usage.reserved,
        [entitlement]: (usage.reserved[entitlement] ?? 0) + amount,
      },
    },
  };
}

export function commitEntitlement(
  usage: EntitlementUsage,
  entitlement: Entitlement,
  amount = 1,
): EntitlementUsage {
  assertPositiveInteger(amount);
  const reserved = usage.reserved[entitlement] ?? 0;
  if (amount > reserved) {
    throw new Error("Cannot commit more quota than is reserved");
  }

  return {
    ...usage,
    used: {
      ...usage.used,
      [entitlement]: (usage.used[entitlement] ?? 0) + amount,
    },
    reserved: {
      ...usage.reserved,
      [entitlement]: reserved - amount,
    },
  };
}

export function releaseEntitlement(
  usage: EntitlementUsage,
  entitlement: Entitlement,
  amount = 1,
): EntitlementUsage {
  assertPositiveInteger(amount);
  const reserved = usage.reserved[entitlement] ?? 0;
  if (amount > reserved) {
    throw new Error("Cannot release more quota than is reserved");
  }

  return {
    ...usage,
    reserved: {
      ...usage.reserved,
      [entitlement]: reserved - amount,
    },
  };
}

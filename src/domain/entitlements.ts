import { z } from "zod";

export type Plan = "free" | "pro";
export type Entitlement =
  | "manual_planning"
  | "strategist_pack"
  | "opportunity_refresh"
  | "export_pack";

export interface EntitlementUsage {
  plan: Plan;
  used: Partial<Record<Entitlement, number>>;
  reserved: Partial<Record<Entitlement, number>>;
  resetAt: string;
}

export type EntitlementDecision =
  | { allowed: true; remaining?: number }
  | { allowed: false; resetAt: string };

const QUOTAS: Record<Plan, Record<Entitlement, number | null>> = {
  free: {
    manual_planning: null,
    strategist_pack: 1,
    opportunity_refresh: 3,
    export_pack: 5,
  },
  pro: {
    manual_planning: null,
    strategist_pack: 50,
    opportunity_refresh: 100,
    export_pack: 100,
  },
};

export const entitlementUsageSchema: z.ZodType<EntitlementUsage> = z.object({
  plan: z.enum(["free", "pro"]),
  used: z.record(z.string(), z.number().int().nonnegative()),
  reserved: z.record(z.string(), z.number().int().nonnegative()),
  resetAt: z.iso.datetime(),
});

export function checkEntitlement(
  usage: EntitlementUsage,
  entitlement: Entitlement,
): EntitlementDecision {
  const quota = QUOTAS[usage.plan][entitlement];

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
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Reservation amount must be a positive integer");
  }

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
  const reserved = usage.reserved[entitlement] ?? 0;
  if (amount <= 0 || amount > reserved) {
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
  const reserved = usage.reserved[entitlement] ?? 0;
  if (amount <= 0 || amount > reserved) {
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

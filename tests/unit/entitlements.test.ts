import { describe, expect, it } from "vitest";

import type { EntitlementUsage } from "@/domain/entitlements";
import {
  PLAN_CATALOG,
  checkEntitlement,
  commitEntitlement,
  entitlementUsageSchema,
  getEntitlementPolicy,
  releaseEntitlement,
  reserveEntitlement,
} from "@/domain/entitlements";

const resetAt = "2026-08-01T00:00:00.000Z";

const freeUsage: EntitlementUsage = {
  plan: "free",
  used: { strategist_pack: 1 },
  reserved: {},
  resetAt,
};

describe("entitlements", () => {
  it("publishes the exact four-tier product catalog", () => {
    expect(PLAN_CATALOG).toEqual({
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
    });
  });

  it("accepts all four catalog plans at the persistence boundary", () => {
    for (const plan of ["free", "creator", "pro", "studio"] as const) {
      expect(
        entitlementUsageSchema.safeParse({
          plan,
          used: {},
          reserved: {},
          resetAt,
        }).success,
      ).toBe(true);
    }
    expect(
      entitlementUsageSchema.safeParse({
        plan: "enterprise",
        used: {},
        reserved: {},
        resetAt,
      }).success,
    ).toBe(false);
  });

  it("allows the second free strategist pack and denies the third", () => {
    expect(checkEntitlement(freeUsage, "strategist_pack")).toEqual({
      allowed: true,
      remaining: 1,
    });
    expect(
      checkEntitlement(
        { ...freeUsage, used: { strategist_pack: 2 } },
        "strategist_pack",
      ),
    ).toEqual({
      allowed: false,
      resetAt,
    });
  });

  it("allows five free opportunities and denies the sixth", () => {
    expect(
      checkEntitlement(
        { ...freeUsage, used: { opportunity_refresh: 4 } },
        "opportunity_refresh",
      ),
    ).toEqual({ allowed: true, remaining: 1 });
    expect(
      checkEntitlement(
        { ...freeUsage, used: { opportunity_refresh: 5 } },
        "opportunity_refresh",
      ),
    ).toEqual({ allowed: false, resetAt });
  });

  it("keeps manual planning unlimited on every plan", () => {
    for (const plan of ["free", "creator", "pro", "studio"] as const) {
      expect(
        checkEntitlement({ ...freeUsage, plan }, "manual_planning"),
      ).toEqual({ allowed: true });
    }
  });

  it("derives quota limits and reset periods from the catalog", () => {
    expect(getEntitlementPolicy("free", "opportunity_refresh")).toEqual({
      limit: 5,
      resetPeriod: "week",
    });
    expect(getEntitlementPolicy("creator", "strategist_pack")).toEqual({
      limit: 30,
      resetPeriod: "month",
    });
    expect(getEntitlementPolicy("studio", "opportunity_refresh")).toEqual({
      limit: 250,
      resetPeriod: "month",
    });
    expect(getEntitlementPolicy("free", "export_pack")).toEqual({
      limit: null,
      resetPeriod: null,
    });
  });

  it("reserves quota transactionally without changing the input usage", () => {
    const available: EntitlementUsage = {
      ...freeUsage,
      used: { strategist_pack: 0 },
    };

    const reserved = reserveEntitlement(available, "strategist_pack", 1);

    expect(reserved.decision).toEqual({ allowed: true, remaining: 1 });
    expect(reserved.usage.reserved.strategist_pack).toBe(1);
    expect(available.reserved.strategist_pack).toBeUndefined();

    const second = reserveEntitlement(reserved.usage, "strategist_pack", 1);
    expect(second.decision).toEqual({ allowed: true, remaining: 0 });
    expect(second.usage.reserved.strategist_pack).toBe(2);

    const denied = reserveEntitlement(second.usage, "strategist_pack", 1);
    expect(denied.decision).toEqual({ allowed: false, resetAt });
    expect(denied.usage).toBe(second.usage);
  });

  it("rejects fractional and non-finite commit or release amounts", () => {
    const usage: EntitlementUsage = {
      ...freeUsage,
      used: {},
      reserved: { strategist_pack: 1 },
    };

    expect(() => commitEntitlement(usage, "strategist_pack", 0.5)).toThrow(
      /positive integer/i,
    );
    expect(() => commitEntitlement(usage, "strategist_pack", Number.NaN)).toThrow(
      /positive integer/i,
    );
    expect(() => releaseEntitlement(usage, "strategist_pack", 0.5)).toThrow(
      /positive integer/i,
    );
    expect(() => releaseEntitlement(usage, "strategist_pack", Number.NaN)).toThrow(
      /positive integer/i,
    );
  });
});

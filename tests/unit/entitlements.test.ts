import { describe, expect, it } from "vitest";

import type { EntitlementUsage } from "@/domain/entitlements";
import {
  checkEntitlement,
  commitEntitlement,
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
  it("denies a free strategist pack after its quota is consumed", () => {
    expect(checkEntitlement(freeUsage, "strategist_pack")).toEqual({
      allowed: false,
      resetAt,
    });
  });

  it("keeps manual planning available on the free plan", () => {
    expect(checkEntitlement(freeUsage, "manual_planning")).toEqual({
      allowed: true,
    });
  });

  it("reserves quota transactionally without changing the input usage", () => {
    const available: EntitlementUsage = {
      ...freeUsage,
      used: { strategist_pack: 0 },
    };

    const reserved = reserveEntitlement(available, "strategist_pack", 1);

    expect(reserved.decision).toEqual({ allowed: true, remaining: 0 });
    expect(reserved.usage.reserved.strategist_pack).toBe(1);
    expect(available.reserved.strategist_pack).toBeUndefined();

    const denied = reserveEntitlement(reserved.usage, "strategist_pack", 1);
    expect(denied.decision).toEqual({ allowed: false, resetAt });
    expect(denied.usage).toBe(reserved.usage);
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

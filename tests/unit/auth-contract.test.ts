import { describe, expect, it } from "vitest";

import { safeInternalPath } from "@/lib/auth/redirect";
import { effectivePlanFromEntitlement } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";

describe("production authentication contract", () => {
  it("accepts only same-origin application return paths", () => {
    expect(safeInternalPath("/app/settings/billing?checkout=return#plan")).toBe(
      "/app/settings/billing?checkout=return#plan",
    );
    expect(safeInternalPath("https://evil.example/app")).toBe("/app/today");
    expect(safeInternalPath("//evil.example/app")).toBe("/app/today");
    expect(safeInternalPath("/\\evil.example/app")).toBe("/app/today");
    expect(safeInternalPath("/%5cevil.example/app")).toBe("/app/today");
    expect(safeInternalPath("/%E0%A4%A")).toBe("/app/today");
  });

  it("keeps auth availability independent from complete Stripe configuration", () => {
    const demo = getFeatureConfig({});
    const authOnly = getFeatureConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    });
    const partial = getFeatureConfig({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co" });

    expect(demo.authMode).toBe("demo");
    expect(authOnly.authMode).toBe("live");
    expect(authOnly.billingMode).toBe("unavailable");
    expect(partial.authMode).toBe("unavailable");
  });

  it("derives access from current server entitlement state and bounded grace", () => {
    const base = {
      plan: "pro" as const,
      stripe_subscription_id: "sub_1",
      active_until: null,
      grace_ends_at: null,
    };
    expect(effectivePlanFromEntitlement({ ...base, stripe_status: "active" })).toBe("pro");
    expect(effectivePlanFromEntitlement({
      ...base,
      stripe_status: "past_due",
      grace_ends_at: "2026-07-20T00:00:00.000Z",
    }, new Date("2026-07-15T00:00:00.000Z"))).toBe("pro");
    expect(effectivePlanFromEntitlement({
      ...base,
      stripe_status: "past_due",
      grace_ends_at: "2026-07-14T00:00:00.000Z",
    }, new Date("2026-07-15T00:00:00.000Z"))).toBe("free");
  });
});

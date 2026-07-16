import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: vi.fn() })),
}));

import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";

function query(result: { data: unknown; error: null }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    lte: vi.fn(),
    gt: vi.fn(async () => result),
    order: vi.fn(async () => result),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  return builder;
}

describe("authenticated workspace authority", () => {
  it("uses the ledger period boundary and aggregates reserve operations independent of row order", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T09:00:00.000Z"));
    const userId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
    const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
    const currentMembership = query({
      data: [{ organization_id: organizationId, role: "owner", status: "active" }],
      error: null,
    });
    const organization = query({ data: { id: organizationId, name: "Maya's studio", slug: "maya-studio" }, error: null });
    const profile = query({ data: { display_name: "Maya Chen" }, error: null });
    const entitlement = query({
      data: {
        plan: "pro",
        stripe_status: "active",
        stripe_subscription_id: "sub_1",
        active_until: null,
        grace_ends_at: null,
      },
      error: null,
    });
    const members = query({
      data: [{
        user_id: userId,
        role: "owner",
        status: "active",
        email_snapshot: "maya@example.com",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      }],
      error: null,
    });
    const usage = query({
      data: [
        { entitlement: "strategist_pack", operation: "commit", amount: 2, period_ended_at: "2026-07-29T00:00:00.000Z" },
        { entitlement: "strategist_pack", operation: "reserve", amount: 3, period_ended_at: "2026-07-29T00:00:00.000Z" },
      ],
      error: null,
    });
    let membershipRead = 0;
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId, email: "maya@example.com" } }, error: null })) },
      from: vi.fn((table: string) => {
        if (table === "organization_memberships") return membershipRead++ === 0 ? currentMembership : members;
        if (table === "organizations") return organization;
        if (table === "creator_profiles") return profile;
        if (table === "subscription_entitlements") return entitlement;
        if (table === "usage_ledger") return usage;
        throw new Error(`Unexpected table ${table}`);
      }),
    });

    try {
      const workspace = await getAuthenticatedWorkspace();

      expect(usage.select).toHaveBeenCalledWith("entitlement, operation, amount, period_ended_at");
      expect(usage.lte).toHaveBeenCalledWith("period_started_at", "2026-07-16T09:00:00.000Z");
      expect(workspace?.used).toEqual({ strategist_pack: 2 });
      expect(workspace?.reserved).toEqual({ strategist_pack: 1 });
      expect(workspace?.resetAt).toBe("2026-07-29T00:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });
});

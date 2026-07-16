import { describe, expect, it } from "vitest";

import { createDemoState } from "@/lib/demo/fixtures";
import {
  normalizeLiveWorkspacePayload,
  shouldPersistWorkspaceLocally,
  workspaceSnapshotSaveSchema,
} from "@/lib/workspace/snapshot";

describe("durable live workspace snapshots", () => {
  it("preserves authoritative server memberships, current actor role, and usage", () => {
    const sample = createDemoState();
    sample.entitlementUsage.plan = "studio";
    sample.memberships = [];
    sample.plannerUndo = {
      taskId: sample.plannerTasks[0].id,
      before: sample.plannerTasks[0],
      after: sample.plannerTasks[0],
      label: "Temporary undo",
    };

    const result = normalizeLiveWorkspacePayload(sample, {
      userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
      memberships: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          email: "owner@example.com",
          displayNameSnapshot: "Workspace Owner",
          role: "owner",
          status: "active",
          invitedAt: "2026-06-01T00:00:00.000Z",
          joinedAt: "2026-06-01T00:00:00.000Z",
        },
        {
          id: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
          email: "maya@example.com",
          displayNameSnapshot: "Maya Chen",
          role: "editor",
          status: "active",
          invitedAt: "2026-07-01T00:00:00.000Z",
          joinedAt: "2026-07-02T00:00:00.000Z",
        },
      ],
      currentActorMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
      plan: "creator",
      used: { strategist_pack: 7 },
      reserved: { strategist_pack: 2 },
      resetAt: "2026-08-01T00:00:00.000Z",
    });

    expect(result.dataMode).toBe("live");
    expect(result.entitlementUsage.plan).toBe("creator");
    expect(result.entitlementUsage.used).toEqual({ strategist_pack: 7 });
    expect(result.entitlementUsage.reserved).toEqual({ strategist_pack: 2 });
    expect(result.memberships).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "11111111-1111-4111-8111-111111111111", role: "owner" }),
      expect.objectContaining({ id: "8fef70b0-c52b-4312-b6e7-8fac5ed73510", role: "editor" }),
    ]));
    expect(result.currentActorMembershipId).toBe("8fef70b0-c52b-4312-b6e7-8fac5ed73510");
    expect(result.plannerUndo).toBeUndefined();
    expect(result.recoveryNotice).toBeUndefined();
  });

  it("validates organization and non-negative revision before a save", () => {
    const payload = createDemoState();
    expect(workspaceSnapshotSaveSchema.safeParse({
      organizationId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
      expectedRevision: 0,
      payload,
    }).success).toBe(true);
    expect(workspaceSnapshotSaveSchema.safeParse({
      organizationId: "not-an-organization",
      expectedRevision: -1,
      payload,
    }).success).toBe(false);
  });

  it("never writes live creator data into the sample local-storage envelope", () => {
    expect(shouldPersistWorkspaceLocally("sample")).toBe(true);
    expect(shouldPersistWorkspaceLocally("live")).toBe(false);
  });
});

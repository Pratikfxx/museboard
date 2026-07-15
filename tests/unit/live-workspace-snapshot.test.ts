import { describe, expect, it } from "vitest";

import { createDemoState } from "@/lib/demo/fixtures";
import {
  normalizeLiveWorkspacePayload,
  shouldPersistWorkspaceLocally,
  workspaceSnapshotSaveSchema,
} from "@/lib/workspace/snapshot";

describe("durable live workspace snapshots", () => {
  it("replaces browser-controlled identity and entitlement state with server truth", () => {
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
      email: "maya@example.com",
      displayName: "Maya Chen",
      plan: "creator",
      resetAt: "2026-08-01T00:00:00.000Z",
    });

    expect(result.dataMode).toBe("live");
    expect(result.entitlementUsage.plan).toBe("creator");
    expect(result.entitlementUsage.used).toEqual({});
    expect(result.memberships).toEqual([
      expect.objectContaining({
        id: "member-8fef70b0-c52b-4312-b6e7-8fac5ed73510",
        email: "maya@example.com",
        displayNameSnapshot: "Maya Chen",
        role: "owner",
        status: "active",
      }),
    ]);
    expect(result.currentActorMembershipId).toBe(
      "member-8fef70b0-c52b-4312-b6e7-8fac5ed73510",
    );
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

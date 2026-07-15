import { z } from "zod";

import type { Plan } from "@/domain/entitlements";
import type { DataMode } from "@/domain/schema";
import type { DemoMuseboardData } from "@/lib/demo/fixtures";
import { validatePersistedMuseboardData } from "@/lib/store/museboard-store";

export const workspaceSnapshotSaveSchema = z.object({
  organizationId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  payload: z.unknown(),
});

export interface LiveWorkspaceAuthority {
  userId: string;
  email?: string;
  displayName: string;
  plan: Plan;
  resetAt: string;
  memberSince?: string;
}

export function normalizeLiveWorkspacePayload(
  payload: unknown,
  authority: LiveWorkspaceAuthority,
): DemoMuseboardData {
  const parsed = validatePersistedMuseboardData(payload);
  if (!parsed.success) {
    throw new Error("The durable workspace payload is invalid");
  }
  const ownerId = `member-${authority.userId}`;
  const memberSince = authority.memberSince ?? authority.resetAt;

  return {
    ...parsed.data,
    dataMode: "live",
    plannerUndo: undefined,
    recoveryNotice: undefined,
    memberships: [
      {
        id: ownerId,
        email: authority.email ?? "owner@museboard.invalid",
        displayNameSnapshot: authority.displayName,
        role: "owner",
        status: "active",
        invitedAt: memberSince,
        joinedAt: memberSince,
      },
    ],
    currentActorMembershipId: ownerId,
    entitlementUsage: {
      plan: authority.plan,
      used: {},
      reserved: {},
      resetAt: authority.resetAt,
    },
  };
}

export function shouldPersistWorkspaceLocally(dataMode: DataMode): boolean {
  return dataMode !== "live";
}

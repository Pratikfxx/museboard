import { z } from "zod";

import type { Plan } from "@/domain/entitlements";
import type { DataMode } from "@/domain/schema";
import type { DemoMuseboardData } from "@/lib/demo/fixtures";
import type { Membership } from "@/domain/collaboration";
import type { Entitlement } from "@/domain/entitlements";
import { validatePersistedMuseboardData } from "@/lib/store/museboard-store";

export const workspaceSnapshotSaveSchema = z.object({
  organizationId: z.uuid(),
  expectedRevision: z.number().int().nonnegative(),
  payload: z.unknown(),
});

export interface LiveWorkspaceAuthority {
  userId: string;
  memberships: Membership[];
  currentActorMembershipId: string;
  plan: Plan;
  used: Partial<Record<Entitlement, number>>;
  reserved: Partial<Record<Entitlement, number>>;
  resetAt: string;
}

export function normalizeLiveWorkspacePayload(
  payload: unknown,
  authority: LiveWorkspaceAuthority,
): DemoMuseboardData {
  const parsed = validatePersistedMuseboardData(payload);
  if (!parsed.success) {
    throw new Error("The durable workspace payload is invalid");
  }
  if (
    authority.currentActorMembershipId !== authority.userId ||
    !authority.memberships.some(({ id, status }) => id === authority.userId && status === "active")
  ) {
    throw new Error("The authenticated workspace actor is not an active authoritative member");
  }

  return {
    ...parsed.data,
    dataMode: "live",
    plannerUndo: undefined,
    recoveryNotice: undefined,
    memberships: authority.memberships,
    currentActorMembershipId: authority.currentActorMembershipId,
    entitlementUsage: {
      plan: authority.plan,
      used: authority.used,
      reserved: authority.reserved,
      resetAt: authority.resetAt,
    },
  };
}

export function shouldPersistWorkspaceLocally(dataMode: DataMode): boolean {
  return dataMode !== "live";
}

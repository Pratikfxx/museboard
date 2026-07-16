import { z } from "zod";

import {
  thinkingContributionEditClaimSchema,
  thinkingRoomPresenceAreaSchema,
  thinkingRoomPresenceSnapshotSchema,
  type ThinkingRoomPresenceArea,
  type ThinkingRoomPresenceSnapshot,
} from "@/domain/thinking-room-presence";
import { thinkingContributionSchema, type ThinkingContribution } from "@/domain/thinking-rooms";
import type { SupabaseThinkingRoomClient } from "@/lib/thinking-rooms/repository";

export class ThinkingCollaborationPermissionError extends Error {}
export class ThinkingCollaborationNotFoundError extends Error {}
export class ThinkingCollaborationConflictError extends Error {}
export class ThinkingCollaborationValidationError extends Error {}

function mapError(error: { code?: string; message: string } | null): never | void {
  if (!error) return;
  if (error.code === "42501") throw new ThinkingCollaborationPermissionError(error.message);
  if (error.code === "23503") throw new ThinkingCollaborationNotFoundError(error.message);
  if (error.code === "40001") throw new ThinkingCollaborationConflictError(error.message);
  if (["23514", "22001"].includes(error.code ?? "")) throw new ThinkingCollaborationValidationError(error.message);
  throw new Error(error.message);
}

const uuid = z.uuid();

export function createThinkingRoomPresenceRepository(client: SupabaseThinkingRoomClient) {
  return {
    async sync(input: { organizationId: string; roomId: string; sessionId: string; area: ThinkingRoomPresenceArea; isComposing: boolean }): Promise<ThinkingRoomPresenceSnapshot> {
      const { data, error } = await client.rpc("sync_thinking_room_presence", {
        p_organization_id: uuid.parse(input.organizationId),
        p_room_id: uuid.parse(input.roomId),
        p_session_id: uuid.parse(input.sessionId),
        p_area: thinkingRoomPresenceAreaSchema.parse(input.area),
        p_is_composing: z.boolean().parse(input.isComposing),
      });
      mapError(error);
      const row = z.object({
        presence: z.array(z.object({ actor_user_id: z.uuid(), display_name: z.string(), area: thinkingRoomPresenceAreaSchema, is_composing: z.boolean(), expires_at: z.iso.datetime() })),
        claims: z.array(z.object({ contribution_id: z.uuid(), actor_user_id: z.uuid(), display_name: z.string(), expires_at: z.iso.datetime() })),
      }).parse(data);
      return thinkingRoomPresenceSnapshotSchema.parse({
        presence: row.presence.map((item) => ({ actorUserId: item.actor_user_id, displayName: item.display_name, area: item.area, isComposing: item.is_composing, expiresAt: item.expires_at })),
        claims: row.claims.map((item) => ({ contributionId: item.contribution_id, actorUserId: item.actor_user_id, displayName: item.display_name, expiresAt: item.expires_at })),
      });
    },
    async setClaim(input: { organizationId: string; roomId: string; contributionId: string; sessionId: string; active: boolean }) {
      const { data, error } = await client.rpc("set_thinking_contribution_edit_claim", {
        p_organization_id: uuid.parse(input.organizationId), p_room_id: uuid.parse(input.roomId),
        p_contribution_id: uuid.parse(input.contributionId), p_session_id: uuid.parse(input.sessionId), p_active: z.boolean().parse(input.active),
      });
      mapError(error);
      if (!input.active || data === null) return null;
      const row = z.object({ contribution_id: z.uuid(), actor_user_id: z.uuid(), display_name: z.string(), expires_at: z.iso.datetime() }).parse(data);
      return thinkingContributionEditClaimSchema.parse({ contributionId: row.contribution_id, actorUserId: row.actor_user_id, displayName: row.display_name, expiresAt: row.expires_at });
    },
    async leave(input: { organizationId: string; roomId: string; sessionId: string }) {
      const { error } = await client.rpc("leave_thinking_room_presence", {
        p_organization_id: uuid.parse(input.organizationId), p_room_id: uuid.parse(input.roomId), p_session_id: uuid.parse(input.sessionId),
      });
      mapError(error);
    },
    async edit(input: { organizationId: string; roomId: string; contributionId: string; sessionId: string; expectedRevision: number; body: string; sourceReferenceId?: string }): Promise<{ roomRevision: number; contribution: ThinkingContribution }> {
      const { data, error } = await client.rpc("edit_thinking_contribution", {
        p_organization_id: uuid.parse(input.organizationId), p_room_id: uuid.parse(input.roomId),
        p_contribution_id: uuid.parse(input.contributionId), p_session_id: uuid.parse(input.sessionId),
        p_expected_revision: z.number().int().positive().parse(input.expectedRevision),
        p_body: z.string().trim().min(1).max(20000).parse(input.body),
        p_source_reference_id: input.sourceReferenceId === undefined
          ? null
          : z.string().trim().min(1).max(2000).parse(input.sourceReferenceId),
      });
      mapError(error);
      const row = z.object({ room_revision: z.number().int().positive(), contribution: z.object({
        id: z.uuid(), room_id: z.uuid(), lens: thinkingContributionSchema.shape.lens, body: z.string(),
        author_user_id: z.uuid(), author_display_name_snapshot: z.string(), source_reference_id: z.string().nullable(),
        revision: z.number().int().positive(), created_at: z.iso.datetime(), updated_at: z.iso.datetime(),
      }) }).parse(data);
      return { roomRevision: row.room_revision, contribution: thinkingContributionSchema.parse({
        id: row.contribution.id, roomId: row.contribution.room_id, lens: row.contribution.lens,
        body: row.contribution.body, authorMembershipId: row.contribution.author_user_id,
        authorDisplayNameSnapshot: row.contribution.author_display_name_snapshot,
        sourceReferenceId: row.contribution.source_reference_id ?? undefined,
        revision: row.contribution.revision, createdAt: row.contribution.created_at, updatedAt: row.contribution.updated_at,
      }) };
    },
  };
}

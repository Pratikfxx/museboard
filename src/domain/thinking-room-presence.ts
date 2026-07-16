import { z } from "zod";

export const thinkingRoomPresenceAreaSchema = z.enum([
  "room",
  "audience_tensions",
  "evidence",
  "challenges",
  "possibilities",
  "synthesis",
]);

export const thinkingRoomPresenceSchema = z.object({
  actorUserId: z.uuid(),
  displayName: z.string().trim().min(1).max(160),
  area: thinkingRoomPresenceAreaSchema,
  isComposing: z.boolean(),
  expiresAt: z.iso.datetime(),
}).strict();

export const thinkingContributionEditClaimSchema = z.object({
  contributionId: z.uuid(),
  actorUserId: z.uuid(),
  displayName: z.string().trim().min(1).max(160),
  expiresAt: z.iso.datetime(),
}).strict();

export const thinkingRoomPresenceSnapshotSchema = z.object({
  presence: z.array(thinkingRoomPresenceSchema),
  claims: z.array(thinkingContributionEditClaimSchema),
}).strict();

export type ThinkingRoomPresenceArea = z.infer<typeof thinkingRoomPresenceAreaSchema>;
export type ThinkingRoomPresence = z.infer<typeof thinkingRoomPresenceSchema>;
export type ThinkingContributionEditClaim = z.infer<typeof thinkingContributionEditClaimSchema>;
export type ThinkingRoomPresenceSnapshot = z.infer<typeof thinkingRoomPresenceSnapshotSchema>;

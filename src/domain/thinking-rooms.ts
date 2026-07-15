import { z } from "zod";

export const THINKING_ROOM_STATES = [
  "exploring",
  "synthesizing",
  "decided",
  "converted",
  "archived",
] as const;
export const THINKING_LENSES = [
  "audience_tensions",
  "evidence",
  "challenges",
  "possibilities",
] as const;
export const THINKING_ROOM_ROLES = [
  "facilitator",
  "contributor",
  "viewer",
] as const;
export const CONTRIBUTION_REACTION_KINDS = [
  "agree",
  "concern",
  "needs_evidence",
  "promising",
] as const;
export const SYNTHESIS_CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const SYNTHESIS_REVISION_STATUSES = [
  "draft",
  "proposed",
  "accepted",
  "superseded",
] as const;

export const thinkingRoomStateSchema = z.enum(THINKING_ROOM_STATES);
export const thinkingLensSchema = z.enum(THINKING_LENSES);
export const thinkingRoomRoleSchema = z.enum(THINKING_ROOM_ROLES);
export const contributionReactionKindSchema = z.enum(CONTRIBUTION_REACTION_KINDS);

export type ThinkingRoomState = z.infer<typeof thinkingRoomStateSchema>;
export type ThinkingLens = z.infer<typeof thinkingLensSchema>;
export type ThinkingRoomRole = z.infer<typeof thinkingRoomRoleSchema>;

const requiredText = z.string().trim().min(1);
const identifier = z.string().trim().min(1);

export const thinkingRoomOriginSchema = z.object({
  roomId: identifier,
  question: requiredText,
  synthesisRevisionId: identifier,
  contributorCount: z.number().int().nonnegative(),
  convertedAt: z.iso.datetime(),
});

export type ThinkingRoomOrigin = z.infer<typeof thinkingRoomOriginSchema>;

export const thinkingRoomSchema = z.object({
  id: identifier,
  organizationId: identifier,
  workspaceId: identifier,
  question: requiredText,
  templateId: identifier,
  status: thinkingRoomStateSchema,
  facilitatorMembershipId: identifier,
  decisionOwnerMembershipId: identifier.optional(),
  context: requiredText.optional(),
  decisionDueAt: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().optional(),
  revision: z.number().int().positive(),
});

export type ThinkingRoom = z.infer<typeof thinkingRoomSchema>;

export const thinkingContributionSchema = z.object({
  id: identifier,
  roomId: identifier,
  lens: thinkingLensSchema,
  body: requiredText,
  authorMembershipId: identifier,
  authorDisplayNameSnapshot: requiredText,
  sourceReferenceId: identifier.optional(),
  mentionedMembershipId: identifier.optional(),
  relatedContributionId: identifier.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().optional(),
  revision: z.number().int().positive(),
});

export type ThinkingContribution = z.infer<typeof thinkingContributionSchema>;

export const contributionReactionSchema = z.object({
  id: identifier,
  roomId: identifier,
  contributionId: identifier,
  membershipId: identifier,
  kind: contributionReactionKindSchema,
  createdAt: z.iso.datetime(),
});

export type ContributionReaction = z.infer<typeof contributionReactionSchema>;

export const chosenContentDirectionSchema = z.object({
  title: requiredText,
  audienceTension: requiredText,
  angle: requiredText,
  keyChallenge: requiredText.optional(),
  evidenceReferenceIds: z.array(identifier),
  basis: z.enum(["evidence", "creator_experience", "opinion"]),
});

export type ChosenContentDirection = z.infer<typeof chosenContentDirectionSchema>;

export const synthesisGenerationProvenanceSchema = z.object({
  kind: z.enum(["human", "ai_suggested"]),
  provider: requiredText.optional(),
  model: requiredText.optional(),
  resultId: identifier.optional(),
});

export const thinkingSynthesisRevisionSchema = z
  .object({
    id: identifier,
    roomId: identifier,
    number: z.number().int().positive(),
    belief: requiredText,
    unknowns: z.array(requiredText),
    confidence: z.enum(SYNTHESIS_CONFIDENCE_LEVELS),
    chosenDirection: chosenContentDirectionSchema,
    openChallengeIds: z.array(identifier),
    sourceContributionIds: z.array(identifier),
    createdByMembershipId: identifier,
    generationProvenance: synthesisGenerationProvenanceSchema.optional(),
    status: z.enum(SYNTHESIS_REVISION_STATUSES),
    createdAt: z.iso.datetime(),
    acceptedAt: z.iso.datetime().optional(),
    acceptedByMembershipId: identifier.optional(),
  })
  .superRefine((revision, context) => {
    if (
      revision.status === "accepted" &&
      (!revision.acceptedAt || !revision.acceptedByMembershipId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Accepted synthesis revisions require acceptance attribution",
        path: ["status"],
      });
    }
    if (
      revision.status !== "accepted" &&
      (revision.acceptedAt || revision.acceptedByMembershipId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Only accepted synthesis revisions may include acceptance attribution",
        path: ["status"],
      });
    }
  });

export type ThinkingSynthesisRevision = z.infer<
  typeof thinkingSynthesisRevisionSchema
>;

interface DeterministicEntityInput {
  id: string;
  at: string;
}

export interface CreateThinkingRoomInput {
  organizationId: string;
  workspaceId: string;
  question: string;
  templateId: string;
  facilitatorMembershipId: string;
  decisionOwnerMembershipId?: string;
  context?: string;
  decisionDueAt?: string;
}

export function createThinkingRoom(
  input: CreateThinkingRoomInput,
  injected: DeterministicEntityInput,
): ThinkingRoom {
  return thinkingRoomSchema.parse({
    ...input,
    id: injected.id,
    status: "exploring",
    createdAt: injected.at,
    updatedAt: injected.at,
    revision: 1,
  });
}

export interface AddThinkingContributionInput {
  roomId: string;
  lens: ThinkingLens;
  body: string;
  authorMembershipId: string;
  authorDisplayNameSnapshot: string;
  sourceReferenceId?: string;
  mentionedMembershipId?: string;
  relatedContributionId?: string;
}

export function addThinkingContribution(
  input: AddThinkingContributionInput,
  injected: DeterministicEntityInput,
): ThinkingContribution {
  return thinkingContributionSchema.parse({
    ...input,
    id: injected.id,
    createdAt: injected.at,
    updatedAt: injected.at,
    revision: 1,
  });
}

export interface ToggleContributionReactionInput {
  roomId: string;
  contributionId: string;
  membershipId: string;
  kind: ContributionReaction["kind"];
}

export function toggleContributionReaction(
  reactions: readonly ContributionReaction[],
  input: ToggleContributionReactionInput,
  injected: DeterministicEntityInput,
): ContributionReaction[] {
  const existing = reactions.find(
    (reaction) =>
      reaction.roomId === input.roomId &&
      reaction.contributionId === input.contributionId &&
      reaction.membershipId === input.membershipId &&
      reaction.kind === input.kind,
  );

  if (existing) {
    return reactions.filter((reaction) => reaction.id !== existing.id);
  }

  const reaction = contributionReactionSchema.parse({
    ...input,
    id: injected.id,
    createdAt: injected.at,
  });
  return [...reactions, reaction];
}

export interface CreateSynthesisRevisionInput {
  roomId: string;
  belief: string;
  unknowns: string[];
  confidence: ThinkingSynthesisRevision["confidence"];
  chosenDirection: ChosenContentDirection;
  openChallengeIds: string[];
  sourceContributionIds: string[];
  createdByMembershipId: string;
  generationProvenance?: ThinkingSynthesisRevision["generationProvenance"];
  status?: ThinkingSynthesisRevision["status"];
  acceptedByMembershipId?: string;
  baseRevisionId?: string;
}

export function createSynthesisRevision(
  revisions: readonly ThinkingSynthesisRevision[],
  input: CreateSynthesisRevisionInput,
  injected: DeterministicEntityInput,
): ThinkingSynthesisRevision {
  const roomRevisions = revisions
    .filter((revision) => revision.roomId === input.roomId)
    .toSorted((left, right) => left.number - right.number);
  const current = roomRevisions.at(-1);

  if (
    (current && input.baseRevisionId !== current.id) ||
    (!current && input.baseRevisionId)
  ) {
    throw new Error("Synthesis revision is stale");
  }

  const status = input.status ?? "draft";
  return thinkingSynthesisRevisionSchema.parse({
    ...input,
    id: injected.id,
    number: (current?.number ?? 0) + 1,
    status,
    createdAt: injected.at,
    ...(status === "accepted" ? { acceptedAt: injected.at } : {}),
  });
}

const ALLOWED_STATE_TRANSITIONS: Readonly<
  Record<ThinkingRoomState, readonly ThinkingRoomState[]>
> = {
  exploring: ["synthesizing", "archived"],
  synthesizing: ["decided", "archived"],
  decided: ["converted", "synthesizing", "archived"],
  converted: ["synthesizing", "archived"],
  archived: [],
};

export function updateThinkingRoomState(
  room: ThinkingRoom,
  status: ThinkingRoomState,
  injected: { at: string; expectedRevision: number },
): ThinkingRoom {
  if (room.revision !== injected.expectedRevision) {
    throw new Error("Thinking Room revision is stale");
  }
  if (status === room.status) return room;
  if (!ALLOWED_STATE_TRANSITIONS[room.status].includes(status)) {
    throw new Error(`Cannot move a Thinking Room from ${room.status} to ${status}`);
  }

  return thinkingRoomSchema.parse({
    ...room,
    status,
    updatedAt: injected.at,
    revision: room.revision + 1,
    ...(status === "archived" ? { archivedAt: injected.at } : {}),
  });
}

export function roomCanConvert(
  room: ThinkingRoom,
  revisions: readonly ThinkingSynthesisRevision[],
): boolean {
  if (room.status !== "decided" || !room.decisionOwnerMembershipId) return false;

  const current = revisions
    .filter((revision) => revision.roomId === room.id)
    .toSorted((left, right) => left.number - right.number)
    .at(-1);
  if (!current || current.status !== "accepted") return false;

  const direction = current.chosenDirection;
  return (
    direction.audienceTension.length > 0 &&
    direction.angle.length > 0 &&
    (direction.evidenceReferenceIds.length > 0 || direction.basis !== "evidence")
  );
}

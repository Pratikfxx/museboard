import { z } from "zod";

import {
  contributionLinkSchema,
  contributionReactionSchema,
  thinkingContributionSchema,
  thinkingRoomContentOriginSchema,
  thinkingRoomSchema,
  thinkingSynthesisRevisionSchema,
  type ContributionLink,
  type ContributionReaction,
  type ThinkingContribution,
  type ThinkingRoomContentOrigin,
  type ThinkingRoom,
  type ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";

interface RepositoryError {
  code?: string;
  message: string;
}

interface QueryResult {
  data: unknown;
  error: RepositoryError | null;
}

interface RoomListQuery {
  select(columns: string): {
    eq(column: string, value: string): {
      order(column: string, options: { ascending: boolean }): Promise<QueryResult>;
    };
  };
}

interface RoomLoadQuery {
  select(columns: string): {
    eq(column: string, value: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<QueryResult>;
      };
    };
  };
}

interface ChildLoadQuery {
  select(columns: string): {
    eq(column: string, value: string): {
      eq(column: string, value: string): {
        order(column: string, options: { ascending: boolean }): Promise<QueryResult>;
      };
    };
  };
}

export interface SupabaseThinkingRoomClient {
  from(table: string): unknown;
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RepositoryError | null }>;
}

export interface ThinkingRoomAggregate {
  room: ThinkingRoom;
  contributions: ThinkingContribution[];
  reactions: ContributionReaction[];
  links: ContributionLink[];
  synthesisRevisions: ThinkingSynthesisRevision[];
  contentOrigins?: ThinkingRoomContentOrigin[];
}

export interface ThinkingRoomRepository {
  list(organizationId: string): Promise<ThinkingRoom[]>;
  load(organizationId: string, roomId: string): Promise<ThinkingRoomAggregate | null>;
  create(aggregate: ThinkingRoomAggregate): Promise<ThinkingRoomAggregate>;
  save(input: {
    expectedRevision: number;
    aggregate: ThinkingRoomAggregate;
  }): Promise<ThinkingRoomAggregate>;
  setReaction(input: {
    organizationId: string;
    roomId: string;
    contributionId: string;
    kind: ContributionReaction["kind"];
    active: boolean;
    reactionId: string;
  }): Promise<{ roomRevision: number; reaction: ContributionReaction | null }>;
  convert(input: {
    organizationId: string;
    roomId: string;
    synthesisRevisionId: string;
    ideaId: string;
    expectedRevision: number;
  }): Promise<{ origin: ThinkingRoomContentOrigin; roomRevision: number }>;
}

export class ThinkingRoomRevisionConflictError extends Error {
  constructor() {
    super("This Thinking Room changed elsewhere. Reload before saving again.");
    this.name = "ThinkingRoomRevisionConflictError";
  }
}

export class ThinkingRoomValidationError extends Error {
  constructor() {
    super("Thinking Room data violates a persistence constraint.");
    this.name = "ThinkingRoomValidationError";
  }
}

export class ThinkingRoomPermissionError extends Error {
  constructor() {
    super("You do not have permission to change this Thinking Room.");
    this.name = "ThinkingRoomPermissionError";
  }
}

export class ThinkingRoomNotFoundError extends Error {
  constructor() {
    super("The Thinking Room contribution was not found.");
    this.name = "ThinkingRoomNotFoundError";
  }
}

const uuid = z.uuid();
const nullableDate = z.iso.datetime().nullable().optional();
const nullableUuid = z.uuid().nullable().optional();
const nullableText = z.string().nullable().optional();

const roomRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  workspace_id: z.string().trim().min(1),
  question: z.string().trim().min(1),
  template_id: z.string().trim().min(1),
  status: z.enum(["exploring", "synthesizing", "decided", "converted", "archived"]),
  facilitator_user_id: z.uuid(),
  decision_owner_user_id: nullableUuid,
  context: nullableText,
  decision_due_at: nullableDate,
  revision: z.number().int().positive(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  archived_at: nullableDate,
});

const contributionRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  room_id: z.uuid(),
  lens: z.enum(["audience_tensions", "evidence", "challenges", "possibilities"]),
  body: z.string().trim().min(1),
  author_user_id: z.uuid(),
  author_display_name_snapshot: z.string().trim().min(1),
  source_reference_id: nullableText,
  mentioned_user_id: nullableUuid,
  related_contribution_id: nullableUuid,
  revision: z.number().int().positive(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  deleted_at: nullableDate,
});

const reactionRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  room_id: z.uuid(),
  contribution_id: z.uuid(),
  actor_user_id: z.uuid(),
  kind: z.enum(["agree", "concern", "needs_evidence", "promising"]),
  created_at: z.iso.datetime(),
});

const linkRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  room_id: z.uuid(),
  from_contribution_id: z.uuid(),
  to_contribution_id: z.uuid(),
  relationship: z.enum(["supports", "challenges", "extends", "combines"]),
  created_by_user_id: z.uuid(),
  resolution_status: z.enum(["open", "resolved"]),
  resolution_note: nullableText,
  resolved_by_user_id: nullableUuid,
  created_at: z.iso.datetime(),
  resolved_at: nullableDate,
});

const synthesisRowSchema = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  room_id: z.uuid(),
  number: z.number().int().positive(),
  belief: z.string().trim().min(1),
  unknowns: z.array(z.string().trim().min(1)),
  confidence: z.enum(["low", "medium", "high"]),
  chosen_direction: z.unknown(),
  open_challenge_ids: z.array(z.uuid()),
  source_contribution_ids: z.array(z.uuid()),
  created_by_user_id: z.uuid(),
  generation_provenance: z.unknown().nullable().optional(),
  status: z.enum(["draft", "proposed", "accepted", "superseded"]),
  created_at: z.iso.datetime(),
  accepted_at: nullableDate,
  accepted_by_user_id: nullableUuid,
});

const contentOriginRowSchema = z.object({
  organization_id: z.uuid(),
  room_id: z.uuid(),
  synthesis_revision_id: z.uuid(),
  idea_id: z.uuid(),
  created_by_user_id: z.uuid(),
  created_at: z.iso.datetime(),
});

function omitNullish<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined),
  ) as T;
}

function roomFromRow(input: unknown): ThinkingRoom {
  const row = roomRowSchema.parse(input);
  return thinkingRoomSchema.parse(omitNullish({
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    question: row.question,
    templateId: row.template_id,
    status: row.status,
    facilitatorMembershipId: row.facilitator_user_id,
    decisionOwnerMembershipId: row.decision_owner_user_id,
    context: row.context,
    decisionDueAt: row.decision_due_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  }));
}

function contributionFromRow(input: unknown): ThinkingContribution {
  const row = contributionRowSchema.parse(input);
  return thinkingContributionSchema.parse(omitNullish({
    id: row.id,
    roomId: row.room_id,
    lens: row.lens,
    body: row.body,
    authorMembershipId: row.author_user_id,
    authorDisplayNameSnapshot: row.author_display_name_snapshot,
    sourceReferenceId: row.source_reference_id,
    mentionedMembershipId: row.mentioned_user_id,
    relatedContributionId: row.related_contribution_id,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
}

function reactionFromRow(input: unknown): ContributionReaction {
  const row = reactionRowSchema.parse(input);
  return contributionReactionSchema.parse({
    id: row.id,
    roomId: row.room_id,
    contributionId: row.contribution_id,
    membershipId: row.actor_user_id,
    kind: row.kind,
    createdAt: row.created_at,
  });
}

function linkFromRow(input: unknown): ContributionLink {
  const row = linkRowSchema.parse(input);
  return contributionLinkSchema.parse(omitNullish({
    id: row.id,
    roomId: row.room_id,
    fromContributionId: row.from_contribution_id,
    toContributionId: row.to_contribution_id,
    relationship: row.relationship,
    createdByMembershipId: row.created_by_user_id,
    resolutionStatus: row.resolution_status,
    resolutionNote: row.resolution_note,
    resolvedByMembershipId: row.resolved_by_user_id,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  }));
}

function synthesisFromRow(input: unknown): ThinkingSynthesisRevision {
  const row = synthesisRowSchema.parse(input);
  return thinkingSynthesisRevisionSchema.parse(omitNullish({
    id: row.id,
    roomId: row.room_id,
    number: row.number,
    belief: row.belief,
    unknowns: row.unknowns,
    confidence: row.confidence,
    chosenDirection: row.chosen_direction,
    openChallengeIds: row.open_challenge_ids,
    sourceContributionIds: row.source_contribution_ids,
    createdByMembershipId: row.created_by_user_id,
    generationProvenance: row.generation_provenance,
    status: row.status,
    createdAt: row.created_at,
    acceptedAt: row.accepted_at,
    acceptedByMembershipId: row.accepted_by_user_id,
  }));
}

function contentOriginFromRow(input: unknown): ThinkingRoomContentOrigin {
  const row = contentOriginRowSchema.parse(input);
  return thinkingRoomContentOriginSchema.parse({
    roomId: row.room_id,
    synthesisRevisionId: row.synthesis_revision_id,
    ideaId: row.idea_id,
    createdByMembershipId: row.created_by_user_id,
    createdAt: row.created_at,
  });
}

export function parseThinkingRoomAggregate(input: unknown): ThinkingRoomAggregate {
  const aggregate = z.object({
    room: thinkingRoomSchema,
    contributions: z.array(thinkingContributionSchema),
    reactions: z.array(contributionReactionSchema),
    links: z.array(contributionLinkSchema).default([]),
    synthesisRevisions: z.array(thinkingSynthesisRevisionSchema),
    contentOrigins: z.array(thinkingRoomContentOriginSchema).default([]),
  }).parse(input);

  z.string().max(160).parse(aggregate.room.workspaceId);
  z.string().max(2000).parse(aggregate.room.question);
  z.string().max(120).parse(aggregate.room.templateId);

  uuid.parse(aggregate.room.id);
  uuid.parse(aggregate.room.organizationId);
  uuid.parse(aggregate.room.facilitatorMembershipId);
  if (aggregate.room.decisionOwnerMembershipId) {
    uuid.parse(aggregate.room.decisionOwnerMembershipId);
  }

  const contributionIds = new Set<string>();
  for (const contribution of aggregate.contributions) {
    uuid.parse(contribution.id);
    uuid.parse(contribution.authorMembershipId);
    z.string().max(20000).parse(contribution.body);
    z.string().max(160).parse(contribution.authorDisplayNameSnapshot);
    if (contribution.mentionedMembershipId) uuid.parse(contribution.mentionedMembershipId);
    if (contribution.relatedContributionId) uuid.parse(contribution.relatedContributionId);
    if (contribution.roomId !== aggregate.room.id) {
      throw new z.ZodError([]);
    }
    contributionIds.add(contribution.id);
  }
  for (const contribution of aggregate.contributions) {
    if (
      contribution.relatedContributionId &&
      !contributionIds.has(contribution.relatedContributionId)
    ) {
      throw new z.ZodError([]);
    }
  }
  for (const reaction of aggregate.reactions) {
    uuid.parse(reaction.id);
    uuid.parse(reaction.membershipId);
    if (
      reaction.roomId !== aggregate.room.id ||
      !contributionIds.has(reaction.contributionId)
    ) {
      throw new z.ZodError([]);
    }
  }
  for (const link of aggregate.links) {
    uuid.parse(link.id);
    uuid.parse(link.createdByMembershipId);
    if (link.resolvedByMembershipId) uuid.parse(link.resolvedByMembershipId);
    z.string().max(20000).optional().parse(link.resolutionNote);
    if (
      link.roomId !== aggregate.room.id ||
      !contributionIds.has(link.fromContributionId) ||
      !contributionIds.has(link.toContributionId)
    ) {
      throw new z.ZodError([]);
    }
  }
  for (const revision of aggregate.synthesisRevisions) {
    uuid.parse(revision.id);
    uuid.parse(revision.createdByMembershipId);
    z.string().max(20000).parse(revision.belief);
    if (revision.acceptedByMembershipId) uuid.parse(revision.acceptedByMembershipId);
    if (
      revision.roomId !== aggregate.room.id ||
      [...revision.openChallengeIds, ...revision.sourceContributionIds].some(
        (id) => !contributionIds.has(id),
      )
    ) {
      throw new z.ZodError([]);
    }
  }
  if (aggregate.synthesisRevisions.filter(({ status }) => status === "accepted").length > 1) {
    throw new z.ZodError([]);
  }
  const synthesisIds = new Set(aggregate.synthesisRevisions.map(({ id }) => id));
  for (const origin of aggregate.contentOrigins) {
    uuid.parse(origin.ideaId);
    uuid.parse(origin.createdByMembershipId);
    if (
      origin.roomId !== aggregate.room.id ||
      !synthesisIds.has(origin.synthesisRevisionId)
    ) {
      throw new z.ZodError([]);
    }
  }
  return aggregate;
}

function roomRpcPayload(room: ThinkingRoom) {
  return {
    workspace_id: room.workspaceId,
    question: room.question,
    template_id: room.templateId,
    status: room.status,
    facilitator_user_id: room.facilitatorMembershipId,
    decision_owner_user_id: room.decisionOwnerMembershipId ?? null,
    context: room.context ?? null,
    decision_due_at: room.decisionDueAt ?? null,
    created_at: room.createdAt,
    updated_at: room.updatedAt,
    archived_at: room.archivedAt ?? null,
  };
}

function contributionRpcPayload(contribution: ThinkingContribution) {
  return {
    id: contribution.id,
    lens: contribution.lens,
    body: contribution.body,
    author_user_id: contribution.authorMembershipId,
    author_display_name_snapshot: contribution.authorDisplayNameSnapshot,
    source_reference_id: contribution.sourceReferenceId ?? null,
    mentioned_user_id: contribution.mentionedMembershipId ?? null,
    related_contribution_id: contribution.relatedContributionId ?? null,
    revision: contribution.revision,
    created_at: contribution.createdAt,
    updated_at: contribution.updatedAt,
    deleted_at: contribution.deletedAt ?? null,
  };
}

function reactionRpcPayload(reaction: ContributionReaction) {
  return {
    id: reaction.id,
    contribution_id: reaction.contributionId,
    actor_user_id: reaction.membershipId,
    kind: reaction.kind,
    created_at: reaction.createdAt,
  };
}

function linkRpcPayload(link: ContributionLink) {
  return {
    id: link.id,
    from_contribution_id: link.fromContributionId,
    to_contribution_id: link.toContributionId,
    relationship: link.relationship,
    created_by_user_id: link.createdByMembershipId,
    resolution_status: link.resolutionStatus,
    resolution_note: link.resolutionNote ?? null,
    resolved_by_user_id: link.resolvedByMembershipId ?? null,
    created_at: link.createdAt,
    resolved_at: link.resolvedAt ?? null,
  };
}

function synthesisRpcPayload(revision: ThinkingSynthesisRevision) {
  return {
    id: revision.id,
    number: revision.number,
    belief: revision.belief,
    unknowns: revision.unknowns,
    confidence: revision.confidence,
    chosen_direction: revision.chosenDirection,
    open_challenge_ids: revision.openChallengeIds,
    source_contribution_ids: revision.sourceContributionIds,
    created_by_user_id: revision.createdByMembershipId,
    generation_provenance: revision.generationProvenance ?? null,
    status: revision.status,
    created_at: revision.createdAt,
    accepted_at: revision.acceptedAt ?? null,
    accepted_by_user_id: revision.acceptedByMembershipId ?? null,
  };
}

export function createSupabaseThinkingRoomRepository(
  client: SupabaseThinkingRoomClient,
): ThinkingRoomRepository {
  async function loadCanonical(organizationId: string, roomId: string) {
    uuid.parse(organizationId);
    uuid.parse(roomId);
    const loadRoomRow = async () => {
      const roomQuery = client.from("thinking_rooms") as RoomLoadQuery;
      const roomResult = await roomQuery
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", roomId)
        .maybeSingle();
      if (roomResult.error) throw new Error(roomResult.error.message);
      return roomResult.data ? roomRowSchema.parse(roomResult.data) : null;
    };
    const child = async (table: string, order: string) => {
      const query = client.from(table) as ChildLoadQuery;
      const result = await query
        .select("*")
        .eq("organization_id", organizationId)
        .eq("room_id", roomId)
        .order(order, { ascending: true });
      if (result.error) throw new Error(result.error.message);
      return z.array(z.unknown()).parse(result.data);
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const roomBefore = await loadRoomRow();
      if (!roomBefore) return null;
      const [contributionRows, reactionRows, linkRows, synthesisRows, contentOriginRows] = await Promise.all([
        child("thinking_contributions", "created_at"),
        child("thinking_contribution_reactions", "created_at"),
        child("thinking_contribution_links", "created_at"),
        child("thinking_synthesis_revisions", "number"),
        child("thinking_room_content_origins", "created_at"),
      ]);
      const roomAfter = await loadRoomRow();
      if (!roomAfter) return null;
      if (roomBefore.revision === roomAfter.revision) {
        return parseThinkingRoomAggregate({
          room: roomFromRow(roomAfter),
          contributions: contributionRows.map(contributionFromRow),
          reactions: reactionRows.map(reactionFromRow),
          links: linkRows.map(linkFromRow),
          synthesisRevisions: synthesisRows.map(synthesisFromRow),
          contentOrigins: contentOriginRows.map(contentOriginFromRow),
        });
      }
    }
    throw new ThinkingRoomRevisionConflictError();
  }

  async function persist(expectedRevision: number, input: unknown) {
    const aggregate = parseThinkingRoomAggregate(input);
    const { data, error } = await client.rpc("save_thinking_room", {
      p_organization_id: aggregate.room.organizationId,
      p_room_id: aggregate.room.id,
      p_expected_revision: z.number().int().nonnegative().parse(expectedRevision),
      p_room: roomRpcPayload(aggregate.room),
      p_contributions: aggregate.contributions.map(contributionRpcPayload),
      p_reactions: aggregate.reactions.map(reactionRpcPayload),
      p_links: aggregate.links.map(linkRpcPayload),
      p_synthesis_revisions: aggregate.synthesisRevisions.map(synthesisRpcPayload),
    });
    if (error?.code === "40001" || error?.message.includes("revision conflict")) {
      throw new ThinkingRoomRevisionConflictError();
    }
    if (error?.code === "23514" || error?.code === "22001") {
      throw new ThinkingRoomValidationError();
    }
    if (error?.code === "42501") throw new ThinkingRoomPermissionError();
    if (error?.code === "23503") throw new ThinkingRoomNotFoundError();
    if (error) throw new Error(error.message);
    z.number().int().positive().parse(data);
    const canonical = await loadCanonical(
      aggregate.room.organizationId,
      aggregate.room.id,
    );
    if (!canonical) throw new ThinkingRoomNotFoundError();
    return canonical;
  }

  return {
    async list(organizationId) {
      uuid.parse(organizationId);
      const query = client.from("thinking_rooms") as RoomListQuery;
      const { data, error } = await query
        .select("*")
        .eq("organization_id", organizationId)
        .order("updated_at", { ascending: false });
      if (error?.code === "42501") throw new ThinkingRoomPermissionError();
      if (error?.code === "23503") throw new ThinkingRoomNotFoundError();
      if (error?.code === "23514" || error?.code === "22001") {
        throw new ThinkingRoomValidationError();
      }
      if (error) throw new Error(error.message);
      return z.array(z.unknown()).parse(data).map(roomFromRow);
    },

    load(organizationId, roomId) {
      return loadCanonical(organizationId, roomId);
    },

    create(aggregate) {
      return persist(0, aggregate);
    },

    save(input) {
      return persist(input.expectedRevision, input.aggregate);
    },

    async setReaction(input) {
      uuid.parse(input.organizationId);
      uuid.parse(input.roomId);
      uuid.parse(input.contributionId);
      uuid.parse(input.reactionId);
      const kind = contributionReactionSchema.shape.kind.parse(input.kind);
      const { data, error } = await client.rpc("set_thinking_room_reaction", {
        p_organization_id: input.organizationId,
        p_room_id: input.roomId,
        p_contribution_id: input.contributionId,
        p_kind: kind,
        p_active: z.boolean().parse(input.active),
        p_reaction_id: input.reactionId,
      });
      if (error?.code === "42501") throw new ThinkingRoomPermissionError();
      if (error?.code === "23503") throw new ThinkingRoomNotFoundError();
      if (error?.code === "23514" || error?.code === "22001") {
        throw new ThinkingRoomValidationError();
      }
      if (error) throw new Error(error.message);
      const result = z.object({
        room_revision: z.number().int().positive(),
        reaction: z.object({
          id: z.uuid(),
          room_id: z.uuid(),
          contribution_id: z.uuid(),
          actor_user_id: z.uuid(),
          kind: contributionReactionSchema.shape.kind,
          created_at: z.iso.datetime(),
        }).nullable(),
      }).parse(data);
      return {
        roomRevision: result.room_revision,
        reaction: result.reaction ? contributionReactionSchema.parse({
          id: result.reaction.id,
          roomId: result.reaction.room_id,
          contributionId: result.reaction.contribution_id,
          membershipId: result.reaction.actor_user_id,
          kind: result.reaction.kind,
          createdAt: result.reaction.created_at,
        }) : null,
      };
    },

    async convert(input) {
      uuid.parse(input.organizationId);
      uuid.parse(input.roomId);
      uuid.parse(input.synthesisRevisionId);
      uuid.parse(input.ideaId);
      const { data, error } = await client.rpc("convert_thinking_room", {
        p_organization_id: input.organizationId,
        p_room_id: input.roomId,
        p_synthesis_revision_id: input.synthesisRevisionId,
        p_idea_id: input.ideaId,
        p_expected_revision: z.number().int().positive().parse(input.expectedRevision),
      });
      if (error?.code === "40001" || error?.message.includes("revision conflict")) {
        throw new ThinkingRoomRevisionConflictError();
      }
      if (error?.code === "42501") throw new ThinkingRoomPermissionError();
      if (error?.code === "23503") throw new ThinkingRoomNotFoundError();
      if (error?.code === "23514" || error?.code === "22001") {
        throw new ThinkingRoomValidationError();
      }
      if (error) throw new Error(error.message);
      const result = z.object({
        room_id: z.uuid(),
        synthesis_revision_id: z.uuid(),
        idea_id: z.uuid(),
        created_by_user_id: z.uuid(),
        created_at: z.iso.datetime(),
        room_revision: z.number().int().positive(),
      }).parse(data);
      return {
        origin: thinkingRoomContentOriginSchema.parse({
          roomId: result.room_id,
          synthesisRevisionId: result.synthesis_revision_id,
          ideaId: result.idea_id,
          createdByMembershipId: result.created_by_user_id,
          createdAt: result.created_at,
        }),
        roomRevision: result.room_revision,
      };
    },
  };
}

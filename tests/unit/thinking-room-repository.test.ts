import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseThinkingRoomRepository,
  ThinkingRoomRevisionConflictError,
  ThinkingRoomValidationError,
} from "@/lib/thinking-rooms/repository";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const roomId = "243e5423-b7f9-46f7-9026-b08b175466da";
const ownerId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
const editorId = "18d5379e-91c2-46f3-8b23-019df6f04ea7";
const contributionId = "5b5b7c4f-3f88-402f-8ebf-e81880d662d4";
const reactionId = "4186b21d-5ff5-4f45-b5d7-c3a0a1159930";
const synthesisId = "30a1db3f-c5b5-46b3-b7fc-3a315d3b6e0d";
const linkId = "a98138f4-3461-4ab2-bdec-b09d8769fbe2";
const ideaId = "dc0164bd-0e71-4de4-988d-d821c7271540";
const createdAt = "2026-07-16T09:00:00.000Z";

const contentOriginRow = {
  organization_id: organizationId,
  room_id: roomId,
  synthesis_revision_id: synthesisId,
  idea_id: ideaId,
  created_by_user_id: ownerId,
  created_at: createdAt,
};

const roomRow = {
  id: roomId,
  organization_id: organizationId,
  workspace_id: "creator-workspace",
  question: "Which tension should anchor our next series?",
  template_id: "content-direction",
  status: "exploring",
  facilitator_user_id: ownerId,
  decision_owner_user_id: ownerId,
  context: "Independent creators",
  decision_due_at: null,
  revision: 1,
  created_at: createdAt,
  updated_at: createdAt,
  archived_at: null,
};

const contributionRow = {
  id: contributionId,
  organization_id: organizationId,
  room_id: roomId,
  lens: "evidence",
  body: "Three recent comments repeat the same concern.",
  author_user_id: ownerId,
  author_display_name_snapshot: "Maya Chen",
  source_reference_id: "https://example.com/evidence",
  mentioned_user_id: undefined,
  related_contribution_id: undefined,
  revision: 1,
  created_at: createdAt,
  updated_at: createdAt,
  deleted_at: undefined,
};

const reactionRow = {
  id: reactionId,
  organization_id: organizationId,
  room_id: roomId,
  contribution_id: contributionId,
  actor_user_id: ownerId,
  kind: "promising",
  created_at: createdAt,
};

const linkRow = {
  id: linkId,
  organization_id: organizationId,
  room_id: roomId,
  from_contribution_id: contributionId,
  to_contribution_id: contributionId,
  relationship: "challenges",
  created_by_user_id: ownerId,
  resolution_status: "resolved",
  resolution_note: "The evidence now covers the concern.",
  resolved_by_user_id: ownerId,
  created_at: createdAt,
  resolved_at: createdAt,
};

const synthesisRow = {
  id: synthesisId,
  organization_id: organizationId,
  room_id: roomId,
  number: 1,
  belief: "Useful constraints create recognition.",
  unknowns: ["How much repetition is useful?"],
  confidence: "medium",
  chosen_direction: {
    title: "Make the trade-off visible",
    audienceTension: "Creators want consistency without repetition.",
    angle: "Show constraints as a creative advantage.",
    evidenceReferenceIds: ["source-1"],
    basis: "evidence" as const,
  },
  open_challenge_ids: [],
  source_contribution_ids: [contributionId],
  created_by_user_id: ownerId,
  generation_provenance: { kind: "human" },
  status: "draft",
  created_at: createdAt,
  accepted_at: undefined,
  accepted_by_user_id: undefined,
};

function aggregate(contentOrigins: Array<{
  roomId: string;
  synthesisRevisionId: string;
  ideaId: string;
  createdByMembershipId: string;
  createdAt: string;
}> = []) {
  return {
    room: {
      id: roomId,
      organizationId,
      workspaceId: "creator-workspace",
      question: "Which tension should anchor our next series?",
      templateId: "content-direction",
      status: "exploring" as const,
      facilitatorMembershipId: ownerId,
      decisionOwnerMembershipId: ownerId,
      context: "Independent creators",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    },
    contributions: [
      {
        id: contributionId,
        roomId,
        lens: "evidence" as const,
        body: "Three recent comments repeat the same concern.",
        authorMembershipId: ownerId,
        authorDisplayNameSnapshot: "Maya Chen",
        sourceReferenceId: "https://example.com/evidence",
        revision: 1,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    reactions: [
      {
        id: reactionId,
        roomId,
        contributionId,
        membershipId: ownerId,
        kind: "promising" as const,
        createdAt,
      },
    ],
    links: [{
      id: linkId,
      roomId,
      fromContributionId: contributionId,
      toContributionId: contributionId,
      relationship: "challenges" as const,
      createdByMembershipId: ownerId,
      resolutionStatus: "resolved" as const,
      resolutionNote: "The evidence now covers the concern.",
      resolvedByMembershipId: ownerId,
      createdAt,
      resolvedAt: createdAt,
    }],
    synthesisRevisions: [
      {
        id: synthesisId,
        roomId,
        number: 1,
        belief: "Useful constraints create recognition.",
        unknowns: ["How much repetition is useful?"],
        confidence: "medium" as const,
        chosenDirection: synthesisRow.chosen_direction,
        openChallengeIds: [],
        sourceContributionIds: [contributionId],
        createdByMembershipId: ownerId,
        generationProvenance: { kind: "human" as const },
        status: "draft" as const,
        createdAt,
      },
    ],
    contentOrigins,
  };
}

function listBuilder(rows: unknown[]) {
  const order = vi.fn(async () => ({ data: rows, error: null }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { select, eq, order };
}

function loadBuilder(row: unknown) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const secondEq = vi.fn(() => ({ maybeSingle }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  return { select, firstEq, secondEq, maybeSingle };
}

function childBuilder(rows: unknown[], orderColumn: string) {
  const order = vi.fn(async () => ({ data: rows, error: null }));
  const secondEq = vi.fn(() => ({ order }));
  const firstEq = vi.fn(() => ({ eq: secondEq }));
  const select = vi.fn(() => ({ eq: firstEq }));
  return { select, firstEq, secondEq, order, orderColumn };
}

describe("Thinking Room repository", () => {
  it("lists only rooms in the requested organization and validates each row", async () => {
    const rooms = listBuilder([roomRow]);
    const from = vi.fn(() => rooms);
    const repository = createSupabaseThinkingRoomRepository({ from, rpc: vi.fn() });

    await expect(repository.list(organizationId)).resolves.toEqual([
      expect.objectContaining({ id: roomId, organizationId, facilitatorMembershipId: ownerId }),
    ]);
    expect(from).toHaveBeenCalledWith("thinking_rooms");
    expect(rooms.eq).toHaveBeenCalledWith("organization_id", organizationId);
  });

  it("loads one normalized room aggregate without reading workspace snapshots", async () => {
    const room = loadBuilder(roomRow);
    const contributions = childBuilder([contributionRow], "created_at");
    const reactions = childBuilder([reactionRow], "created_at");
    const links = childBuilder([linkRow], "created_at");
    const syntheses = childBuilder([synthesisRow], "number");
    const origins = childBuilder([contentOriginRow], "created_at");
    const from = vi.fn((table: string) => ({
      thinking_rooms: room,
      thinking_contributions: contributions,
      thinking_contribution_reactions: reactions,
      thinking_contribution_links: links,
      thinking_synthesis_revisions: syntheses,
      thinking_room_content_origins: origins,
    })[table]);
    const repository = createSupabaseThinkingRoomRepository({ from, rpc: vi.fn() });

    await expect(repository.load(organizationId, roomId)).resolves.toEqual(aggregate([{
      roomId,
      synthesisRevisionId: synthesisId,
      ideaId,
      createdByMembershipId: ownerId,
      createdAt,
    }]));
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "thinking_rooms",
      "thinking_contributions",
      "thinking_contribution_reactions",
      "thinking_contribution_links",
      "thinking_synthesis_revisions",
      "thinking_room_content_origins",
      "thinking_rooms",
    ]);
    expect(from).not.toHaveBeenCalledWith("workspace_snapshots");
  });

  it("retries a torn aggregate read when the room revision changes during child loads", async () => {
    const revisedRoomRow = {
      ...roomRow,
      revision: 2,
      updated_at: "2026-07-16T10:00:00.000Z",
    };
    const roomReads = [roomRow, revisedRoomRow, revisedRoomRow, revisedRoomRow];
    const maybeSingle = vi.fn(async () => ({
      data: roomReads.shift(),
      error: null,
    }));
    const roomSecondEq = vi.fn(() => ({ maybeSingle }));
    const roomFirstEq = vi.fn(() => ({ eq: roomSecondEq }));
    const roomSelect = vi.fn(() => ({ eq: roomFirstEq }));
    const contributions = childBuilder([], "created_at");
    const contributionOrder = vi
      .fn()
      .mockResolvedValueOnce({ data: [contributionRow], error: null })
      .mockResolvedValueOnce({
        data: [{
          ...contributionRow,
          body: "The updated evidence belongs to room revision two.",
          revision: 2,
          updated_at: "2026-07-16T10:00:00.000Z",
        }],
        error: null,
      });
    contributions.secondEq.mockImplementation(() => ({ order: contributionOrder }));
    const reactions = childBuilder([], "created_at");
    const links = childBuilder([], "created_at");
    const syntheses = childBuilder([], "number");
    const from = vi.fn((table: string) => ({
      thinking_rooms: { select: roomSelect },
      thinking_contributions: contributions,
      thinking_contribution_reactions: reactions,
      thinking_contribution_links: links,
      thinking_synthesis_revisions: syntheses,
      thinking_room_content_origins: childBuilder([], "created_at"),
    })[table]);
    const repository = createSupabaseThinkingRoomRepository({ from, rpc: vi.fn() });

    await expect(repository.load(organizationId, roomId)).resolves.toMatchObject({
      room: { revision: 2 },
      contributions: [{
        revision: 2,
        body: "The updated evidence belongs to room revision two.",
      }],
    });
    expect(contributionOrder).toHaveBeenCalledTimes(2);
    expect(maybeSingle).toHaveBeenCalledTimes(4);
  });

  it("creates and saves one validated room through room-scoped compare-and-swap", async () => {
    const rpc = vi.fn(async () => ({ data: 2, error: null }));
    const roomReads = [
      { ...roomRow, revision: 2 },
      { ...roomRow, revision: 2 },
      { ...roomRow, revision: 2, facilitator_user_id: editorId },
      { ...roomRow, revision: 2, facilitator_user_id: editorId },
    ];
    const maybeSingle = vi.fn(async () => ({ data: roomReads.shift(), error: null }));
    const secondEq = vi.fn(() => ({ maybeSingle }));
    const firstEq = vi.fn(() => ({ eq: secondEq }));
    const roomSelect = vi.fn(() => ({ eq: firstEq }));
    const children = {
      thinking_contributions: childBuilder([contributionRow], "created_at"),
      thinking_contribution_reactions: childBuilder([reactionRow], "created_at"),
      thinking_contribution_links: childBuilder([linkRow], "created_at"),
      thinking_synthesis_revisions: childBuilder([synthesisRow], "number"),
      thinking_room_content_origins: childBuilder([], "created_at"),
    };
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn((table: string) => table === "thinking_rooms"
        ? { select: roomSelect }
        : children[table as keyof typeof children]),
      rpc,
    });
    const value = aggregate();

    await expect(repository.create(value)).resolves.toEqual({ ...value, room: { ...value.room, revision: 2 } });
    expect(rpc).toHaveBeenNthCalledWith(1, "save_thinking_room", expect.objectContaining({
      p_organization_id: organizationId,
      p_room_id: roomId,
      p_expected_revision: 0,
      p_contributions: [expect.objectContaining({ author_user_id: ownerId })],
      p_links: [expect.objectContaining({ created_by_user_id: ownerId })],
    }));

    const reassigned = {
      ...value,
      room: { ...value.room, facilitatorMembershipId: editorId },
    };
    await expect(repository.save({ expectedRevision: 1, aggregate: reassigned }))
      .resolves.toEqual({ ...reassigned, room: { ...reassigned.room, revision: 2 } });
    expect(rpc).toHaveBeenNthCalledWith(2, "save_thinking_room", expect.objectContaining({
      p_expected_revision: 1,
      p_room: expect.objectContaining({ facilitator_user_id: editorId }),
      p_reactions: [expect.objectContaining({ actor_user_id: ownerId })],
      p_synthesis_revisions: [expect.objectContaining({ created_by_user_id: ownerId })],
    }));
  });

  it("reloads the canonical SQL resolution timestamp before returning and re-saving", async () => {
    const clientResolvedAt = "2026-07-16T10:00:00.000Z";
    const serverResolvedAt = "2026-07-16T10:00:00.321Z";
    const roomReads = [2, 2, 3, 3];
    const maybeSingle = vi.fn(async () => ({
      data: { ...roomRow, revision: roomReads.shift() ?? 3 },
      error: null,
    }));
    const roomSecondEq = vi.fn(() => ({ maybeSingle }));
    const roomFirstEq = vi.fn(() => ({ eq: roomSecondEq }));
    const roomSelect = vi.fn(() => ({ eq: roomFirstEq }));
    const children = {
      thinking_contributions: childBuilder([contributionRow], "created_at"),
      thinking_contribution_reactions: childBuilder([reactionRow], "created_at"),
      thinking_contribution_links: childBuilder([{
        ...linkRow,
        resolved_at: serverResolvedAt,
      }], "created_at"),
      thinking_synthesis_revisions: childBuilder([synthesisRow], "number"),
      thinking_room_content_origins: childBuilder([], "created_at"),
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 3, error: null });
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn((table: string) => table === "thinking_rooms"
        ? { select: roomSelect }
        : children[table as keyof typeof children]),
      rpc,
    });
    const submitted = aggregate();
    submitted.links[0] = { ...submitted.links[0], resolvedAt: clientResolvedAt };

    const canonical = await repository.save({ expectedRevision: 1, aggregate: submitted });
    expect(canonical.links[0].resolvedAt).toBe(serverResolvedAt);

    await expect(repository.save({ expectedRevision: 2, aggregate: canonical }))
      .resolves.toMatchObject({ room: { revision: 3 } });
    expect(rpc).toHaveBeenNthCalledWith(2, "save_thinking_room", expect.objectContaining({
      p_expected_revision: 2,
      p_links: [expect.objectContaining({ resolved_at: serverResolvedAt })],
    }));
  });

  it("mutates one authenticated actor reaction through the narrow room RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        room_revision: 2,
        reaction: {
          id: reactionId,
          room_id: roomId,
          contribution_id: contributionId,
          actor_user_id: editorId,
          kind: "agree",
          created_at: createdAt,
        },
      },
      error: null,
    }));
    const repository = createSupabaseThinkingRoomRepository({ from: vi.fn(), rpc });

    await expect(repository.setReaction({
      organizationId,
      roomId,
      contributionId,
      kind: "agree",
      active: true,
      reactionId,
    })).resolves.toEqual({
      roomRevision: 2,
      reaction: expect.objectContaining({
        id: reactionId,
        membershipId: editorId,
      }),
    });
    expect(rpc).toHaveBeenCalledWith("set_thinking_room_reaction", {
      p_organization_id: organizationId,
      p_room_id: roomId,
      p_contribution_id: contributionId,
      p_kind: "agree",
      p_active: true,
      p_reaction_id: reactionId,
    });
  });

  it("converts one accepted synthesis through an authoritative idempotent RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        room_id: roomId,
        synthesis_revision_id: synthesisId,
        idea_id: ideaId,
        created_by_user_id: editorId,
        created_at: createdAt,
        room_revision: 4,
      },
      error: null,
    }));
    const repository = createSupabaseThinkingRoomRepository({ from: vi.fn(), rpc });

    const conversion = await repository.convert({
      organizationId,
      roomId,
      synthesisRevisionId: synthesisId,
      ideaId,
      expectedRevision: 3,
    });

    expect(conversion).toEqual({
      origin: {
        roomId,
        synthesisRevisionId: synthesisId,
        ideaId,
        createdByMembershipId: editorId,
        createdAt,
      },
      roomRevision: 4,
    });
    expect(rpc).toHaveBeenCalledWith("convert_thinking_room", {
      p_organization_id: organizationId,
      p_room_id: roomId,
      p_synthesis_revision_id: synthesisId,
      p_idea_id: ideaId,
      p_expected_revision: 3,
    });
  });

  it("preserves the first actor's conversion across a stale second-actor retry, then enforces revocation", async () => {
    // Faithful in-memory convert_thinking_room model; runtime Postgres execution is external.
    const actorAId = ownerId;
    const actorBId = editorId;
    const actorAIdeaId = ideaId;
    const actorBIdeaId = "df79dc2f-a38c-43a9-b398-a8322d72c4a3";
    let actorId = actorAId;
    let roomRevision = 3;
    let origin: typeof contentOriginRow | undefined;
    const authorizedActors = new Set([actorAId, actorBId]);
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("convert_thinking_room");
      if (!authorizedActors.has(actorId)) {
        return { data: null, error: { code: "42501", message: "membership revoked" } };
      }
      if (origin) {
        return { data: { ...origin, room_revision: roomRevision }, error: null };
      }
      if (args.p_expected_revision !== roomRevision) {
        return { data: null, error: { code: "40001", message: "thinking room revision conflict" } };
      }
      origin = {
        ...contentOriginRow,
        idea_id: String(args.p_idea_id),
        created_by_user_id: actorId,
      };
      roomRevision += 1;
      return { data: { ...origin, room_revision: roomRevision }, error: null };
    });
    const repository = createSupabaseThinkingRoomRepository({ from: vi.fn(), rpc });

    const actorAConversion = await repository.convert({
      organizationId,
      roomId,
      synthesisRevisionId: synthesisId,
      ideaId: actorAIdeaId,
      expectedRevision: 3,
    });
    expect(actorAConversion).toMatchObject({
      origin: { ideaId: actorAIdeaId, createdByMembershipId: actorAId },
      roomRevision: 4,
    });

    actorId = actorBId;
    const actorBStaleRetry = await repository.convert({
      organizationId,
      roomId,
      synthesisRevisionId: synthesisId,
      ideaId: actorBIdeaId,
      expectedRevision: 3,
    });
    expect(actorBStaleRetry).toEqual(actorAConversion);

    authorizedActors.delete(actorBId);
    await expect(repository.convert({
      organizationId,
      roomId,
      synthesisRevisionId: synthesisId,
      ideaId: actorBIdeaId,
      expectedRevision: 3,
    })).rejects.toMatchObject({
      name: "ThinkingRoomPermissionError",
    });
  });

  it("maps stale Postgres saves to a recoverable room revision conflict", async () => {
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "40001", message: "thinking room revision conflict" },
      })),
    });

    await expect(repository.save({ expectedRevision: 1, aggregate: aggregate() }))
      .rejects.toBeInstanceOf(ThinkingRoomRevisionConflictError);
  });

  it("maps Postgres check failures to a client-correctable validation error", async () => {
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "23514", message: "violates check constraint" },
      })),
    });

    await expect(repository.save({ expectedRevision: 1, aggregate: aggregate() }))
      .rejects.toBeInstanceOf(ThinkingRoomValidationError);
  });

  it("mirrors database limits for room, contribution, and synthesis text", async () => {
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn(),
      rpc: vi.fn(),
    });
    const value = aggregate();

    await expect(repository.create({
      ...value,
      room: { ...value.room, question: "q".repeat(2001) },
    })).rejects.toThrow();
    await expect(repository.create({
      ...value,
      contributions: [{ ...value.contributions[0], body: "b".repeat(20001) }],
    })).rejects.toThrow();
    await expect(repository.create({
      ...value,
      synthesisRevisions: [{
        ...value.synthesisRevisions[0],
        belief: "s".repeat(20001),
      }],
    })).rejects.toThrow();
  });

  it("rejects malformed database rows instead of leaking them into the domain", async () => {
    const rooms = listBuilder([{ ...roomRow, facilitator_user_id: "member-owner" }]);
    const repository = createSupabaseThinkingRoomRepository({
      from: vi.fn(() => rooms),
      rpc: vi.fn(),
    });

    await expect(repository.list(organizationId)).rejects.toThrow();
  });
});

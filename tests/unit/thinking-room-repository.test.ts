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
const createdAt = "2026-07-16T09:00:00.000Z";

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
  source_reference_id: undefined,
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

function aggregate() {
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
    const syntheses = childBuilder([synthesisRow], "number");
    const from = vi.fn((table: string) => ({
      thinking_rooms: room,
      thinking_contributions: contributions,
      thinking_contribution_reactions: reactions,
      thinking_synthesis_revisions: syntheses,
    })[table]);
    const repository = createSupabaseThinkingRoomRepository({ from, rpc: vi.fn() });

    await expect(repository.load(organizationId, roomId)).resolves.toEqual(aggregate());
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "thinking_rooms",
      "thinking_contributions",
      "thinking_contribution_reactions",
      "thinking_synthesis_revisions",
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
    const syntheses = childBuilder([], "number");
    const from = vi.fn((table: string) => ({
      thinking_rooms: { select: roomSelect },
      thinking_contributions: contributions,
      thinking_contribution_reactions: reactions,
      thinking_synthesis_revisions: syntheses,
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
    const repository = createSupabaseThinkingRoomRepository({ from: vi.fn(), rpc });
    const value = aggregate();

    await expect(repository.create(value)).resolves.toEqual({ ...value, room: { ...value.room, revision: 2 } });
    expect(rpc).toHaveBeenNthCalledWith(1, "save_thinking_room", expect.objectContaining({
      p_organization_id: organizationId,
      p_room_id: roomId,
      p_expected_revision: 0,
      p_contributions: [expect.objectContaining({ author_user_id: ownerId })],
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

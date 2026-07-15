import { describe, expect, it } from "vitest";

import {
  addThinkingContribution,
  createSynthesisRevision,
  createThinkingRoom,
  roomCanConvert,
  thinkingLensSchema,
  thinkingRoomStateSchema,
  toggleContributionReaction,
  updateThinkingRoomState,
  type ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";

const CREATED_AT = "2026-07-16T09:00:00.000Z";
const UPDATED_AT = "2026-07-16T10:00:00.000Z";

function createRoom() {
  return createThinkingRoom(
    {
      organizationId: "org-1",
      workspaceId: "workspace-1",
      question: "  Which tension should anchor our next series?  ",
      templateId: "content-direction",
      facilitatorMembershipId: "member-1",
      decisionOwnerMembershipId: "member-1",
      context: "A series for independent creators",
    },
    { id: "room-1", at: CREATED_AT },
  );
}

const chosenDirection = {
  title: "Make the hidden trade-off visible",
  audienceTension: "Creators want consistency without becoming repetitive.",
  angle: "Show how constraints can create a recognizable series.",
  keyChallenge: "The advice can sound too rigid.",
  evidenceReferenceIds: ["source-1"],
  basis: "evidence" as const,
};

describe("Thinking Room schemas", () => {
  it("parses only the supported room states", () => {
    expect(
      ["exploring", "synthesizing", "decided", "converted", "archived"].map(
        (state) => thinkingRoomStateSchema.parse(state),
      ),
    ).toEqual([
      "exploring",
      "synthesizing",
      "decided",
      "converted",
      "archived",
    ]);
    expect(thinkingRoomStateSchema.safeParse("active").success).toBe(false);
  });

  it("parses only the four guided lenses", () => {
    expect(
      ["audience_tensions", "evidence", "challenges", "possibilities"].map(
        (lens) => thinkingLensSchema.parse(lens),
      ),
    ).toEqual([
      "audience_tensions",
      "evidence",
      "challenges",
      "possibilities",
    ]);
    expect(thinkingLensSchema.safeParse("ideas").success).toBe(false);
  });
});

describe("createThinkingRoom", () => {
  it("creates an exploring room with deterministic identity and timestamps", () => {
    const room = createRoom();

    expect(room).toMatchObject({
      id: "room-1",
      question: "Which tension should anchor our next series?",
      status: "exploring",
      revision: 1,
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
  });

  it("rejects a blank strategic question", () => {
    expect(() =>
      createThinkingRoom(
        {
          organizationId: "org-1",
          workspaceId: "workspace-1",
          question: "   ",
          templateId: "content-direction",
          facilitatorMembershipId: "member-1",
        },
        { id: "room-1", at: CREATED_AT },
      ),
    ).toThrow();
  });
});

describe("addThinkingContribution", () => {
  it("creates one attributed, revisioned thought without mutating the room", () => {
    const room = createRoom();
    const contribution = addThinkingContribution(
      {
        roomId: room.id,
        lens: "evidence",
        body: "  Three recent comments ask how to stay consistent.  ",
        authorMembershipId: "member-2",
        authorDisplayNameSnapshot: "Mira",
        sourceReferenceId: "source-1",
      },
      { id: "contribution-1", at: CREATED_AT },
    );

    expect(contribution).toEqual({
      id: "contribution-1",
      roomId: "room-1",
      lens: "evidence",
      body: "Three recent comments ask how to stay consistent.",
      authorMembershipId: "member-2",
      authorDisplayNameSnapshot: "Mira",
      sourceReferenceId: "source-1",
      createdAt: CREATED_AT,
      updatedAt: CREATED_AT,
      revision: 1,
    });
    expect(room.revision).toBe(1);
  });

  it("rejects a blank contribution body", () => {
    expect(() =>
      addThinkingContribution(
        {
          roomId: "room-1",
          lens: "challenges",
          body: "\n\t",
          authorMembershipId: "member-2",
          authorDisplayNameSnapshot: "Mira",
        },
        { id: "contribution-1", at: CREATED_AT },
      ),
    ).toThrow();
  });
});

describe("toggleContributionReaction", () => {
  it("keeps at most one active reaction of a kind per actor and contribution", () => {
    const added = toggleContributionReaction(
      [],
      {
        roomId: "room-1",
        contributionId: "contribution-1",
        membershipId: "member-2",
        kind: "promising",
      },
      { id: "reaction-1", at: CREATED_AT },
    );

    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      id: "reaction-1",
      membershipId: "member-2",
      kind: "promising",
      createdAt: CREATED_AT,
    });

    const removed = toggleContributionReaction(
      added,
      {
        roomId: "room-1",
        contributionId: "contribution-1",
        membershipId: "member-2",
        kind: "promising",
      },
      { id: "unused-reaction", at: UPDATED_AT },
    );

    expect(removed).toEqual([]);
    expect(added).toHaveLength(1);
  });
});

describe("createSynthesisRevision", () => {
  const firstInput = {
    roomId: "room-1",
    belief: "Constraints can make a series more recognizable.",
    unknowns: ["How much repetition is useful?"],
    confidence: "medium" as const,
    chosenDirection,
    openChallengeIds: ["contribution-3"],
    sourceContributionIds: ["contribution-1", "contribution-2"],
    createdByMembershipId: "member-1",
  };

  it("numbers deterministic revisions without changing the prior revision", () => {
    const first = createSynthesisRevision([], firstInput, {
      id: "synthesis-1",
      at: CREATED_AT,
    });
    const snapshot = structuredClone(first);

    const second = createSynthesisRevision(
      [first],
      {
        ...firstInput,
        belief: "A constraint-led series earns recognition through useful repetition.",
        baseRevisionId: first.id,
      },
      { id: "synthesis-2", at: UPDATED_AT },
    );

    expect(first).toEqual(snapshot);
    expect(first.number).toBe(1);
    expect(second).toMatchObject({
      id: "synthesis-2",
      number: 2,
      status: "draft",
      createdAt: UPDATED_AT,
    });
  });

  it("rejects an edit based on anything except the current revision", () => {
    const first = createSynthesisRevision([], firstInput, {
      id: "synthesis-1",
      at: CREATED_AT,
    });
    const second = createSynthesisRevision(
      [first],
      { ...firstInput, baseRevisionId: first.id },
      { id: "synthesis-2", at: UPDATED_AT },
    );

    expect(() =>
      createSynthesisRevision(
        [first, second],
        { ...firstInput, baseRevisionId: first.id },
        { id: "synthesis-3", at: "2026-07-16T11:00:00.000Z" },
      ),
    ).toThrow("Synthesis revision is stale");
  });
});

describe("updateThinkingRoomState", () => {
  it("enforces exploring to synthesizing to decided to converted", () => {
    const room = createRoom();
    const synthesizing = updateThinkingRoomState(room, "synthesizing", {
      at: "2026-07-16T09:15:00.000Z",
      expectedRevision: 1,
    });
    const decided = updateThinkingRoomState(synthesizing, "decided", {
      at: "2026-07-16T09:30:00.000Z",
      expectedRevision: 2,
    });
    const converted = updateThinkingRoomState(decided, "converted", {
      at: UPDATED_AT,
      expectedRevision: 3,
    });

    expect([room.status, synthesizing.status, decided.status, converted.status]).toEqual([
      "exploring",
      "synthesizing",
      "decided",
      "converted",
    ]);
    expect(converted.revision).toBe(4);
    expect(converted.updatedAt).toBe(UPDATED_AT);
    expect(room.status).toBe("exploring");
  });

  it("rejects skipped lifecycle steps and stale room revisions", () => {
    const room = createRoom();

    expect(() =>
      updateThinkingRoomState(room, "decided", {
        at: UPDATED_AT,
        expectedRevision: 1,
      }),
    ).toThrow("Cannot move a Thinking Room from exploring to decided");
    expect(() =>
      updateThinkingRoomState(room, "synthesizing", {
        at: UPDATED_AT,
        expectedRevision: 0,
      }),
    ).toThrow("Thinking Room revision is stale");
  });
});

describe("roomCanConvert", () => {
  it("requires a decided room, decision owner, and accepted grounded direction", () => {
    const room = updateThinkingRoomState(
      updateThinkingRoomState(createRoom(), "synthesizing", {
        at: "2026-07-16T09:15:00.000Z",
        expectedRevision: 1,
      }),
      "decided",
      { at: "2026-07-16T09:30:00.000Z", expectedRevision: 2 },
    );
    const accepted: ThinkingSynthesisRevision = createSynthesisRevision(
      [],
      {
        roomId: room.id,
        belief: "Constraints can make a series more recognizable.",
        unknowns: [],
        confidence: "high",
        chosenDirection,
        openChallengeIds: [],
        sourceContributionIds: ["contribution-1"],
        createdByMembershipId: "member-1",
        status: "accepted",
        acceptedByMembershipId: "member-1",
      },
      { id: "synthesis-1", at: UPDATED_AT },
    );

    expect(roomCanConvert(room, [accepted])).toBe(true);
    expect(roomCanConvert({ ...room, status: "synthesizing" }, [accepted])).toBe(false);
    expect(roomCanConvert({ ...room, decisionOwnerMembershipId: undefined }, [accepted])).toBe(
      false,
    );
    expect(roomCanConvert(room, [{ ...accepted, status: "draft" }])).toBe(false);
    expect(
      roomCanConvert(room, [
        accepted,
        {
          ...accepted,
          id: "synthesis-2",
          number: 2,
          status: "draft",
          acceptedAt: undefined,
          acceptedByMembershipId: undefined,
        },
      ]),
    ).toBe(false);
  });
});

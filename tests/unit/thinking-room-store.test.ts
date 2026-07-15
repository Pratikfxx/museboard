import { beforeEach, describe, expect, it } from "vitest";

import { createDemoState } from "@/lib/demo/fixtures";
import {
  THINKING_ROOM_STORAGE_KEY,
  useThinkingRoomStore,
} from "@/lib/store/thinking-room-store";
import {
  useMuseboardStore,
  workspacePayloadFromState,
} from "@/lib/store/museboard-store";

const CREATED_AT = "2026-07-16T12:00:00.000Z";

describe("Thinking Room sample store", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
    useThinkingRoomStore.getState().resetSample();
  });

  it("hydrates a plainly labelled sample room using current member snapshots", () => {
    const workspaceMembers = createDemoState().memberships;
    const state = useThinkingRoomStore.getState();
    const room = state.rooms.find(({ id }) => id === state.selectedRoomId);

    expect(room).toMatchObject({
      status: "decided",
      question: expect.stringContaining("Sample"),
      context: expect.stringContaining("sample"),
    });
    expect(
      state.synthesisRevisions.some(
        (revision) => revision.roomId === room?.id && revision.status === "accepted",
      ),
    ).toBe(true);
    expect(state.contributions.filter(({ roomId }) => roomId === room?.id)).not.toHaveLength(0);
    expect(
      state.contributions.every((contribution) =>
        workspaceMembers.some(
          (member) =>
            member.id === contribution.authorMembershipId &&
            member.displayNameSnapshot === contribution.authorDisplayNameSnapshot,
        ),
      ),
    ).toBe(true);
  });

  it("persists only under its own versioned key and never enters workspace payloads", () => {
    const state = useThinkingRoomStore.getState();
    const roomId = state.createRoom(
      {
        organizationId: "org-sample",
        workspaceId: "workspace-sample",
        question: "What should we test next?",
        templateId: "content-direction",
        facilitatorMembershipId: "member-owner",
      },
      CREATED_AT,
    );

    expect(roomId).toBeTruthy();
    const persisted = JSON.parse(localStorage.getItem(THINKING_ROOM_STORAGE_KEY) ?? "null");
    expect(persisted.state.rooms.some(({ id }: { id: string }) => id === roomId)).toBe(true);
    expect(localStorage.getItem("museboard-demo-v1")).not.toContain(roomId);

    const workspacePayload = workspacePayloadFromState(useMuseboardStore.getState());
    expect(workspacePayload).not.toHaveProperty("rooms");
    expect(workspacePayload).not.toHaveProperty("contributions");
    expect(workspacePayload).not.toHaveProperty("synthesisRevisions");
    expect(workspacePayload).not.toHaveProperty("selectedRoomId");
    expect(workspacePayload).not.toHaveProperty("syncState");
  });

  it("supports room, contribution, reaction, synthesis, selection, and sync mutations", () => {
    const state = useThinkingRoomStore.getState();
    const roomId = state.createRoom(
      {
        organizationId: "org-sample",
        workspaceId: "workspace-sample",
        question: "Which audience tension is strongest?",
        templateId: "content-direction",
        facilitatorMembershipId: "member-owner",
        decisionOwnerMembershipId: "member-owner",
      },
      CREATED_AT,
    );
    expect(roomId).toBeTruthy();

    state.selectRoom(roomId);
    const contributionId = state.addContribution(
      {
        roomId: roomId!,
        lens: "evidence",
        body: "Three comments repeat the same concern.",
        authorMembershipId: "member-sam",
        authorDisplayNameSnapshot: "Sam Rivera",
      },
      CREATED_AT,
    );
    expect(contributionId).toBeTruthy();
    expect(
      state.toggleReaction(
        {
          roomId: roomId!,
          contributionId: contributionId!,
          membershipId: "member-owner",
          kind: "promising",
          active: true,
        },
        CREATED_AT,
      ),
    ).toBe(true);
    state.setSyncState("syncing");

    const current = useThinkingRoomStore.getState();
    expect(current.selectedRoomId).toBe(roomId);
    expect(current.contributions.some(({ id }) => id === contributionId)).toBe(true);
    expect(
      current.reactions.some(
        (reaction) =>
          reaction.contributionId === contributionId &&
          reaction.membershipId === "member-owner" &&
          reaction.kind === "promising",
      ),
    ).toBe(true);
    expect(current.syncState).toBe("syncing");
  });

  it("rehydrates an explicitly cleared room selection", async () => {
    const selectedRoomId = useThinkingRoomStore.getState().selectedRoomId;
    const envelope = JSON.parse(
      localStorage.getItem(THINKING_ROOM_STORAGE_KEY) ?? "null",
    );
    delete envelope.state.selectedRoomId;
    localStorage.setItem(THINKING_ROOM_STORAGE_KEY, JSON.stringify(envelope));

    expect(selectedRoomId).toBeTruthy();
    await useThinkingRoomStore.persist.rehydrate();

    expect(useThinkingRoomStore.getState().selectedRoomId).toBeUndefined();
  });
});

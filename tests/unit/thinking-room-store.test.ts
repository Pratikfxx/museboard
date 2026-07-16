import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Membership } from "@/domain/collaboration";
import { createDemoState } from "@/lib/demo/fixtures";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
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
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("resets sample authors from the supplied active memberships", () => {
    const activeMemberships: Membership[] = [
      {
        id: "custom-owner-71",
        email: "anika@example.com",
        displayNameSnapshot: "Anika Rao",
        role: "owner",
        status: "active",
        invitedAt: CREATED_AT,
        joinedAt: CREATED_AT,
      },
      {
        id: "custom-editor-42",
        email: "jo@example.com",
        displayNameSnapshot: "Jo Mercer",
        role: "editor",
        status: "active",
        invitedAt: CREATED_AT,
        joinedAt: CREATED_AT,
      },
    ];

    useThinkingRoomStore.getState().resetSample(activeMemberships);

    const state = useThinkingRoomStore.getState();
    expect(state.rooms[0]).toMatchObject({
      facilitatorMembershipId: "custom-owner-71",
      decisionOwnerMembershipId: "custom-owner-71",
    });
    expect(
      new Set(
        state.contributions.map(
          ({ authorMembershipId }) => authorMembershipId,
        ),
      ),
    ).toEqual(new Set(["custom-owner-71", "custom-editor-42"]));
    expect(
      state.contributions.every((contribution) =>
        activeMemberships.some(
          (member) =>
            member.id === contribution.authorMembershipId &&
            member.displayNameSnapshot === contribution.authorDisplayNameSnapshot,
        ),
      ),
    ).toBe(true);
  });

  it("keeps a membership-aware reset usable in memory when storage is denied", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Storage unavailable", "SecurityError");
      });
    const memberships: Membership[] = [
      {
        id: "offline-owner",
        email: "offline@example.com",
        displayNameSnapshot: "Offline Owner",
        role: "owner",
        status: "active",
        invitedAt: CREATED_AT,
        joinedAt: CREATED_AT,
      },
    ];

    expect(() =>
      useThinkingRoomStore.getState().resetSample(memberships),
    ).not.toThrow();
    expect(useThinkingRoomStore.getState().rooms[0]).toMatchObject({
      facilitatorMembershipId: "offline-owner",
      decisionOwnerMembershipId: "offline-owner",
    });
    expect(
      useThinkingRoomStore
        .getState()
        .contributions.every(
          ({ authorDisplayNameSnapshot }) =>
            authorDisplayNameSnapshot === "Offline Owner",
        ),
    ).toBe(true);

    setItem.mockRestore();
  });

  it("refreshes sample author snapshots when onboarding changes active members", () => {
    const workspace = buildStarterWorkspace({
      outcome: "find_ideas",
      archetype: "music",
      audience: "Independent artists",
      platforms: ["instagram_reels"],
      weeklyCapacityMinutes: 240,
      voice: "Warm and specific",
      boundaries: "No fake urgency",
      firstHook: "The unfinished version is the useful one.",
    });
    workspace.creator.name = "Nila Bose";

    useMuseboardStore.getState().completeOnboarding(workspace);

    const activeMemberships = useMuseboardStore.getState().memberships;
    const contributions = useThinkingRoomStore.getState().contributions;
    expect(activeMemberships).toMatchObject([
      { id: "member-owner", displayNameSnapshot: "Nila Bose" },
    ]);
    expect(
      contributions.every((contribution) =>
        activeMemberships.some(
          (member) =>
            member.id === contribution.authorMembershipId &&
            member.displayNameSnapshot === contribution.authorDisplayNameSnapshot,
        ),
      ),
    ).toBe(true);
    expect(
      new Set(contributions.map(({ authorDisplayNameSnapshot }) => authorDisplayNameSnapshot)),
    ).toEqual(new Set(["Nila Bose"]));
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
        sourceReferenceId: "https://example.com/comments",
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

  it("persists contribution links and attributed challenge resolution", () => {
    const state = useThinkingRoomStore.getState();
    const roomId = state.createRoom({
      organizationId: "org-sample",
      workspaceId: "workspace-sample",
      question: "Which objection changes the direction?",
      templateId: "content-direction",
      facilitatorMembershipId: "member-owner",
    }, CREATED_AT)!;
    const challengeId = state.addContribution({
      roomId,
      lens: "challenges",
      body: "This could flatten the creator's voice.",
      authorMembershipId: "member-owner",
      authorDisplayNameSnapshot: "Maya Chen",
    }, CREATED_AT)!;
    const responseId = state.addContribution({
      roomId,
      lens: "possibilities",
      body: "Vary the proof while retaining only one constraint.",
      authorMembershipId: "member-owner",
      authorDisplayNameSnapshot: "Maya Chen",
    }, CREATED_AT)!;
    const linkId = state.createLink({
      roomId,
      fromContributionId: responseId,
      toContributionId: challengeId,
      relationship: "challenges",
      createdByMembershipId: "member-owner",
    }, CREATED_AT)!;

    expect(state.updateRoomStatus(roomId, "synthesizing", CREATED_AT)).toBe(true);
    expect(state.resolveLink(linkId, "The proof now changes every week.", "member-owner", CREATED_AT)).toBe(true);
    expect(useThinkingRoomStore.getState().links).toContainEqual(expect.objectContaining({
      id: linkId,
      resolutionStatus: "resolved",
      resolutionNote: "The proof now changes every week.",
      resolvedByMembershipId: "member-owner",
      resolvedAt: CREATED_AT,
    }));
  });

  it("rejects content mutations after decision until the room is reopened", () => {
    const state = useThinkingRoomStore.getState();
    const room = state.rooms[0];
    expect(room.status).toBe("decided");
    expect(state.addContribution({
      roomId: room.id,
      lens: "possibilities",
      body: "This must not be appended to a decided room.",
      authorMembershipId: "member-owner",
      authorDisplayNameSnapshot: "Maya Chen",
    }, CREATED_AT)).toBeUndefined();
    expect(state.toggleReaction({
      roomId: room.id,
      contributionId: state.contributions[0].id,
      membershipId: "member-owner",
      kind: "agree",
      active: true,
    }, CREATED_AT)).toBe(false);
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

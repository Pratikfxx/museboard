import { beforeEach, describe, expect, it } from "vitest";

import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";

describe("promoted idea workshop", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("creates three usable hook choices when an idea is promoted", () => {
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
    useMuseboardStore.getState().completeOnboarding(workspace);

    const opportunityId = workspace.opportunities[1].id;
    const ideaId = useMuseboardStore.getState().shapeOpportunity(opportunityId);
    expect(ideaId).toBeTruthy();

    const contentId = useMuseboardStore.getState().promoteIdea(ideaId!);
    expect(contentId).toBeTruthy();

    const state = useMuseboardStore.getState();
    const hooks = state.hooks.filter((hook) => hook.contentId === contentId);
    const promoted = state.content.find((item) => item.id === contentId);

    expect(hooks).toHaveLength(3);
    expect(hooks.every((hook) => hook.text.trim().length > 0)).toBe(true);
    expect(promoted?.versions[0].selectedHookId).toBe(hooks[0].id);
    expect(promoted?.versions[0].selectedHookText).toBe(hooks[0].text);
  });

  it("converts an accepted Thinking Room direction to one Idea Board record", () => {
    const roomState = useThinkingRoomStore.getState();
    const room = roomState.rooms.find(({ id }) => id === roomState.selectedRoomId)!;
    const accepted = roomState.synthesisRevisions.find(
      (revision) => revision.roomId === room.id && revision.status === "accepted",
    )!;
    const opportunityIdsBefore = useMuseboardStore
      .getState()
      .opportunities.map(({ id }) => id);
    const contentIdsBefore = useMuseboardStore.getState().content.map(({ id }) => id);
    const convertedAt = "2026-07-16T12:30:00.000Z";

    const firstIdeaId = useMuseboardStore
      .getState()
      .createIdeaFromThinkingRoom(room.id, convertedAt);
    const secondIdeaId = useMuseboardStore
      .getState()
      .createIdeaFromThinkingRoom(room.id, "2026-07-16T12:35:00.000Z");

    expect(secondIdeaId).toBe(firstIdeaId);
    const ideas = useMuseboardStore
      .getState()
      .ideas.filter(
        ({ provenance }) => provenance.thinkingRoomOrigin?.roomId === room.id,
      );
    expect(ideas).toHaveLength(1);
    expect(ideas[0]).toMatchObject({
      id: firstIdeaId,
      title: accepted.chosenDirection.title,
      summary: accepted.chosenDirection.angle,
      provenance: {
        provider: "museboard-thinking-room",
        mode: "sample",
        thinkingRoomOrigin: {
          roomId: room.id,
          question: room.question,
          synthesisRevisionId: accepted.id,
          contributorCount: 2,
          convertedAt,
        },
      },
    });
    expect(ideas[0]).not.toHaveProperty("opportunityId");
    expect(ideas[0].provenance).not.toHaveProperty("opportunityId");
    expect(useMuseboardStore.getState().opportunities.map(({ id }) => id)).toEqual(
      opportunityIdsBefore,
    );
    expect(useMuseboardStore.getState().content.map(({ id }) => id)).toEqual(
      contentIdsBefore,
    );
    expect(
      useThinkingRoomStore.getState().rooms.find(({ id }) => id === room.id)?.status,
    ).toBe("converted");
  });

  it("does not convert a room before it has an accepted decision", () => {
    const roomId = useThinkingRoomStore.getState().createRoom(
      {
        organizationId: "org-sample",
        workspaceId: "workspace-sample",
        question: "What should the next series prove?",
        templateId: "content-direction",
        facilitatorMembershipId: "member-owner",
        decisionOwnerMembershipId: "member-owner",
      },
      "2026-07-16T13:00:00.000Z",
    );

    expect(
      useMuseboardStore.getState().createIdeaFromThinkingRoom(roomId!),
    ).toBeUndefined();
    expect(
      useMuseboardStore
        .getState()
        .ideas.some(({ provenance }) => provenance.thinkingRoomOrigin?.roomId === roomId),
    ).toBe(false);
  });
});

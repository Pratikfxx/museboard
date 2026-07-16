import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThinkingRoomWorkspace } from "@/components/thinking-rooms/thinking-room-workspace";
import { createDemoState } from "@/lib/demo/fixtures";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";

const ROOM_ID = "thinking-room-workspace-test";
const AT = "2026-07-16T12:00:00.000Z";

function setNarrowViewport(narrow: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: narrow && query === "(max-width: 720px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

function createExploringRoom() {
  const owner = createDemoState().memberships.find(({ id }) => id === "member-owner")!;
  act(() => {
    useThinkingRoomStore.getState().createRoom(
      {
        organizationId: "organization-sample",
        workspaceId: "workspace-sample",
        question: "Which audience truth should shape our next series?",
        templateId: "content-direction",
        facilitatorMembershipId: owner.id,
        decisionOwnerMembershipId: owner.id,
        context: "Choose a direction the team can defend.",
      },
      AT,
    );
    const generated = useThinkingRoomStore.getState().rooms.at(-1)!;
    useThinkingRoomStore.setState({
      rooms: useThinkingRoomStore.getState().rooms.map((room) =>
        room.id === generated.id ? { ...room, id: ROOM_ID } : room,
      ),
      selectedRoomId: ROOM_ID,
    });
  });
}

describe("Thinking Room guided decision canvas", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setNarrowViewport(false);
    useMuseboardStore.setState(createDemoState());
    useThinkingRoomStore.getState().resetSample(createDemoState().memberships);
  });

  it("gives a missing room a useful route back to the room library", () => {
    render(<ThinkingRoomWorkspace mode="sample" roomId="missing-room" />);

    expect(screen.getByRole("heading", { name: "This Thinking Room is not here." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Thinking Rooms" })).toHaveAttribute("href", "/app/thinking");
  });

  it("shows all four lenses wide and offers one-at-a-time keyboard lens navigation when narrow", async () => {
    createExploringRoom();
    const { unmount } = render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);

    for (const lens of ["Audience tensions", "Evidence", "Challenges", "Possibilities"]) {
      expect(screen.getByRole("region", { name: lens })).toBeVisible();
    }
    unmount();

    setNarrowViewport(true);
    const user = userEvent.setup();
    render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);
    expect(screen.getByRole("region", { name: "Audience tensions" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Evidence" })).not.toBeInTheDocument();

    const evidenceTab = screen.getByRole("tab", { name: "Evidence" });
    evidenceTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Challenges" })).toHaveFocus();
    await user.click(evidenceTab);
    expect(screen.getByRole("region", { name: "Evidence" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Audience tensions" })).not.toBeInTheDocument();
  });

  it("adds an attributed contribution, reports saved, and returns focus to the composer", async () => {
    createExploringRoom();
    const user = userEvent.setup();
    render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);

    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    const composer = screen.getByLabelText("Contribution to Evidence");
    expect(composer).toHaveFocus();
    await user.type(composer, "Three audience replies use the same exact phrase.");
    await user.click(screen.getByRole("button", { name: "Add contribution" }));

    expect(await screen.findByText("Saved")).toBeVisible();
    expect(screen.getByText("Three audience replies use the same exact phrase.")).toBeVisible();
    expect(screen.getByText(/Maya Chen/)).toBeVisible();
    expect(composer).toHaveValue("");
    expect(composer).toHaveFocus();
  });

  it("toggles a lightweight reaction without turning it into a vote", async () => {
    createExploringRoom();
    act(() => {
      useThinkingRoomStore.getState().addContribution({
        roomId: ROOM_ID,
        lens: "possibilities",
        body: "Let the constraint stay fixed while the proof changes.",
        authorMembershipId: "member-sam",
        authorDisplayNameSnapshot: "Sam Rivera",
      }, AT);
    });
    const user = userEvent.setup();
    render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);

    const note = screen.getByText("Let the constraint stay fixed while the proof changes.").closest("article")!;
    const promising = within(note).getByRole("button", { name: /Promising/ });
    await user.click(promising);
    expect(promising).toHaveAttribute("aria-pressed", "true");
    expect(promising).toHaveTextContent("1");
    await user.click(promising);
    expect(promising).toHaveAttribute("aria-pressed", "false");
  });

  it("enters synthesis, edits belief and confidence, resolves one challenge, and carries another forward", async () => {
    createExploringRoom();
    act(() => {
      const store = useThinkingRoomStore.getState();
      store.addContribution({
        roomId: ROOM_ID,
        lens: "challenges",
        body: "A repeated structure could flatten the creator's voice.",
        authorMembershipId: "member-sam",
        authorDisplayNameSnapshot: "Sam Rivera",
      }, AT);
      store.addContribution({
        roomId: ROOM_ID,
        lens: "challenges",
        body: "We still do not know which proof format earns trust.",
        authorMembershipId: "member-owner",
        authorDisplayNameSnapshot: "Maya Chen",
      }, AT);
    });
    const user = userEvent.setup();
    render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);

    await user.click(screen.getByRole("button", { name: "Begin synthesis" }));
    expect(screen.getByText("Synthesizing")).toBeVisible();
    const belief = screen.getByLabelText("Current shared belief");
    await user.type(belief, "A recognizable constraint can leave room for a fresh proof each week.");
    await user.click(screen.getByLabelText("High confidence"));

    const synthesis = screen.getByRole("complementary", { name: "Synthesis" });
    const firstChallenge = within(synthesis).getByText("A repeated structure could flatten the creator's voice.").closest("li")!;
    await user.click(within(firstChallenge).getByRole("button", { name: "Resolve challenge" }));
    expect(within(firstChallenge).getByText("Resolved in this synthesis")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save synthesis" }));

    expect(await screen.findByText("Saved")).toBeVisible();
    const revision = useThinkingRoomStore.getState().synthesisRevisions.at(-1)!;
    expect(revision.belief).toBe("A recognizable constraint can leave room for a fresh proof each week.");
    expect(revision.confidence).toBe("high");
    expect(revision.openChallengeIds).toHaveLength(1);
    expect(screen.getAllByText("A repeated structure could flatten the creator's voice.")[0]).toBeVisible();
  });

  it("keeps a live contribution draft and explains a save conflict", async () => {
    const aggregate = {
      room: {
        ...useThinkingRoomStore.getState().rooms[0],
        id: "765ca2ea-d876-4bb2-95bd-5b64bc727770",
        organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
        facilitatorMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
        decisionOwnerMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
        status: "exploring" as const,
      },
      contributions: [],
      reactions: [],
      synthesisRevisions: [],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ aggregate }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "revision_conflict" }), { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <ThinkingRoomWorkspace
        liveContext={{
          userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
          displayName: "Maya Chen",
          canEdit: true,
        }}
        mode="live"
        roomId={aggregate.room.id}
      />,
    );

    expect(await screen.findByRole("heading", { name: aggregate.room.question })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    const composer = screen.getByLabelText("Contribution to Evidence");
    await user.type(composer, "Keep this unsaved thought intact.");
    await user.click(screen.getByRole("button", { name: "Add contribution" }));

    expect(await screen.findByText("This room changed elsewhere.")).toBeVisible();
    expect(screen.getByText(/your draft is safe/i)).toBeVisible();
    expect(composer).toHaveValue("Keep this unsaved thought intact.");
    expect(screen.getByRole("button", { name: "Retry save" })).toBeVisible();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});

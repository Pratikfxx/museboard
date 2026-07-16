import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";
import { ThinkingRoomWorkspace } from "@/components/thinking-rooms/thinking-room-workspace";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { roomCanConvert } from "@/domain/thinking-rooms";
import { createDemoState } from "@/lib/demo/fixtures";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";

const push = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

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
    push.mockReset();
    setNarrowViewport(false);
    useMuseboardStore.setState(createDemoState());
    useThinkingRoomStore.getState().resetSample(createDemoState().memberships);
  });

  it("gives a missing room a useful route back to the room library", () => {
    render(<ThinkingRoomWorkspace mode="sample" roomId="missing-room" />);

    expect(screen.getByRole("heading", { name: "This Thinking Room is not here." })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Thinking Rooms" })).toHaveAttribute("href", "/app/thinking");
  });

  it("resolves the active sample participant without relying on a browser status global", () => {
    createExploringRoom();
    Reflect.deleteProperty(globalThis, "status");

    expect(() => render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />)).not.toThrow();
    expect(screen.getByTitle("Maya Chen")).toBeVisible();
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

  it("suggests an editable belief and converts an accepted decision once with Thinking Room provenance", async () => {
    createExploringRoom();
    const user = userEvent.setup();
    const view = render(<ThinkingRoomWorkspace mode="sample" roomId={ROOM_ID} />);

    await user.click(screen.getByRole("button", { name: "Add evidence" }));
    await user.type(
      screen.getByLabelText("Contribution to Evidence"),
      "Audience replies consistently save practical constraint-led examples.",
    );
    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.click(screen.getByRole("button", { name: "Add challenges" }));
    await user.type(
      screen.getByLabelText("Contribution to Challenges"),
      "The pattern may become repetitive without a fresh proof each week.",
    );
    await user.click(screen.getByRole("button", { name: "Add contribution" }));
    await user.click(screen.getByRole("button", { name: "Begin synthesis" }));

    const synthesis = screen.getByRole("complementary", { name: "Synthesis" });
    expect(within(synthesis).getByText("Suggested")).toBeVisible();
    expect(within(synthesis).getByText(/Audience replies consistently save practical constraint-led examples/)).toBeVisible();
    expect(within(synthesis).getByText("The pattern may become repetitive without a fresh proof each week.")).toBeVisible();
    expect(within(synthesis).getByLabelText("Current shared belief")).toHaveValue("");
    await user.click(within(synthesis).getByRole("button", { name: "Use suggested belief" }));
    const belief = within(synthesis).getByLabelText("Current shared belief");
    expect(belief).toHaveValue("Audience replies consistently save practical constraint-led examples.");
    await user.type(belief, " Build each installment around new proof.");
    await user.click(within(synthesis).getByLabelText("High confidence"));
    await user.click(within(synthesis).getByRole("button", { name: "Save synthesis" }));

    const decidedSynthesis = await screen.findByRole("complementary", { name: "Synthesis" });
    expect(within(decidedSynthesis).getByText(/1 open challenge remains/i)).toBeVisible();
    const roomState = useThinkingRoomStore.getState();
    const acceptedRoom = roomState.rooms.find(({ id }) => id === ROOM_ID)!;
    const acceptedRevision = roomState.synthesisRevisions.filter(({ roomId }) => roomId === ROOM_ID).at(-1)!;
    expect(acceptedRevision).toMatchObject({
      status: "accepted",
      acceptedByMembershipId: acceptedRoom.decisionOwnerMembershipId,
      confidence: "high",
    });
    expect(acceptedRoom.status).toBe("decided");
    expect(roomCanConvert(acceptedRoom, roomState.synthesisRevisions)).toBe(true);
    const convert = within(decidedSynthesis).getByRole("button", { name: "Create Idea Board direction" });
    expect(convert).toBeEnabled();
    await user.click(convert);
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/opportunities\/ideas/));
    expect(screen.getByRole("button", { name: "Direction already created" })).toBeDisabled();
    expect(
      useMuseboardStore.getState().ideas.filter(
        ({ provenance }) => provenance.thinkingRoomOrigin?.roomId === ROOM_ID,
      ),
    ).toHaveLength(1);

    view.rerender(
      <ThemeProvider>
        <OpportunitiesWorkspace view="ideas" />
      </ThemeProvider>,
    );
    const idea = screen.getByRole("article", {
      name: /Audience replies consistently save practical constraint-led examples/i,
    });
    expect(within(idea).getByText("From Thinking Room")).toBeVisible();
    expect(within(idea).getByText("Which audience truth should shape our next series?")).toBeVisible();
    expect(within(idea).getByText("High confidence")).toBeVisible();
    expect(within(idea).getByRole("link", { name: "Open room" })).toHaveAttribute(
      "href",
      `/app/thinking/${ROOM_ID}`,
    );
    expect(idea).not.toHaveTextContent(ROOM_ID);
  });

  it("reloads and rebases a preserved live draft after a revision conflict", async () => {
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
    const latestAggregate = {
      ...aggregate,
      room: { ...aggregate.room, revision: 8 },
      contributions: [{
        id: "13b9c85c-fccd-450b-83dd-90745c564895",
        roomId: aggregate.room.id,
        lens: "audience_tensions" as const,
        body: "A teammate added this while the draft was open.",
        authorMembershipId: "2b289173-0535-49e0-b9ce-b5b29fb1c53c",
        authorDisplayNameSnapshot: "Sam Rivera",
        createdAt: AT,
        updatedAt: AT,
        revision: 1,
      }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ aggregate }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "revision_conflict" }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ aggregate: latestAggregate }), { status: 200 }))
      .mockImplementationOnce(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as { expectedRevision: number; aggregate: typeof aggregate };
        expect(body.expectedRevision).toBe(8);
        expect(body.aggregate.contributions).toEqual(expect.arrayContaining([
          expect.objectContaining({ body: "A teammate added this while the draft was open." }),
          expect.objectContaining({ body: "Keep this unsaved thought intact." }),
        ]));
        return new Response(JSON.stringify({
          aggregate: { ...body.aggregate, room: { ...body.aggregate.room, revision: 9 } },
        }), { status: 200 });
      });
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
    await user.click(screen.getByRole("button", { name: "Retry save" }));

    expect(await screen.findByText("A teammate added this while the draft was open.")).toBeVisible();
    expect(screen.getByText("Keep this unsaved thought intact.")).toBeVisible();
    expect(composer).toHaveValue("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init?.method ?? "GET"])).toEqual([
      [`/api/thinking-rooms/${aggregate.room.id}`, "GET"],
      [`/api/thinking-rooms/${aggregate.room.id}`, "PUT"],
      [`/api/thinking-rooms/${aggregate.room.id}`, "GET"],
      [`/api/thinking-rooms/${aggregate.room.id}`, "PUT"],
    ]);
  });

  it("treats a challenge added after the current synthesis as unresolved when reopening", async () => {
    const sampleRoom = useThinkingRoomStore.getState().rooms[0];
    act(() => {
      useThinkingRoomStore.getState().addContribution({
        roomId: sampleRoom.id,
        lens: "challenges",
        body: "A new objection arrived after the team made its first decision.",
        authorMembershipId: "member-sam",
        authorDisplayNameSnapshot: "Sam Rivera",
      }, AT);
    });
    const user = userEvent.setup();
    render(<ThinkingRoomWorkspace mode="sample" roomId={sampleRoom.id} />);

    await user.click(screen.getByRole("button", { name: "Reopen synthesis" }));
    const synthesis = screen.getByRole("complementary", { name: "Synthesis" });
    const newChallenge = within(synthesis)
      .getByText("A new objection arrived after the team made its first decision.")
      .closest("li")!;
    expect(within(newChallenge).getByRole("button", { name: "Resolve challenge" })).toBeVisible();
    expect(within(newChallenge).queryByText("Resolved in this synthesis")).not.toBeInTheDocument();
  });

  it("does not offer live reaction writes to viewers", async () => {
    const aggregate = {
      room: {
        ...useThinkingRoomStore.getState().rooms[0],
        id: "765ca2ea-d876-4bb2-95bd-5b64bc727770",
        organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
        facilitatorMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
        decisionOwnerMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
      },
      contributions: useThinkingRoomStore.getState().contributions.map((contribution) => ({
        ...contribution,
        roomId: "765ca2ea-d876-4bb2-95bd-5b64bc727770",
      })),
      reactions: [],
      synthesisRevisions: [],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ aggregate }), { status: 200 }),
    ));
    render(
      <ThinkingRoomWorkspace
        liveContext={{ userId: "viewer-user", displayName: "View Only", canEdit: false }}
        mode="live"
        roomId={aggregate.room.id}
      />,
    );

    const note = await screen.findByText("Sample note: creators want consistency without sounding repetitive.");
    const reaction = within(note.closest("article")!).getByRole("button", { name: /Agree/ });
    expect(reaction).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add audience tensions" })).toBeDisabled();
  });
});

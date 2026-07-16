import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThinkingRoomLibrary } from "@/components/thinking-rooms/thinking-room-library";
import { createDemoState } from "@/lib/demo/fixtures";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";
import { useMuseboardStore } from "@/lib/store/museboard-store";

const CREATED_AT = "2026-07-16T12:00:00.000Z";

function emptySampleLibrary() {
  useThinkingRoomStore.setState({
    rooms: [],
    contributions: [],
    reactions: [],
    synthesisRevisions: [],
    selectedRoomId: undefined,
    syncState: "idle",
  });
}

describe("Thinking Room library", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useMuseboardStore.setState(createDemoState());
    useThinkingRoomStore.getState().resetSample(createDemoState().memberships);
  });

  it("offers a useful empty state and validates a strategic question", async () => {
    const user = userEvent.setup();
    emptySampleLibrary();
    render(<ThinkingRoomLibrary mode="sample" />);

    expect(screen.getByRole("heading", { name: "Bring the question you cannot settle in a comment thread." })).toBeVisible();
    expect(screen.getByText(/start with the decision your next content direction depends on/i)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "New Thinking Room" }));
    await user.click(screen.getByRole("button", { name: "Create room" }));

    expect(screen.getByText("Add the strategic question you want to resolve.")).toBeVisible();
    expect(screen.getByLabelText("Strategic question")).toHaveFocus();
  });

  it("creates a sample room, focuses it, and links into its decision canvas", async () => {
    const user = userEvent.setup();
    emptySampleLibrary();
    render(<ThinkingRoomLibrary mode="sample" />);

    await user.click(screen.getByRole("button", { name: "New Thinking Room" }));
    await user.type(
      screen.getByLabelText("Strategic question"),
      "Which audience tension should anchor the next three-part series?",
    );
    await user.type(screen.getByLabelText("Optional context"), "Choose one direction before Friday.");
    await user.click(screen.getByRole("button", { name: "Create room" }));

    const roomLink = await screen.findByRole("link", {
      name: /which audience tension should anchor the next three-part series/i,
    });
    expect(roomLink).toHaveAttribute("href", expect.stringMatching(/^\/app\/thinking\/thinking-room-/));
    await waitFor(() => expect(roomLink).toHaveFocus());
    expect(useThinkingRoomStore.getState().rooms).toHaveLength(1);
  });

  it("groups recent work and filters active from decided rooms", async () => {
    const user = userEvent.setup();
    const decided = useThinkingRoomStore.getState().rooms[0];
    act(() => {
      useThinkingRoomStore.getState().createRoom(
        {
          organizationId: "organization-sample",
          workspaceId: "workspace-sample",
          question: "What proof would make the weekly format credible?",
          templateId: "content-direction",
          facilitatorMembershipId: "member-owner",
        },
        CREATED_AT,
      );
    });
    render(<ThinkingRoomLibrary mode="sample" />);

    expect(screen.getByRole("heading", { name: "In progress" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Decisions made" })).toBeVisible();
    expect(screen.getByRole("link", { name: /what proof would make/i })).toHaveAttribute(
      "href",
      "/app/thinking/thinking-room-2",
    );
    expect(screen.getByRole("link", { name: new RegExp(decided.question, "i") })).toHaveAttribute(
      "href",
      `/app/thinking/${decided.id}`,
    );

    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getByRole("link", { name: /what proof would make/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: new RegExp(decided.question, "i") })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Decided" }));
    expect(screen.queryByRole("link", { name: /what proof would make/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(decided.question, "i") })).toBeVisible();
  });

  it("loads live rooms from the dedicated endpoint without presenting realtime claims", async () => {
    const liveRoom = {
      ...useThinkingRoomStore.getState().rooms[0],
      id: "live-room-1",
      question: "Which launch objection deserves a direct answer?",
    };
    let resolveRequest: ((value: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; })));

    render(<ThinkingRoomLibrary mode="live" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading Thinking Rooms");
    expect(screen.queryByText(/realtime/i)).not.toBeInTheDocument();

    act(() => resolveRequest?.(new Response(JSON.stringify({ rooms: [liveRoom] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })));
    expect(await screen.findByRole("link", { name: /which launch objection/i })).toHaveAttribute(
      "href",
      "/app/thinking/live-room-1",
    );
  });

  it.each([
    [403, "You no longer have permission to view these Thinking Rooms."],
    [409, "This room list changed elsewhere. Reload it before continuing."],
    [500, "Thinking Rooms could not be loaded."],
  ])("shows a useful %s live response and retries", async (status, message) => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "failed" }), { status }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rooms: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ThinkingRoomLibrary mode="live" />);

    expect(await screen.findByText(message)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/start with the decision your next content direction depends on/i)).toBeVisible();
  });

  it("distinguishes an offline live load and keeps retry available", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rooms: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ThinkingRoomLibrary mode="live" />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("You appear to be offline. Reconnect and try again.")).toBeVisible();
    await user.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/start with the decision your next content direction depends on/i)).toBeVisible();
  });

  it("keeps the loaded library and draft visible when live creation permission is denied", async () => {
    const user = userEvent.setup();
    const liveRoom = {
      ...useThinkingRoomStore.getState().rooms[0],
      id: "live-room-readable",
      question: "Which audience objection needs the clearest proof?",
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ rooms: [liveRoom] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "You cannot create Thinking Rooms" }), { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ThinkingRoomLibrary
        liveContext={{
          organizationId: "4f0b3ec4-d507-4726-974c-9b1ea51f73b9",
          workspaceId: "maya-studio",
          userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
          displayName: "Maya Chen",
          canCreate: true,
        }}
        mode="live"
      />,
    );

    expect(await screen.findByRole("link", { name: /which audience objection/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "New Thinking Room" }));
    const question = screen.getByLabelText("Strategic question");
    await user.type(question, "What evidence would make this direction trustworthy?");
    await user.click(screen.getByRole("button", { name: "Create room" }));

    expect(await screen.findByText("You cannot create Thinking Rooms in this workspace.")).toBeVisible();
    expect(screen.getByRole("link", { name: /which audience objection/i })).toBeVisible();
    expect(question).toHaveValue("What evidence would make this direction trustworthy?");
    expect(screen.getByRole("button", { name: "Create room" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New Thinking Room" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

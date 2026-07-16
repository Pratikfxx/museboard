import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveWorkspaceProvider } from "@/components/workspace/live-workspace-provider";
import { createDemoState } from "@/lib/demo/fixtures";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";
import { normalizeLiveWorkspacePayload } from "@/lib/workspace/snapshot";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";

function livePayload() {
  const creator = buildStarterWorkspace({
    name: "Maya Chen",
    outcome: "plan_week",
    archetype: "tech_education",
    audience: "Curious builders",
    platforms: ["instagram_reels"],
    weeklyCapacityMinutes: 240,
    voice: "Clear and practical",
    boundaries: "No hype",
    firstHook: "Here is the useful part.",
  }).creator;
  return normalizeLiveWorkspacePayload({
    ...createDemoState(),
    creator,
  }, {
    userId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
    memberships: [{
      id: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
      email: "maya@example.com",
      displayNameSnapshot: "Maya Chen",
      role: "owner",
      status: "active",
      invitedAt: "2026-07-01T00:00:00.000Z",
      joinedAt: "2026-07-01T00:00:00.000Z",
    }],
    currentActorMembershipId: "8fef70b0-c52b-4312-b6e7-8fac5ed73510",
    plan: "creator",
    used: {},
    reserved: {},
    resetAt: "2026-08-01T00:00:00.000Z",
  });
}

function WorkspaceConsumer() {
  const creator = useMuseboardStore((state) => state.creator);
  const saved = useMuseboardStore(
    (state) => state.opportunityDecisions["opportunity-desk"],
  );
  return (
    <div>
      <h1>{creator?.name}</h1>
      <p>{saved ?? "not saved"}</p>
      <button
        onClick={() => useMuseboardStore.getState().saveOpportunity("opportunity-desk")}
        type="button"
      >
        Save opportunity
      </button>
    </div>
  );
}

describe("live workspace hydration and sync", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    useMuseboardStore.getState().resetDemo();
  });

  it("gates seeded UI, hydrates canonical data, and persists later mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ revision: 5, payload: livePayload() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <LiveWorkspaceProvider
        initialSnapshot={{ payload: livePayload(), revision: 4 }}
        organizationId={organizationId}
      >
        <WorkspaceConsumer />
      </LiveWorkspaceProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Maya Chen" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Save opportunity" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      organizationId,
      expectedRevision: 4,
      payload: { dataMode: "live", opportunityDecisions: { "opportunity-desk": "saved" } },
    });
    expect(await screen.findByText(/all changes saved/i)).toBeVisible();
  });

  it("stops autosaving and asks for reload after a revision conflict", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "revision_conflict" }), {
        status: 409,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(
      <LiveWorkspaceProvider
        initialSnapshot={{ payload: livePayload(), revision: 2 }}
        organizationId={organizationId}
      >
        <WorkspaceConsumer />
      </LiveWorkspaceProvider>,
    );
    await screen.findByRole("heading", { name: "Maya Chen" });
    fireEvent.click(screen.getByRole("button", { name: "Save opportunity" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/changed on another device/i);
    act(() => useMuseboardStore.getState().dismissOpportunity("opportunity-desk"));
    await new Promise((resolve) => setTimeout(resolve, 750));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("stops autosaving and offers a copy when workspace permission is revoked", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "permission revoked" }), { status: 403 }),
    );
    render(<LiveWorkspaceProvider initialSnapshot={{ payload: livePayload(), revision: 2 }} organizationId={organizationId}><WorkspaceConsumer /></LiveWorkspaceProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Save opportunity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/access was revoked/i);
    expect(screen.getByRole("button", { name: "Copy draft" })).toBeVisible();
  });
});

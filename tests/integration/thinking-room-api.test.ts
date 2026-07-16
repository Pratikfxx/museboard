import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedWorkspace: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/workspace", () => ({
  getAuthenticatedWorkspace: mocks.getAuthenticatedWorkspace,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

import { GET as listRooms, POST as createRoom } from "@/app/api/thinking-rooms/route";
import { GET as loadRoom, PUT as saveRoom } from "@/app/api/thinking-rooms/[roomId]/route";
import { PUT as setReaction } from "@/app/api/thinking-rooms/[roomId]/reactions/route";
import { POST as convertRoom } from "@/app/api/thinking-rooms/[roomId]/convert/route";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const otherOrganizationId = "a1bc23da-e517-49a5-9392-2b056d77ceec";
const roomId = "243e5423-b7f9-46f7-9026-b08b175466da";
const ownerId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
const viewerId = "f49d98d0-bf0d-433c-af39-7137e320cc20";
const contributionId = "5b5b7c4f-3f88-402f-8ebf-e81880d662d4";
const reactionId = "4186b21d-5ff5-4f45-b5d7-c3a0a1159930";
const linkId = "a98138f4-3461-4ab2-bdec-b09d8769fbe2";
const synthesisId = "30a1db3f-c5b5-46b3-b7fc-3a315d3b6e0d";
const ideaId = "dc0164bd-0e71-4de4-988d-d821c7271540";
const createdAt = "2026-07-16T09:00:00.000Z";
const owner = {
  userId: ownerId,
  email: "maya@example.com",
  organizationId,
  organizationName: "Maya's studio",
  organizationSlug: "maya-studio",
  role: "owner",
  displayName: "Maya Chen",
  plan: "creator",
};

const roomRow = {
  id: roomId,
  organization_id: organizationId,
  workspace_id: "creator-workspace",
  question: "Which tension should anchor our next series?",
  template_id: "content-direction",
  status: "exploring",
  facilitator_user_id: ownerId,
  decision_owner_user_id: null,
  context: null,
  decision_due_at: null,
  revision: 1,
  created_at: createdAt,
  updated_at: createdAt,
  archived_at: null,
};

function aggregate(
  overrides: { organizationId?: string; facilitatorId?: string } = {},
): import("@/lib/thinking-rooms/repository").ThinkingRoomAggregate {
  return {
    room: {
      id: roomId,
      organizationId: overrides.organizationId ?? organizationId,
      workspaceId: "creator-workspace",
      question: "Which tension should anchor our next series?",
      templateId: "content-direction",
      status: "exploring" as const,
      facilitatorMembershipId: overrides.facilitatorId ?? ownerId,
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    },
    contributions: [],
    reactions: [],
    links: [],
    synthesisRevisions: [],
    contentOrigins: [],
  };
}

function request(path: string, method: "GET" | "POST" | "PUT", body?: unknown, origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function listClient(rows = [roomRow]) {
  const order = vi.fn(async () => ({ data: rows, error: null }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ select })), rpc: vi.fn(), eq };
}

function loadClient(row = roomRow) {
  const maybeSingle = vi.fn(async () => ({ data: row, error: null }));
  const roomSecondEq = vi.fn(() => ({ maybeSingle }));
  const roomFirstEq = vi.fn(() => ({ eq: roomSecondEq }));
  const roomSelect = vi.fn(() => ({ eq: roomFirstEq }));
  const childOrder = vi.fn(async () => ({ data: [], error: null }));
  const childSecondEq = vi.fn(() => ({ order: childOrder }));
  const childFirstEq = vi.fn(() => ({ eq: childSecondEq }));
  const childSelect = vi.fn(() => ({ eq: childFirstEq }));
  return {
    from: vi.fn((table: string) => table === "thinking_rooms"
      ? { select: roomSelect }
      : { select: childSelect }),
    rpc: vi.fn(),
    roomFirstEq,
  };
}

describe("authenticated Thinking Room API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedWorkspace.mockResolvedValue(owner);
  });

  it("fails closed without an authenticated workspace", async () => {
    mocks.getAuthenticatedWorkspace.mockResolvedValue(null);

    expect((await listRooms(request("/api/thinking-rooms", "GET"))).status).toBe(401);
    expect((await loadRoom(
      request(`/api/thinking-rooms/${roomId}`, "GET"),
      { params: Promise.resolve({ roomId }) },
    )).status).toBe(401);
  });

  it("rejects cross-origin, viewer, and cross-organization writes before storage", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });

    expect((await createRoom(
      request("/api/thinking-rooms", "POST", { aggregate: aggregate() }, "https://attacker.test"),
    )).status).toBe(403);

    mocks.getAuthenticatedWorkspace.mockResolvedValue({ ...owner, role: "viewer" });
    expect((await createRoom(
      request("/api/thinking-rooms", "POST", { aggregate: aggregate() }),
    )).status).toBe(403);

    mocks.getAuthenticatedWorkspace.mockResolvedValue(owner);
    expect((await createRoom(
      request("/api/thinking-rooms", "POST", {
        aggregate: aggregate({ organizationId: otherOrganizationId }),
      }),
    )).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed room data and local member identifiers", async () => {
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc: vi.fn() });
    const response = await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: aggregate({ facilitatorId: "member-owner" }),
    }));

    expect(response.status).toBe(400);
  });

  it("rejects oversized collection and room mutations with 400", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });
    const oversized = aggregate();
    oversized.room.question = "q".repeat(2001);

    expect((await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: oversized,
    }))).status).toBe(400);
    expect((await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", {
        expectedRevision: 1,
        aggregate: oversized,
      }),
      { params: Promise.resolve({ roomId }) },
    )).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a defensive database check-constraint failure to 400", async () => {
    mocks.createClient.mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "23514", message: "violates check constraint" },
      })),
    });

    const response = await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: aggregate(),
    }));
    expect(response.status).toBe(400);
  });

  it("lists serialized organization rooms with private no-store caching", async () => {
    const client = listClient();
    mocks.createClient.mockResolvedValue(client);
    const response = await listRooms(request("/api/thinking-rooms", "GET"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      rooms: [expect.objectContaining({ id: roomId, organizationId })],
    });
    expect(client.eq).toHaveBeenCalledWith("organization_id", organizationId);
  });

  it("loads one room through organization-scoped queries and serializes the aggregate", async () => {
    const client = loadClient();
    mocks.createClient.mockResolvedValue(client);
    const response = await loadRoom(
      request(`/api/thinking-rooms/${roomId}`, "GET"),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ aggregate: aggregate() });
    expect(client.roomFirstEq).toHaveBeenCalledWith("organization_id", organizationId);
  });

  it("creates a room attributed to the authenticated Supabase user", async () => {
    const client = loadClient();
    client.rpc.mockResolvedValue({ data: 1, error: null });
    mocks.createClient.mockResolvedValue(client);
    const response = await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: aggregate(),
    }));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ aggregate: aggregate() });
    expect(client.rpc).toHaveBeenCalledWith("save_thinking_room", expect.objectContaining({
      p_organization_id: organizationId,
      p_room: expect.objectContaining({ facilitator_user_id: ownerId }),
    }));
  });

  it("rejects forged author display names and editor-assigned initial decision owners", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });
    mocks.getAuthenticatedWorkspace.mockResolvedValue({
      ...owner,
      userId: viewerId,
      role: "editor",
      displayName: "Editor Snapshot",
    });
    const forged = aggregate({ facilitatorId: viewerId });
    forged.contributions = [{
      id: contributionId,
      roomId,
      lens: "evidence",
      body: "Evidence",
      sourceReferenceId: "https://example.com/evidence",
      authorMembershipId: viewerId,
      authorDisplayNameSnapshot: "Forged Name",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    }];
    expect((await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: forged,
    }))).status).toBe(403);

    const assigned = aggregate({ facilitatorId: viewerId });
    assigned.room.decisionOwnerMembershipId = viewerId;
    expect((await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: assigned,
    }))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a stale room PUT to 409 without overwriting newer data", async () => {
    const client = loadClient();
    client.rpc.mockResolvedValue({
        data: null,
        error: { code: "40001", message: "thinking room revision conflict" },
    });
    mocks.createClient.mockResolvedValue(client);
    const response = await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", {
        expectedRevision: 1,
        aggregate: aggregate(),
      }),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "revision_conflict" });
  });

  it("returns a revision conflict before semantic authorization of a stale payload", async () => {
    const client = loadClient({ ...roomRow, revision: 3 });
    mocks.createClient.mockResolvedValue(client);
    const stale = aggregate();
    stale.contributions = [{
      id: contributionId,
      roomId,
      lens: "possibilities",
      body: "A stale impersonated mutation.",
      authorMembershipId: viewerId,
      authorDisplayNameSnapshot: "Impersonated",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    }];

    const response = await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", { expectedRevision: 1, aggregate: stale }),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ code: "revision_conflict" });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns SQL-canonical link resolution time and accepts it on the next save", async () => {
    const clientResolvedAt = "2026-07-16T10:00:00.000Z";
    const serverResolvedAt = "2026-07-16T10:00:00.321Z";
    const roomRevisions = [1, 1, 2, 2, 2, 2, 3, 3];
    const maybeSingle = vi.fn(async () => ({
      data: { ...roomRow, revision: roomRevisions.shift() ?? 3 },
      error: null,
    }));
    const roomSecondEq = vi.fn(() => ({ maybeSingle }));
    const roomFirstEq = vi.fn(() => ({ eq: roomSecondEq }));
    const roomSelect = vi.fn(() => ({ eq: roomFirstEq }));
    const contributionRow = {
      id: contributionId,
      organization_id: organizationId,
      room_id: roomId,
      lens: "challenges",
      body: "The pattern may become repetitive.",
      author_user_id: ownerId,
      author_display_name_snapshot: "Maya Chen",
      source_reference_id: null,
      mentioned_user_id: null,
      related_contribution_id: null,
      revision: 1,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    };
    const openLinkRow = {
      id: linkId,
      organization_id: organizationId,
      room_id: roomId,
      from_contribution_id: contributionId,
      to_contribution_id: contributionId,
      relationship: "challenges",
      created_by_user_id: ownerId,
      resolution_status: "open",
      resolution_note: null,
      resolved_by_user_id: null,
      created_at: createdAt,
      resolved_at: null,
    };
    const resolvedLinkRow = {
      ...openLinkRow,
      resolution_status: "resolved",
      resolution_note: "The new evidence resolves this challenge.",
      resolved_by_user_id: ownerId,
      resolved_at: serverResolvedAt,
    };
    const linkReads = [[openLinkRow], [resolvedLinkRow], [resolvedLinkRow], [resolvedLinkRow]];
    const child = (rows: unknown[] | (() => unknown[])) => {
      const order = vi.fn(async () => ({
        data: typeof rows === "function" ? rows() : rows,
        error: null,
      }));
      const secondEq = vi.fn(() => ({ order }));
      const firstEq = vi.fn(() => ({ eq: secondEq }));
      return { select: vi.fn(() => ({ eq: firstEq })) };
    };
    const children = {
      thinking_contributions: child([contributionRow]),
      thinking_contribution_reactions: child([]),
      thinking_contribution_links: child(() => linkReads.shift() ?? [resolvedLinkRow]),
      thinking_synthesis_revisions: child([]),
      thinking_room_content_origins: child([]),
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 3, error: null });
    mocks.createClient.mockResolvedValue({
      from: vi.fn((table: string) => table === "thinking_rooms"
        ? { select: roomSelect }
        : children[table as keyof typeof children]),
      rpc,
    });
    const submitted = aggregate();
    submitted.contributions = [{
      id: contributionId,
      roomId,
      lens: "challenges",
      body: contributionRow.body,
      authorMembershipId: ownerId,
      authorDisplayNameSnapshot: "Maya Chen",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    }];
    submitted.links = [{
      id: linkId,
      roomId,
      fromContributionId: contributionId,
      toContributionId: contributionId,
      relationship: "challenges",
      createdByMembershipId: ownerId,
      resolutionStatus: "resolved",
      resolutionNote: resolvedLinkRow.resolution_note,
      resolvedByMembershipId: ownerId,
      createdAt,
      resolvedAt: clientResolvedAt,
    }];

    const first = await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", {
        expectedRevision: 1,
        aggregate: submitted,
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(first.status).toBe(200);
    const canonical = (await first.json()).aggregate;
    expect(canonical.links[0].resolvedAt).toBe(serverResolvedAt);

    const second = await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", {
        expectedRevision: 2,
        aggregate: canonical,
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(second.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(2, "save_thinking_room", expect.objectContaining({
      p_expected_revision: 2,
      p_links: [expect.objectContaining({ resolved_at: serverResolvedAt })],
    }));
  });

  it("rejects an editor's attempt to impersonate a contribution author before save", async () => {
    const client = loadClient();
    mocks.createClient.mockResolvedValue(client);
    mocks.getAuthenticatedWorkspace.mockResolvedValue({
      ...owner,
      userId: viewerId,
      role: "editor",
      displayName: "Editor",
    });
    const next = aggregate();
    next.contributions = [{
      id: contributionId,
      roomId,
      lens: "evidence",
      body: "Client-authored evidence",
      sourceReferenceId: "https://example.com/evidence",
      authorMembershipId: ownerId,
      authorDisplayNameSnapshot: "Maya Chen",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    }];

    const response = await saveRoom(
      request(`/api/thinking-rooms/${roomId}`, "PUT", {
        expectedRevision: 1,
        aggregate: next,
      }),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(403);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("lets an active viewer mutate only their own reaction through the narrow route", async () => {
    mocks.getAuthenticatedWorkspace.mockResolvedValue({
      ...owner,
      userId: viewerId,
      role: "viewer",
      displayName: "Viewer",
    });
    const rpc = vi.fn(async () => ({
      data: {
        room_revision: 2,
        reaction: {
          id: reactionId,
          room_id: roomId,
          contribution_id: contributionId,
          actor_user_id: viewerId,
          kind: "agree",
          created_at: createdAt,
        },
      },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });

    const response = await setReaction(
      request(`/api/thinking-rooms/${roomId}/reactions`, "PUT", {
        contributionId,
        kind: "agree",
        active: true,
        reactionId,
        membershipId: ownerId,
        reasoningEdit: "must be ignored",
      }),
      { params: Promise.resolve({ roomId }) },
    );

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("set_thinking_room_reaction", {
      p_organization_id: organizationId,
      p_room_id: roomId,
      p_contribution_id: contributionId,
      p_kind: "agree",
      p_active: true,
      p_reaction_id: reactionId,
    });
    await expect(response.json()).resolves.toMatchObject({
      roomRevision: 2,
      reaction: { membershipId: viewerId },
    });
  });

  it.each([
    ["42501", 403],
    ["23503", 404],
    ["23514", 400],
  ])("maps reaction database error %s to HTTP %i", async (code, status) => {
    mocks.createClient.mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(async () => ({ data: null, error: { code, message: "denied" } })),
    });
    const response = await setReaction(
      request(`/api/thinking-rooms/${roomId}/reactions`, "PUT", {
        contributionId,
        kind: "agree",
        active: true,
        reactionId,
      }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(response.status).toBe(status);
  });

  it("persists conversion before returning the authoritative origin to two actors", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        room_id: roomId,
        synthesis_revision_id: synthesisId,
        idea_id: ideaId,
        created_by_user_id: ownerId,
        created_at: createdAt,
        room_revision: 4,
      },
      error: null,
    }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });
    const input = { synthesisRevisionId: synthesisId, ideaId, expectedRevision: 3 };

    const first = await convertRoom(
      request(`/api/thinking-rooms/${roomId}/convert`, "POST", input),
      { params: Promise.resolve({ roomId }) },
    );
    mocks.getAuthenticatedWorkspace.mockResolvedValue({
      ...owner,
      userId: viewerId,
      role: "editor",
      displayName: "Second Actor",
    });
    const retryBySecondActor = await convertRoom(
      request(`/api/thinking-rooms/${roomId}/convert`, "POST", input),
      { params: Promise.resolve({ roomId }) },
    );

    expect(first.status).toBe(200);
    expect(retryBySecondActor.status).toBe(200);
    await expect(retryBySecondActor.json()).resolves.toEqual({
      origin: {
        roomId,
        synthesisRevisionId: synthesisId,
        ideaId,
        createdByMembershipId: ownerId,
        createdAt,
      },
      roomRevision: 4,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("fails conversion closed for viewers, revoked permissions, and stale rooms", async () => {
    const rpc = vi.fn();
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });
    const input = { synthesisRevisionId: synthesisId, ideaId, expectedRevision: 3 };
    mocks.getAuthenticatedWorkspace.mockResolvedValue({ ...owner, role: "viewer" });
    expect((await convertRoom(
      request(`/api/thinking-rooms/${roomId}/convert`, "POST", input),
      { params: Promise.resolve({ roomId }) },
    )).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();

    mocks.getAuthenticatedWorkspace.mockResolvedValue(owner);
    rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "membership revoked" },
    }).mockResolvedValueOnce({
      data: null,
      error: { code: "40001", message: "thinking room revision conflict" },
    });
    expect((await convertRoom(
      request(`/api/thinking-rooms/${roomId}/convert`, "POST", input),
      { params: Promise.resolve({ roomId }) },
    )).status).toBe(403);
    const conflict = await convertRoom(
      request(`/api/thinking-rooms/${roomId}/convert`, "POST", input),
      { params: Promise.resolve({ roomId }) },
    );
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toMatchObject({ code: "revision_conflict" });
  });
});

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

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const otherOrganizationId = "a1bc23da-e517-49a5-9392-2b056d77ceec";
const roomId = "243e5423-b7f9-46f7-9026-b08b175466da";
const ownerId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
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

function aggregate(overrides: { organizationId?: string; facilitatorId?: string } = {}) {
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
    synthesisRevisions: [],
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

function loadClient() {
  const maybeSingle = vi.fn(async () => ({ data: roomRow, error: null }));
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
    const rpc = vi.fn(async () => ({ data: 1, error: null }));
    mocks.createClient.mockResolvedValue({ from: vi.fn(), rpc });
    const response = await createRoom(request("/api/thinking-rooms", "POST", {
      aggregate: aggregate(),
    }));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ aggregate: aggregate() });
    expect(rpc).toHaveBeenCalledWith("save_thinking_room", expect.objectContaining({
      p_organization_id: organizationId,
      p_room: expect.objectContaining({ facilitator_user_id: ownerId }),
    }));
  });

  it("maps a stale room PUT to 409 without overwriting newer data", async () => {
    mocks.createClient.mockResolvedValue({
      from: vi.fn(),
      rpc: vi.fn(async () => ({
        data: null,
        error: { code: "40001", message: "thinking room revision conflict" },
      })),
    });
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
});

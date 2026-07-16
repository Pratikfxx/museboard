import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthenticatedWorkspace: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/auth/workspace", () => ({ getAuthenticatedWorkspace: mocks.getAuthenticatedWorkspace }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { POST as syncPresence } from "@/app/api/thinking-rooms/[roomId]/presence/route";
import { DELETE as leavePresence } from "@/app/api/thinking-rooms/[roomId]/presence/route";
import { PUT as setClaim } from "@/app/api/thinking-rooms/[roomId]/edit-claim/route";
import { PATCH as editContribution } from "@/app/api/thinking-rooms/[roomId]/contributions/[contributionId]/route";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const roomId = "243e5423-b7f9-46f7-9026-b08b175466da";
const actorId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
const contributionId = "5b5b7c4f-3f88-402f-8ebf-e81880d662d4";
const sessionId = "7ce35c86-0efd-4494-bb05-19af5ceda08c";
const workspace = { userId: actorId, organizationId, role: "editor", displayName: "Maya Chen" };

function request(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function malformedRequest(path: string, method: "POST" | "PUT" | "PATCH" | "DELETE") {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: "{not-json",
  });
}

describe("Thinking Room presence and edit API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedWorkspace.mockResolvedValue(workspace);
  });

  it("allows a viewer heartbeat but rejects draft text and viewer edit claims", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn(), from: vi.fn() });
    const withText = await syncPresence(
      request(`/api/thinking-rooms/${roomId}/presence`, "POST", { sessionId, area: "evidence", isComposing: true, draftText: "secret" }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(withText.status).toBe(400);

    mocks.getAuthenticatedWorkspace.mockResolvedValue({ ...workspace, role: "viewer" });
    const claim = await setClaim(
      request(`/api/thinking-rooms/${roomId}/edit-claim`, "PUT", { contributionId, sessionId, active: true }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(claim.status).toBe(403);
  });

  it("returns only safe normalized presence with no-store semantics", async () => {
    const rpc = vi.fn(async () => ({ data: {
      presence: [{ actor_user_id: actorId, display_name: "Maya Chen", area: "evidence", is_composing: true, expires_at: "2026-07-16T20:00:30.000Z" }],
      claims: [],
    }, error: null }));
    mocks.createClient.mockResolvedValue({ rpc, from: vi.fn() });

    const response = await syncPresence(
      request(`/api/thinking-rooms/${roomId}/presence`, "POST", { sessionId, area: "evidence", isComposing: true }),
      { params: Promise.resolve({ roomId }) },
    );
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(result).toEqual({ presence: [{ actorUserId: actorId, displayName: "Maya Chen", area: "evidence", isComposing: true, expiresAt: "2026-07-16T20:00:30.000Z" }], claims: [] });
    expect(JSON.stringify(result)).not.toContain("session");
  });

  it("maps claim races and revoked contribution edits to typed responses", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "40001", message: "claim conflict" } })
      .mockResolvedValueOnce({ data: null, error: { code: "42501", message: "revoked" } });
    mocks.createClient.mockResolvedValue({ rpc, from: vi.fn() });

    const claim = await setClaim(
      request(`/api/thinking-rooms/${roomId}/edit-claim`, "PUT", { contributionId, sessionId, active: true }),
      { params: Promise.resolve({ roomId }) },
    );
    expect(claim.status).toBe(409);

    const edit = await editContribution(
      request(`/api/thinking-rooms/${roomId}/contributions/${contributionId}`, "PATCH", { sessionId, expectedRevision: 1, body: "Revised note" }),
      { params: Promise.resolve({ roomId, contributionId }) },
    );
    expect(edit.status).toBe(403);
  });

  it("maps malformed JSON and oversized source references to 400", async () => {
    mocks.createClient.mockResolvedValue({ rpc: vi.fn(), from: vi.fn() });
    const cases = [
      syncPresence(malformedRequest(`/api/thinking-rooms/${roomId}/presence`, "POST"), { params: Promise.resolve({ roomId }) }),
      leavePresence(malformedRequest(`/api/thinking-rooms/${roomId}/presence`, "DELETE"), { params: Promise.resolve({ roomId }) }),
      setClaim(malformedRequest(`/api/thinking-rooms/${roomId}/edit-claim`, "PUT"), { params: Promise.resolve({ roomId }) }),
      editContribution(malformedRequest(`/api/thinking-rooms/${roomId}/contributions/${contributionId}`, "PATCH"), { params: Promise.resolve({ roomId, contributionId }) }),
      editContribution(request(`/api/thinking-rooms/${roomId}/contributions/${contributionId}`, "PATCH", {
        sessionId, expectedRevision: 1, body: "Safe body", sourceReferenceId: "x".repeat(2001),
      }), { params: Promise.resolve({ roomId, contributionId }) }),
    ];
    await expect(Promise.all(cases)).resolves.toSatisfy((responses: Response[]) => responses.every(({ status }) => status === 400));
  });
});

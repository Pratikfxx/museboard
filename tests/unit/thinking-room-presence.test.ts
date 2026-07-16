import { describe, expect, it, vi } from "vitest";

import { thinkingRoomPresenceSnapshotSchema } from "@/domain/thinking-room-presence";
import {
  ThinkingCollaborationConflictError,
  createThinkingRoomPresenceRepository,
} from "@/lib/thinking-rooms/presence-repository";

const organizationId = "4f0b3ec4-d507-4726-974c-9b1ea51f73b9";
const roomId = "243e5423-b7f9-46f7-9026-b08b175466da";
const actorId = "8fef70b0-c52b-4312-b6e7-8fac5ed73510";
const sessionId = "7ce35c86-0efd-4494-bb05-19af5ceda08c";

describe("Thinking Room live collaboration domain", () => {
  it("rejects draft text and session identifiers from presence responses", () => {
    expect(() => thinkingRoomPresenceSnapshotSchema.parse({
      presence: [{
        actorUserId: actorId,
        displayName: "Maya Chen",
        area: "evidence",
        isComposing: true,
        expiresAt: "2026-07-16T20:00:30.000Z",
        draftText: "must never leave this browser",
      }],
      claims: [],
      sessionId,
    })).toThrow();
  });

  it("normalizes safe RPC presence and maps claim races to conflicts", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({
        data: {
          presence: [{ actor_user_id: actorId, display_name: "Maya Chen", area: "evidence", is_composing: true, expires_at: "2026-07-16T20:00:30.000Z" }],
          claims: [],
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { code: "40001", message: "claim conflict" } });
    const repository = createThinkingRoomPresenceRepository({ from: vi.fn(), rpc });

    await expect(repository.sync({ organizationId, roomId, sessionId, area: "evidence", isComposing: true }))
      .resolves.toMatchObject({ presence: [{ actorUserId: actorId, area: "evidence", isComposing: true }] });
    await expect(repository.setClaim({ organizationId, roomId, contributionId: actorId, sessionId, active: true }))
      .rejects.toBeInstanceOf(ThinkingCollaborationConflictError);
  });

  it("rejects oversized source references before calling the edit RPC", async () => {
    const rpc = vi.fn();
    const repository = createThinkingRoomPresenceRepository({ from: vi.fn(), rpc });
    await expect(repository.edit({
      organizationId,
      roomId,
      contributionId: actorId,
      sessionId,
      expectedRevision: 1,
      body: "Safe body",
      sourceReferenceId: "x".repeat(2001),
    })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});

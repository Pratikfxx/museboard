import { describe, expect, it } from "vitest";

import {
  assertAuthorizedThinkingRoomMutation,
  ThinkingRoomAuthorizationError,
} from "@/lib/thinking-rooms/authorization";
import type { ThinkingRoomAggregate } from "@/lib/thinking-rooms/repository";

const ownerId = "owner-1";
const editorId = "editor-1";
const decisionOwnerId = "decision-owner-1";
const createdAt = "2026-07-16T09:00:00.000Z";

function aggregate(): ThinkingRoomAggregate {
  return {
    room: {
      id: "room-1",
      organizationId: "org-1",
      workspaceId: "workspace-1",
      question: "Which tension should anchor the next series?",
      templateId: "content-direction",
      status: "synthesizing",
      facilitatorMembershipId: ownerId,
      decisionOwnerMembershipId: decisionOwnerId,
      revision: 2,
      createdAt,
      updatedAt: createdAt,
    },
    contributions: [{
      id: "contribution-1",
      roomId: "room-1",
      lens: "challenges",
      body: "The pattern may become repetitive.",
      authorMembershipId: ownerId,
      authorDisplayNameSnapshot: "Maya Chen",
      revision: 1,
      createdAt,
      updatedAt: createdAt,
    }],
    reactions: [{
      id: "reaction-1",
      roomId: "room-1",
      contributionId: "contribution-1",
      membershipId: ownerId,
      kind: "concern",
      createdAt,
    }],
    links: [{
      id: "link-1",
      roomId: "room-1",
      fromContributionId: "contribution-1",
      toContributionId: "contribution-1",
      relationship: "challenges",
      createdByMembershipId: ownerId,
      resolutionStatus: "open",
      createdAt,
    }],
    synthesisRevisions: [{
      id: "synthesis-1",
      roomId: "room-1",
      number: 1,
      belief: "Constraints can create recognition.",
      unknowns: [],
      confidence: "medium",
      chosenDirection: {
        title: "One constraint, fresh proof",
        audienceTension: "Consistency without repetition.",
        angle: "Keep the format, vary the evidence.",
        evidenceReferenceIds: [],
        basis: "creator_experience",
      },
      openChallengeIds: ["contribution-1"],
      sourceContributionIds: ["contribution-1"],
      createdByMembershipId: ownerId,
      status: "proposed",
      createdAt,
    }],
  };
}

function authorize(
  current: ThinkingRoomAggregate,
  next: ThinkingRoomAggregate,
  actor: { userId: string; role: "owner" | "editor"; displayName: string },
) {
  return assertAuthorizedThinkingRoomMutation({ current, next, actor });
}

describe("Thinking Room full-aggregate authorization", () => {
  it("enforces state-machine transitions and blocks terminal content mutations until reopen", () => {
    const base = aggregate();
    const decided = { ...base, room: { ...base.room, status: "decided" as const } };
    expect(() => authorize(decided, {
      ...decided,
      contributions: [...decided.contributions, {
        ...decided.contributions[0],
        id: "contribution-after-decision",
        authorMembershipId: editorId,
        authorDisplayNameSnapshot: "Editor",
      }],
    }, { userId: editorId, role: "editor", displayName: "Editor" }))
      .toThrow(/reopen/i);

    const exploring = { ...base, room: { ...base.room, status: "exploring" as const } };
    expect(() => authorize(exploring, {
      ...exploring,
      room: { ...exploring.room, status: "decided" as const },
    }, { userId: editorId, role: "editor", displayName: "Editor" }))
      .toThrow(/cannot move/i);
  });
  it("rejects contribution author or display-name impersonation", () => {
    const current = aggregate();
    for (const contribution of [
      { ...current.contributions[0], authorMembershipId: editorId },
      { ...current.contributions[0], authorDisplayNameSnapshot: "Impersonated name" },
    ]) {
      expect(() => authorize(current, {
        ...current,
        contributions: [contribution],
      }, { userId: editorId, role: "editor", displayName: "Editor" }))
        .toThrow(ThinkingRoomAuthorizationError);
    }
  });

  it("freezes every field of an existing contribution in aggregate saves", () => {
    const current = aggregate();
    const existing = current.contributions[0];
    const actor = { userId: editorId, role: "editor" as const, displayName: "Editor" };
    const rewrites = [
      { ...existing, lens: "possibilities" as const },
      { ...existing, body: "Bypassed dedicated edit history" },
      { ...existing, sourceReferenceId: "https://example.com/changed" },
      { ...existing, mentionedMembershipId: editorId },
      { ...existing, relatedContributionId: "another-contribution" },
      { ...existing, revision: existing.revision + 1 },
      { ...existing, updatedAt: "2026-07-16T20:00:00.000Z" },
      { ...existing, deletedAt: "2026-07-16T20:00:00.000Z" },
    ];

    for (const contribution of rewrites) {
      expect(() => authorize(current, { ...current, contributions: [contribution] }, actor))
        .toThrow(/immutable/i);
    }
  });

  it("rejects deletion or rewrite of immutable synthesis, links, and other actors' reactions", () => {
    const current = aggregate();
    const actor = { userId: editorId, role: "editor" as const, displayName: "Editor" };
    for (const next of [
      { ...current, synthesisRevisions: [] },
      { ...current, synthesisRevisions: [{ ...current.synthesisRevisions[0], belief: "Rewritten" }] },
      { ...current, links: [] },
      { ...current, reactions: [] },
      { ...current, reactions: [{ ...current.reactions[0], membershipId: editorId }] },
    ]) {
      expect(() => authorize(current, next, actor)).toThrow(ThinkingRoomAuthorizationError);
    }
  });

  it("allows only a workspace owner to reassign facilitator or decision owner", () => {
    const current = aggregate();
    const next = {
      ...current,
      room: {
        ...current.room,
        facilitatorMembershipId: editorId,
        decisionOwnerMembershipId: editorId,
      },
    };
    expect(() => authorize(current, next, {
      userId: editorId,
      role: "editor",
      displayName: "Editor",
    })).toThrow(ThinkingRoomAuthorizationError);
    expect(authorize(current, next, {
      userId: ownerId,
      role: "owner",
      displayName: "Maya Chen",
    })).toBeUndefined();
  });

  it("allows synthesis acceptance only by the assigned decision owner", () => {
    const current = aggregate();
    const accepted = {
      ...current.synthesisRevisions[0],
      id: "synthesis-2",
      number: 2,
      status: "accepted" as const,
      createdByMembershipId: decisionOwnerId,
      acceptedByMembershipId: decisionOwnerId,
      acceptedAt: "2026-07-16T10:00:00.000Z",
      createdAt: "2026-07-16T10:00:00.000Z",
    };
    const next = { ...current, synthesisRevisions: [...current.synthesisRevisions, accepted] };

    expect(() => authorize(current, next, {
      userId: ownerId,
      role: "owner",
      displayName: "Maya Chen",
    })).toThrow(ThinkingRoomAuthorizationError);
    expect(authorize(current, next, {
      userId: decisionOwnerId,
      role: "editor",
      displayName: "Decision Owner",
    })).toBeUndefined();
  });

  it("attributes new links and durable challenge resolution to the authenticated editor", () => {
    const current = aggregate();
    const actor = { userId: editorId, role: "editor" as const, displayName: "Editor" };
    const impersonatedLink = {
      ...current.links[0],
      id: "link-2",
      createdByMembershipId: ownerId,
    };
    expect(() => authorize(current, {
      ...current,
      links: [...current.links, impersonatedLink],
    }, actor)).toThrow(ThinkingRoomAuthorizationError);

    expect(() => authorize(current, {
      ...current,
      links: [...current.links, {
        ...impersonatedLink,
        createdByMembershipId: editorId,
        resolutionStatus: "resolved",
        resolutionNote: "Born resolved",
        resolvedByMembershipId: editorId,
        resolvedAt: "2026-07-16T10:00:00.000Z",
      }],
    }, actor)).toThrow(ThinkingRoomAuthorizationError);

    const resolved = {
      ...current.links[0],
      resolutionStatus: "resolved" as const,
      resolutionNote: "The new evidence addresses this challenge.",
      resolvedByMembershipId: editorId,
      resolvedAt: "2026-07-16T10:00:00.000Z",
    };
    expect(authorize(current, { ...current, links: [resolved] }, actor)).toBeUndefined();
    expect(() => authorize(current, {
      ...current,
      links: [{ ...resolved, resolvedByMembershipId: ownerId }],
    }, actor)).toThrow(ThinkingRoomAuthorizationError);
  });
});

import { isDeepStrictEqual } from "node:util";

import {
  isThinkingRoomStateTransitionAllowed,
  type ContributionLink,
} from "@/domain/thinking-rooms";
import type { ThinkingRoomAggregate } from "@/lib/thinking-rooms/repository";

export class ThinkingRoomAuthorizationError extends Error {
  constructor(message = "This Thinking Room mutation is not authorized.") {
    super(message);
    this.name = "ThinkingRoomAuthorizationError";
  }
}

interface MutationActor {
  userId: string;
  role: "owner" | "editor";
  displayName: string;
}

function deny(message: string): never {
  throw new ThinkingRoomAuthorizationError(message);
}

function byId<T extends { id: string }>(values: readonly T[]): Map<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function immutableLinkCore(link: ContributionLink) {
  return {
    id: link.id,
    roomId: link.roomId,
    fromContributionId: link.fromContributionId,
    toContributionId: link.toContributionId,
    relationship: link.relationship,
    createdByMembershipId: link.createdByMembershipId,
    createdAt: link.createdAt,
  };
}

export function assertAuthorizedThinkingRoomMutation(input: {
  current: ThinkingRoomAggregate;
  next: ThinkingRoomAggregate;
  actor: MutationActor;
}): void {
  const { actor, current, next } = input;
  if (!isThinkingRoomStateTransitionAllowed(current.room.status, next.room.status)) {
    deny(`Cannot move a Thinking Room from ${current.room.status} to ${next.room.status}.`);
  }
  const collaborationChanged =
    !isDeepStrictEqual(current.contributions, next.contributions) ||
    !isDeepStrictEqual(current.reactions, next.reactions) ||
    !isDeepStrictEqual(current.links, next.links) ||
    !isDeepStrictEqual(current.synthesisRevisions, next.synthesisRevisions);
  if (current.room.status !== next.room.status && collaborationChanged) {
    deny("Reopen the Thinking Room before changing its collaboration records.");
  }
  if (["decided", "converted", "archived"].includes(current.room.status) && collaborationChanged) {
    deny("Reopen the Thinking Room before changing its collaboration records.");
  }
  if (
    current.room.id !== next.room.id ||
    current.room.organizationId !== next.room.organizationId ||
    current.room.createdAt !== next.room.createdAt
  ) {
    deny("Room identity and creation history are immutable.");
  }
  if (
    (current.room.facilitatorMembershipId !== next.room.facilitatorMembershipId ||
      current.room.decisionOwnerMembershipId !== next.room.decisionOwnerMembershipId) &&
    actor.role !== "owner"
  ) {
    deny("Only a workspace owner may reassign room ownership.");
  }

  const nextContributions = byId(next.contributions);
  for (const existing of current.contributions) {
    const candidate = nextContributions.get(existing.id);
    if (!candidate) deny("Contribution history cannot be deleted.");
    if (!isDeepStrictEqual(existing, candidate)) {
      deny("Existing contributions are immutable through aggregate saves; use the dedicated edit flow.");
    }
  }
  const currentContributions = byId(current.contributions);
  for (const contribution of next.contributions) {
    if (!currentContributions.has(contribution.id) && (
      contribution.authorMembershipId !== actor.userId ||
      contribution.authorDisplayNameSnapshot !== actor.displayName
    )) {
      deny("New contributions must be attributed to the authenticated user.");
    }
  }

  const currentReactions = byId(current.reactions);
  const nextReactions = byId(next.reactions);
  for (const existing of current.reactions) {
    const candidate = nextReactions.get(existing.id);
    if (existing.membershipId !== actor.userId && !isDeepStrictEqual(candidate, existing)) {
      deny("An actor may not delete or rewrite another member's reaction.");
    }
    if (candidate && !isDeepStrictEqual(candidate, existing)) {
      deny("Existing reaction history is immutable.");
    }
  }
  for (const reaction of next.reactions) {
    if (!currentReactions.has(reaction.id) && reaction.membershipId !== actor.userId) {
      deny("New reactions must be attributed to the authenticated user.");
    }
  }

  const currentSyntheses = byId(current.synthesisRevisions);
  const nextSyntheses = byId(next.synthesisRevisions);
  const appendedAccepted = next.synthesisRevisions.filter((revision) =>
    !currentSyntheses.has(revision.id) && revision.status === "accepted",
  );
  for (const existing of current.synthesisRevisions) {
    const candidate = nextSyntheses.get(existing.id);
    const atomicallySuperseded = existing.status === "accepted" &&
      candidate?.status === "superseded" &&
      appendedAccepted.length === 1 &&
      isDeepStrictEqual(
        { ...candidate, status: "accepted", acceptedAt: existing.acceptedAt, acceptedByMembershipId: existing.acceptedByMembershipId },
        existing,
      );
    if (!isDeepStrictEqual(candidate, existing) && !atomicallySuperseded) {
      deny("Synthesis revisions are append-only.");
    }
  }
  for (const revision of next.synthesisRevisions) {
    if (currentSyntheses.has(revision.id)) continue;
    if (revision.createdByMembershipId !== actor.userId) {
      deny("New synthesis revisions must identify their creator.");
    }
    if (revision.status === "accepted" && (
      actor.userId !== next.room.decisionOwnerMembershipId ||
      revision.acceptedByMembershipId !== actor.userId
    )) {
      deny("Only the assigned decision owner may accept a synthesis.");
    }
  }

  const currentLinks = byId(current.links);
  const nextLinks = byId(next.links);
  for (const existing of current.links) {
    const candidate = nextLinks.get(existing.id);
    if (!candidate) deny("Contribution-link history cannot be deleted.");
    if (isDeepStrictEqual(candidate, existing)) continue;
    if (
      existing.resolutionStatus !== "open" ||
      candidate.resolutionStatus !== "resolved" ||
      !isDeepStrictEqual(immutableLinkCore(existing), immutableLinkCore(candidate)) ||
      candidate.resolvedByMembershipId !== actor.userId
    ) {
      deny("A contribution link may only transition once from open to resolved.");
    }
  }
  for (const link of next.links) {
    if (currentLinks.has(link.id)) continue;
    if (
      link.createdByMembershipId !== actor.userId ||
      link.resolutionStatus !== "open" ||
      link.resolutionNote ||
      link.resolvedByMembershipId ||
      link.resolvedAt
    ) {
      deny("New contribution links must start open and attributed to the authenticated user.");
    }
  }
}

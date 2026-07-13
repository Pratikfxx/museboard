import { z } from "zod";

import { PLAN_CATALOG, type Plan } from "@/domain/entitlements";
import { workflowStageSchema, type WorkflowStage } from "@/domain/schema";

export const MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
export const MEMBER_STATUSES = [
  "pending",
  "active",
  "declined",
  "revoked",
  "expired",
  "removed",
] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export interface Membership {
  id: string;
  email: string;
  displayNameSnapshot: string;
  role: MemberRole;
  status: MemberStatus;
  invitedAt: string;
  expiresAt?: string;
  joinedAt?: string;
  removedAt?: string;
}

export interface StageAssignment {
  id: string;
  contentId: string;
  stage: WorkflowStage;
  versionId: string;
  assigneeMembershipId?: string;
  reviewerMembershipId?: string;
  updatedAt: string;
}

export interface ReviewComment {
  id: string;
  contentId: string;
  versionId: string;
  stage: WorkflowStage;
  authorMembershipId: string;
  authorDisplayNameSnapshot: string;
  body: string;
  mentionedMembershipIds: string[];
  createdAt: string;
  resolvedAt?: string;
  reopenedAt?: string;
}

export interface CommentStatusEvent {
  id: string;
  commentId: string;
  action: "resolved" | "reopened";
  actorMembershipId: string;
  actorDisplayNameSnapshot: string;
  createdAt: string;
}

export const APPROVAL_EVENT_STATUSES = [
  "requested",
  "approved",
  "changes_requested",
  "stale",
] as const;
export type ApprovalEventStatus = (typeof APPROVAL_EVENT_STATUSES)[number];

export interface ApprovalEvent {
  id: string;
  contentId: string;
  versionId: string;
  status: ApprovalEventStatus;
  actorMembershipId: string;
  actorDisplayNameSnapshot: string;
  requesterMembershipId?: string;
  reviewerMembershipId?: string;
  createdAt: string;
  note?: string;
}

export type NotificationKind = "assignment" | "mention" | "review" | "invite" | "member";

export interface CollaborationNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  href: string;
  recipientMembershipId?: string;
  createdAt: string;
  readAt?: string;
}

export const membershipSchema: z.ZodType<Membership> = z.object({
  id: z.string().min(1),
  email: z.email(),
  displayNameSnapshot: z.string().min(1),
  role: z.enum(MEMBER_ROLES),
  status: z.enum(MEMBER_STATUSES),
  invitedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().optional(),
  joinedAt: z.iso.datetime().optional(),
  removedAt: z.iso.datetime().optional(),
});

export const stageAssignmentSchema: z.ZodType<StageAssignment> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  stage: workflowStageSchema,
  versionId: z.string().min(1),
  assigneeMembershipId: z.string().min(1).optional(),
  reviewerMembershipId: z.string().min(1).optional(),
  updatedAt: z.iso.datetime(),
});

export const commentStatusEventSchema: z.ZodType<CommentStatusEvent> = z.object({
  id: z.string().min(1),
  commentId: z.string().min(1),
  action: z.enum(["resolved", "reopened"]),
  actorMembershipId: z.string().min(1),
  actorDisplayNameSnapshot: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export const reviewCommentSchema: z.ZodType<ReviewComment> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  stage: workflowStageSchema,
  authorMembershipId: z.string().min(1),
  authorDisplayNameSnapshot: z.string().min(1),
  body: z.string().trim().min(1),
  mentionedMembershipIds: z.array(z.string().min(1)),
  createdAt: z.iso.datetime(),
  resolvedAt: z.iso.datetime().optional(),
  reopenedAt: z.iso.datetime().optional(),
});

export const approvalEventSchema: z.ZodType<ApprovalEvent> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  versionId: z.string().min(1),
  status: z.enum(APPROVAL_EVENT_STATUSES),
  actorMembershipId: z.string().min(1),
  actorDisplayNameSnapshot: z.string().min(1),
  requesterMembershipId: z.string().min(1).optional(),
  reviewerMembershipId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  note: z.string().trim().min(1).optional(),
});

export const collaborationNotificationSchema: z.ZodType<CollaborationNotification> = z.object({
  id: z.string().min(1),
  kind: z.enum(["assignment", "mention", "review", "invite", "member"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  href: z.string().startsWith("/app/"),
  recipientMembershipId: z.string().min(1).optional(),
  createdAt: z.iso.datetime(),
  readAt: z.iso.datetime().optional(),
});

export function invitationExpiresAt(invitedAt: string): string {
  const expiresAt = new Date(invitedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 7);
  return expiresAt.toISOString();
}

export function effectiveMemberStatus(member: Membership, at = new Date().toISOString()): MemberStatus {
  if (member.status === "pending" && member.expiresAt && member.expiresAt <= at) return "expired";
  return member.status;
}

export function activeActor(memberships: Membership[], currentActorMembershipId: string, at = new Date().toISOString()): Membership | undefined {
  return memberships.find(
    (member) => member.id === currentActorMembershipId && effectiveMemberStatus(member, at) === "active",
  );
}

export function isCommentResolved(comment: ReviewComment, events: CommentStatusEvent[]): boolean {
  const latest = [...events].reverse().find(({ commentId }) => commentId === comment.id);
  if (latest) return latest.action === "resolved";
  return Boolean(comment.resolvedAt && (!comment.reopenedAt || comment.resolvedAt > comment.reopenedAt));
}

export function occupiedSeatCount(memberships: Membership[], at = new Date().toISOString()): number {
  return memberships.filter((member) => {
    const status = effectiveMemberStatus(member, at);
    return status === "active" || status === "pending";
  }).length;
}

export function seatLimitMessage(plan: Plan): string {
  const entry = PLAN_CATALOG[plan];
  const prefix = `${entry.name} includes ${entry.members} member${entry.members === 1 ? "" : "s"} including the owner.`;
  if (plan === "studio") return `${prefix} Remove or revoke an occupied seat before inviting someone else.`;
  if (plan === "pro") return `${prefix} Upgrade to Studio for 6 seats.`;
  return `${prefix} Upgrade to Pro for 2 seats or Studio for 6.`;
}

export function canInviteMember(plan: Plan, memberships: Membership[], at?: string) {
  const occupied = occupiedSeatCount(memberships, at);
  const limit = PLAN_CATALOG[plan].members;
  return {
    allowed: occupied < limit,
    occupied,
    limit,
    message: seatLimitMessage(plan),
  };
}

export function assignmentHref(assignment: StageAssignment): string {
  return `/app/create/${assignment.contentId}?stage=${assignment.stage}&version=${assignment.versionId}&assignment=${assignment.id}`;
}

export function mentionHref(comment: ReviewComment): string {
  return `/app/create/${comment.contentId}?stage=${comment.stage}&version=${comment.versionId}&comment=${comment.id}`;
}

export function approvalHref(event: ApprovalEvent): string {
  return `/app/create/${event.contentId}?stage=review&version=${event.versionId}&approval=${event.id}`;
}

export function teamHref(id: string, kind: "invite" | "member"): string {
  return `/app/team?tab=people&${kind}=${id}`;
}

export function notificationHref(href: string, notificationId: string): string {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}notification=${encodeURIComponent(notificationId)}`;
}

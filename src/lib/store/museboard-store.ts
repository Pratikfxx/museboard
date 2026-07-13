"use client";

import { z } from "zod";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";

import {
  deriveLearnings,
  metricSampleDedupKey,
  metricSamplesSchema,
} from "@/domain/analytics";
import {
  approvalEventSchema,
  approvalHref,
  canInviteMember,
  collaborationNotificationSchema,
  membershipSchema,
  mentionHref,
  notificationHref,
  reviewCommentSchema,
  stageAssignmentSchema,
  teamHref,
  type ApprovalEvent,
  type MemberRole,
  type MemberStatus,
  type Membership,
  type ReviewComment,
} from "@/domain/collaboration";
import {
  commitEntitlement,
  entitlementUsageSchema,
  releaseEntitlement,
  reserveEntitlement,
  type EntitlementDecision,
} from "@/domain/entitlements";
import { buildExportManifest, exportManifestSchema } from "@/domain/export";
import {
  ideaRecordSchema,
  opportunitySchema,
  visionReferenceSchema,
} from "@/domain/opportunities";
import type { VisionReference } from "@/domain/opportunities";
import { plannerTaskSchema, type PlannerTask } from "@/domain/planner";
import {
  commentSchema,
  contentPlatformSchema,
  contentItemSchema,
  creatorArchetypeSchema,
  dataModeSchema,
  hookOptionSchema,
  learningSchema,
  publishReceiptSchema,
  workflowStageSchema,
} from "@/domain/schema";
import type { PublishReceipt, WorkflowStage } from "@/domain/schema";
import {
  saveVersionAndAdvance,
  transitionStage,
  type WorkshopVersionPatch,
} from "@/domain/workflow";
import {
  CREATOR_OUTCOMES,
  createDemoState,
  type CreatorProfile,
  type DemoMuseboardData,
  type PlannerUndo,
  type StarterWorkspace,
} from "@/lib/demo/fixtures";
import {
  createIdeaFromOpportunity,
  findDuplicateReference,
  validateVisionReference,
  type VisionReferenceInput,
} from "@/lib/providers/opportunities";

export const MUSEBOARD_STORAGE_KEY = "museboard-demo-v1";
const fallbackStorage = new Map<string, string>();
const creatorOutcomeSchema = z.enum(CREATOR_OUTCOMES);

const safeStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      const value = window.localStorage.getItem(name);
      if (value === null) {
        fallbackStorage.delete(name);
      } else {
        fallbackStorage.set(name, value);
      }
      return value;
    } catch {
      return fallbackStorage.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    fallbackStorage.set(name, value);
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // The in-memory copy keeps the current workspace usable in this tab.
    }
  },
  removeItem: (name) => {
    fallbackStorage.delete(name);
    try {
      window.localStorage.removeItem(name);
    } catch {
      // The in-memory copy is already cleared.
    }
  },
};

const creatorProfileSchema: z.ZodType<CreatorProfile> = z.object({
  name: z.string().trim().min(1),
  outcome: creatorOutcomeSchema,
  archetype: creatorArchetypeSchema,
  archetypes: z.array(creatorArchetypeSchema).min(1),
  audience: z.string().trim().min(1),
  platforms: z.array(contentPlatformSchema).min(1),
  weeklyCapacityMinutes: z.number().int().positive(),
  voiceTraits: z.array(z.string().trim().min(1)).min(1),
  boundaries: z.array(z.string().trim().min(1)).min(1),
  contentPillars: z.tuple([
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
  ]),
  timezone: z.string().min(1).optional(),
  recoveryDays: z.array(z.number().int().min(0).max(6)).optional(),
});

const starterWorkspaceSchema: z.ZodType<StarterWorkspace> = z
  .object({
    creator: creatorProfileSchema,
    opportunities: z.array(opportunitySchema).length(5),
    selectedOpportunityId: z.string().min(1),
    hooks: z.array(hookOptionSchema).length(3),
    content: z.array(contentItemSchema).length(1),
    plannerTasks: z.array(plannerTaskSchema).min(1),
  })
  .superRefine((workspace, context) => {
    const { creator, content, hooks, opportunities, plannerTasks } = workspace;
    const [starterContent] = content;
    const selectedOpportunity = opportunities.find(
      ({ id }) => id === workspace.selectedOpportunityId,
    );

    if (!creator.archetypes.includes(creator.archetype)) {
      context.addIssue({
        code: "custom",
        message: "Primary archetype must be included in creator archetypes",
        path: ["creator", "archetypes"],
      });
    }
    if (!selectedOpportunity) {
      context.addIssue({
        code: "custom",
        message: "Selected opportunity must exist in the starter opportunities",
        path: ["selectedOpportunityId"],
      });
    }
    if (
      opportunities.some(
        ({ archetypes, platform }) =>
          !archetypes.includes(creator.archetype) ||
          !creator.platforms.includes(platform),
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Starter opportunities must match creator archetype and platforms",
        path: ["opportunities"],
      });
    }
    if (
      starterContent.archetype !== creator.archetype ||
      starterContent.opportunityId !== workspace.selectedOpportunityId
    ) {
      context.addIssue({
        code: "custom",
        message: "Starter content must use the creator archetype and selected opportunity",
        path: ["content", 0],
      });
    }
    if (
      hooks.some(({ contentId }) => contentId !== starterContent.id) ||
      !hooks.some(
        ({ id }) => id === starterContent.versions[0].selectedHookId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "All starter hooks must belong to the personalized content",
        path: ["hooks"],
      });
    }

    const weekStart = new Date(starterContent.createdAt).getTime();
    const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
    const scheduledMinutes = plannerTasks.reduce(
      (total, { estimatedMinutes }) => total + estimatedMinutes,
      0,
    );
    if (
      scheduledMinutes > creator.weeklyCapacityMinutes * 0.8 ||
      plannerTasks.some(({ contentId, scheduledFor }) => {
        const scheduledAt = new Date(scheduledFor ?? "").getTime();
        return (
          contentId !== starterContent.id ||
          !Number.isFinite(scheduledAt) ||
          scheduledAt < weekStart ||
          scheduledAt >= weekEnd
        );
      })
    ) {
      context.addIssue({
        code: "custom",
        message: "Starter planner tasks must form a feasible seven-day schedule",
        path: ["plannerTasks"],
      });
    }
  });

const persistedMuseboardSchema: z.ZodType<DemoMuseboardData> = z.object({
  schemaVersion: z.literal(1),
  dataMode: dataModeSchema,
  onboardingComplete: z.boolean(),
  creator: creatorProfileSchema.optional(),
  opportunities: z.array(opportunitySchema),
  selectedOpportunityId: z.string().min(1).optional(),
  opportunityDecisions: z
    .record(z.string(), z.enum(["saved", "dismissed"]))
    .default({}),
  ideas: z.array(ideaRecordSchema).default([]),
  visionReferences: z.array(visionReferenceSchema).default([]),
  selectedReferenceIds: z.array(z.string().min(1)).default([]),
  hooks: z.array(hookOptionSchema),
  content: z.array(contentItemSchema),
  plannerTasks: z.array(plannerTaskSchema),
  plannerUndo: z
    .object({
      taskId: z.string().min(1),
      before: plannerTaskSchema,
      after: plannerTaskSchema,
      label: z.string().min(1),
    })
    .optional(),
  comments: z.array(commentSchema),
  exports: z.array(exportManifestSchema),
  publishReceipts: z.array(publishReceiptSchema),
  metrics: metricSamplesSchema,
  learnings: z.array(learningSchema),
  entitlementUsage: entitlementUsageSchema,
  memberships: z.array(membershipSchema).default([]),
  currentActorMembershipId: z.string().min(1).default("member-owner"),
  assignments: z.array(stageAssignmentSchema).default([]),
  reviewComments: z.array(reviewCommentSchema).default([]),
  approvals: z.array(approvalEventSchema).default([]),
  notifications: z.array(collaborationNotificationSchema).default([]),
});

export function validatePersistedMuseboardData(payload: unknown) {
  return persistedMuseboardSchema.safeParse(upgradePersistedMuseboardData(payload));
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function futureIso(value: unknown): string {
  const start =
    typeof value === "string" && Number.isFinite(new Date(value).getTime())
      ? new Date(value)
      : new Date("2026-07-13T09:00:00.000Z");
  start.setUTCDate(start.getUTCDate() + 7);
  return start.toISOString();
}

export function upgradePersistedMuseboardData(payload: unknown): unknown {
  const state = recordValue(payload);
  if (!state || !Array.isArray(state.opportunities)) return payload;
  const creator = recordValue(state.creator);
  const contentPillars = Array.isArray(creator?.contentPillars)
    ? creator.contentPillars
    : [];
  const memberships = Array.isArray(state.memberships)
    ? state.memberships
    : [
        ownerMembership(
          typeof creator?.name === "string" ? creator.name : "Workspace owner",
          "2026-07-13T09:00:00.000Z",
        ),
      ];
  const legacyOwner = memberships.find(
    (member) => recordValue(member)?.role === "owner",
  );
  const legacyOwnerId = recordValue(legacyOwner)?.id;

  return {
    ...state,
    memberships,
    currentActorMembershipId:
      typeof state.currentActorMembershipId === "string"
        ? state.currentActorMembershipId
        : typeof legacyOwnerId === "string"
          ? legacyOwnerId
          : "member-owner",
    assignments: Array.isArray(state.assignments) ? state.assignments : [],
    reviewComments: Array.isArray(state.reviewComments) ? state.reviewComments : [],
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    opportunities: state.opportunities.map((value) => {
      const opportunity = recordValue(value);
      if (!opportunity) return value;
      const provenance = recordValue(opportunity.provenance) ?? {};
      const provider =
        typeof provenance.provider === "string"
          ? provenance.provider
          : "Museboard saved sample";
      const fetchedAt =
        typeof provenance.fetchedAt === "string"
          ? provenance.fetchedAt
          : "2026-07-13T09:00:00.000Z";
      const sourceLabel =
        typeof provenance.sourceLabel === "string"
          ? provenance.sourceLabel
          : provider;
      return {
        format: "tutorial",
        pillar:
          typeof contentPillars[0] === "string"
            ? contentPillars[0]
            : "Creator practice",
        readiness: "shape",
        goal: "trust",
        geography: "Global",
        evidence: [
          {
            summary:
              "Legacy sample opportunity restored from this browser; source detail may be incomplete.",
            sourceLabel,
          },
        ],
        ...opportunity,
        provenance: {
          sourceClass: "creator_submission",
          sourceLabel,
          observedAt: fetchedAt,
          expiresAt: futureIso(fetchedAt),
          ...provenance,
        },
      };
    }),
  };
}

interface MuseboardActions {
  resetDemo: () => void;
  completeOnboarding: (workspace: StarterWorkspace) => void;
  selectOpportunity: (opportunityId: string) => void;
  saveOpportunity: (opportunityId: string) => void;
  dismissOpportunity: (opportunityId: string) => void;
  restoreOpportunity: (opportunityId: string) => void;
  shapeOpportunity: (opportunityId: string, at?: string) => string | undefined;
  promoteIdea: (ideaId: string, at?: string) => string | undefined;
  addVisionReference: (
    input: VisionReferenceInput,
    at?: string,
  ) =>
    | { ok: true; id: string; reused: boolean }
    | { ok: false; error: string };
  removeVisionReference: (referenceId: string) => void;
  toggleReferenceSelection: (referenceId: string) => boolean;
  saveWorkshopVersion: (input: {
    contentId: string;
    patch: WorkshopVersionPatch;
    nextStage?: WorkflowStage;
    at?: string;
  }) => boolean;
  moveTask: (contentId: string, stage: WorkflowStage, at?: string) => void;
  reschedulePlannerTask: (
    taskId: string,
    scheduledFor: string,
    timezone?: string,
  ) => boolean;
  updatePlannerTaskStatus: (
    taskId: string,
    status: NonNullable<PlannerTask["status"]>,
  ) => boolean;
  undoPlannerChange: () => boolean;
  reserveStrategistPack: () => EntitlementDecision;
  commitStrategistPack: () => void;
  releaseStrategistPack: () => void;
  inviteMember: (
    email: string,
    role: Exclude<MemberRole, "owner">,
    at?: string,
  ) =>
    | { ok: true; id: string; delivery: "not_sent" }
    | { ok: false; reason: "seat_limit" | "invalid"; message: string };
  updateInvitationStatus: (memberId: string, status: Extract<MemberStatus, "active" | "declined" | "revoked" | "expired">, at?: string) => boolean;
  resendInvitation: (memberId: string, at?: string) => { ok: boolean; delivery: "not_sent" };
  switchDemoActor: (memberId: string) => boolean;
  removeMember: (memberId: string, at?: string) => boolean;
  transferOwnership: (memberId: string, at?: string) => boolean;
  assignStage: (input: { contentId: string; stage: WorkflowStage; assigneeMembershipId?: string; reviewerMembershipId?: string; at?: string }) => boolean;
  addReviewComment: (contentId: string, body: string, at?: string) => boolean;
  toggleReviewComment: (commentId: string, at?: string) => boolean;
  requestApproval: (contentId: string, reviewerMembershipId: string, at?: string) => boolean;
  decideApproval: (contentId: string, decision: "approved" | "changes_requested", note?: string, at?: string) => boolean;
  openNotification: (notificationId: string, href: string, at?: string) => boolean;
  createExport: (contentId: string, requestedBy?: string, at?: string) => string | undefined;
  recordPublishReceipt: (receipt: unknown) => boolean;
  importMetrics: (metrics: unknown) => boolean;
  dismissLearning: (learningId: string, at?: string) => void;
}

export type MuseboardState = DemoMuseboardData & MuseboardActions;

function now(): string {
  return new Date().toISOString();
}

function ownerMembership(displayName: string, at = now()): Membership {
  return {
    id: "member-owner",
    email: "owner@museboard.local",
    displayNameSnapshot: displayName,
    role: "owner",
    status: "active",
    invitedAt: at,
    joinedAt: at,
  };
}

function memberNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.replace(/[._-]+/gu, " ").trim();
  if (!local) return "Invited collaborator";
  return local.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function collaborationEnabled(state: Pick<MuseboardState, "entitlementUsage">): boolean {
  return state.entitlementUsage.plan === "pro" || state.entitlementUsage.plan === "studio";
}

function persistedState(state: MuseboardState): DemoMuseboardData {
  return {
    schemaVersion: state.schemaVersion,
    dataMode: state.dataMode,
    onboardingComplete: state.onboardingComplete,
    creator: state.creator,
    opportunities: state.opportunities,
    selectedOpportunityId: state.selectedOpportunityId,
    opportunityDecisions: state.opportunityDecisions,
    ideas: state.ideas,
    visionReferences: state.visionReferences,
    selectedReferenceIds: state.selectedReferenceIds,
    hooks: state.hooks,
    content: state.content,
    plannerTasks: state.plannerTasks,
    plannerUndo: state.plannerUndo,
    comments: state.comments,
    exports: state.exports,
    publishReceipts: state.publishReceipts,
    metrics: state.metrics,
    learnings: state.learnings,
    entitlementUsage: state.entitlementUsage,
    memberships: state.memberships,
    currentActorMembershipId: state.currentActorMembershipId,
    assignments: state.assignments,
    reviewComments: state.reviewComments,
    approvals: state.approvals,
    notifications: state.notifications,
  };
}

export const useMuseboardStore = create<MuseboardState>()(
  persist<MuseboardState, [], [], DemoMuseboardData>(
    (set, get) => ({
      ...createDemoState(),

      resetDemo: () => set(createDemoState()),

      completeOnboarding: (workspace) => {
        const parsed = starterWorkspaceSchema.parse(workspace);
        const onboardingAt = parsed.content[0]?.createdAt ?? now();
        set({
          onboardingComplete: true,
          creator: parsed.creator,
          opportunities: parsed.opportunities,
          selectedOpportunityId: parsed.selectedOpportunityId,
          opportunityDecisions: {},
          ideas: [],
          visionReferences: [],
          selectedReferenceIds: [],
          hooks: parsed.hooks,
          content: parsed.content,
          plannerTasks: parsed.plannerTasks,
          plannerUndo: undefined,
          comments: [],
          memberships: [ownerMembership(parsed.creator.name, onboardingAt)],
          currentActorMembershipId: "member-owner",
          assignments: [],
          reviewComments: [],
          approvals: [],
          notifications: [],
          entitlementUsage: {
            plan: "free",
            used: {},
            reserved: {},
            resetAt: get().entitlementUsage.resetAt,
          },
        });
      },

      selectOpportunity: (opportunityId) => {
        if (!get().opportunities.some(({ id }) => id === opportunityId)) return;
        set({ selectedOpportunityId: opportunityId });
      },

      saveOpportunity: (opportunityId) => {
        if (!get().opportunities.some(({ id }) => id === opportunityId)) return;
        set((state) => ({
          opportunityDecisions: {
            ...state.opportunityDecisions,
            [opportunityId]: "saved",
          },
        }));
      },

      dismissOpportunity: (opportunityId) => {
        if (!get().opportunities.some(({ id }) => id === opportunityId)) return;
        set((state) => ({
          opportunityDecisions: {
            ...state.opportunityDecisions,
            [opportunityId]: "dismissed",
          },
        }));
      },

      restoreOpportunity: (opportunityId) => {
        set((state) => {
          const opportunityDecisions = { ...state.opportunityDecisions };
          delete opportunityDecisions[opportunityId];
          return { opportunityDecisions };
        });
      },

      shapeOpportunity: (opportunityId, at = now()) => {
        const state = get();
        if (state.opportunityDecisions[opportunityId] === "dismissed") {
          return undefined;
        }
        const existing = state.ideas.find(
          (idea) => idea.opportunityId === opportunityId,
        );
        if (existing) return existing.id;
        const opportunity = state.opportunities.find(
          ({ id }) => id === opportunityId,
        );
        if (!opportunity) return undefined;
        const idea = createIdeaFromOpportunity(opportunity, at);
        set((current) => ({ ideas: [...current.ideas, idea] }));
        return idea.id;
      },

      promoteIdea: (ideaId, at = now()) => {
        const state = get();
        const idea = state.ideas.find(({ id }) => id === ideaId);
        if (!idea) return undefined;
        if (
          idea.promotedContentId &&
          state.content.some(({ id }) => id === idea.promotedContentId)
        ) {
          return idea.promotedContentId;
        }
        const contentId = idea.promotedContentId ?? `content-from-${idea.id}`;
        const existing = state.content.find(({ id }) => id === contentId);
        if (existing) return existing.id;
        const opportunity = state.opportunities.find(
          ({ id }) => id === idea.opportunityId,
        );
        const versionId = `${contentId}-v1`;
        const item = contentItemSchema.parse({
          id: contentId,
          title: idea.title,
          platform: idea.platform,
          archetype:
            opportunity?.archetypes.find((archetype) =>
              state.creator?.archetypes.includes(archetype),
            ) ?? opportunity?.archetypes[0] ?? "tech_education",
          stage: "angle",
          currentVersionId: versionId,
          opportunityId: idea.opportunityId,
          versions: [
            {
              id: versionId,
              contentId,
              number: 1,
              angle: idea.summary,
              script: "",
              createdAt: at,
            },
          ],
          createdAt: at,
          updatedAt: at,
        });
        set((current) => ({
          content: [...current.content, item],
          ideas: current.ideas.map((candidate) =>
            candidate.id === ideaId
              ? { ...candidate, promotedContentId: contentId }
              : candidate,
          ),
        }));
        return contentId;
      },

      addVisionReference: (input, at = now()) => {
        const state = get();
        const baseValidation = validateVisionReference(input);
        if (!baseValidation.ok) return baseValidation;
        const duplicate = findDuplicateReference(
          state.visionReferences,
          baseValidation.input,
        );
        if (duplicate) return { ok: true, id: duplicate.id, reused: true };
        const usedBytes = state.visionReferences.reduce(
          (total, reference) => total + reference.sizeBytes,
          0,
        );
        const validation = validateVisionReference(
          baseValidation.input,
          usedBytes,
        );
        if (!validation.ok) return validation;
        const parsedReference = visionReferenceSchema.safeParse({
          ...validation.input,
          id: `reference-${validation.input.sha256.slice(0, 16)}`,
          addedAt: at,
          provenance: { provider: "museboard-local", mode: "sample" },
        });
        if (!parsedReference.success) {
          return {
            ok: false,
            error:
              parsedReference.error.issues[0]?.message ??
              "Reference metadata could not be saved.",
          };
        }
        const reference: VisionReference = parsedReference.data;
        set((current) => ({
          visionReferences: [...current.visionReferences, reference],
        }));
        return { ok: true, id: reference.id, reused: false };
      },

      removeVisionReference: (referenceId) => {
        set((state) => ({
          visionReferences: state.visionReferences.filter(
            ({ id }) => id !== referenceId,
          ),
          selectedReferenceIds: state.selectedReferenceIds.filter(
            (id) => id !== referenceId,
          ),
        }));
      },

      toggleReferenceSelection: (referenceId) => {
        const state = get();
        const reference = state.visionReferences.find(
          ({ id }) => id === referenceId,
        );
        if (!reference || reference.rightsStatus === "unknown") return false;
        set((current) => ({
          selectedReferenceIds: current.selectedReferenceIds.includes(referenceId)
            ? current.selectedReferenceIds.filter((id) => id !== referenceId)
            : [...current.selectedReferenceIds, referenceId],
        }));
        return true;
      },

      saveWorkshopVersion: ({ contentId, patch, nextStage, at = now() }) => {
        const stateBefore = get();
        const item = stateBefore.content.find(({ id }) => id === contentId);
        if (!item) return false;
        const updated = saveVersionAndAdvance(item, patch, at, nextStage);
        if (updated === item) return false;
        const latestApproval = [...stateBefore.approvals]
          .reverse()
          .find(({ contentId: eventContentId, versionId }) =>
            eventContentId === contentId && versionId === item.currentVersionId,
          );
        const shouldAppendStale =
          latestApproval !== undefined && latestApproval.status !== "stale";
        const activeOwner = stateBefore.memberships.find(
          ({ role, status }) => role === "owner" && status === "active",
        );
        const staleEvent: ApprovalEvent | undefined = shouldAppendStale
          ? approvalEventSchema.parse({
              id: `${contentId}-approval-${stateBefore.approvals.length + 1}`,
              contentId,
              versionId: item.currentVersionId,
              status: "stale",
              actorMembershipId: activeOwner?.id ?? "member-owner",
              actorDisplayNameSnapshot: activeOwner?.displayNameSnapshot ?? "Workspace owner",
              requesterMembershipId: latestApproval?.requesterMembershipId,
              reviewerMembershipId: latestApproval?.reviewerMembershipId,
              createdAt: at,
              note: "The draft changed after review.",
            })
          : undefined;
        set((state) => ({
          content: state.content.map((candidate) =>
            candidate.id === contentId ? updated : candidate,
          ),
          approvals: staleEvent ? [...state.approvals, staleEvent] : state.approvals,
        }));
        return true;
      },

      moveTask: (contentId, stage, at = now()) => {
        const parsedStage = workflowStageSchema.parse(stage);
        set((state) => ({
          content: state.content.map((item) =>
            item.id === contentId
              ? transitionStage(item, { type: "MOVE", stage: parsedStage, at })
              : item,
          ),
        }));
      },

      reschedulePlannerTask: (taskId, scheduledFor, timezone) => {
        const parsedDate = z.iso.datetime().safeParse(scheduledFor);
        const task = get().plannerTasks.find(({ id }) => id === taskId);
        if (!parsedDate.success || !task) return false;
        const after: PlannerTask = {
          ...task,
          scheduledFor: parsedDate.data,
          dueAt: task.dueAt ?? parsedDate.data,
          timezone: timezone ?? task.timezone,
          status: task.status === "missed" ? "planned" : (task.status ?? "planned"),
        };
        const undo: PlannerUndo = {
          taskId,
          before: task,
          after,
          label: `Moved ${task.title}`,
        };
        set((state) => ({
          plannerTasks: state.plannerTasks.map((candidate) =>
            candidate.id === taskId ? after : candidate,
          ),
          plannerUndo: undo,
        }));
        return true;
      },

      updatePlannerTaskStatus: (taskId, status) => {
        const parsedStatus = z
          .enum(["planned", "in_progress", "done", "missed", "cancelled"])
          .safeParse(status);
        const task = get().plannerTasks.find(({ id }) => id === taskId);
        if (!parsedStatus.success || !task) return false;
        const after = { ...task, status: parsedStatus.data };
        set((state) => ({
          plannerTasks: state.plannerTasks.map((candidate) =>
            candidate.id === taskId ? after : candidate,
          ),
          plannerUndo: {
            taskId,
            before: task,
            after,
            label: `Updated ${task.title}`,
          },
        }));
        return true;
      },

      undoPlannerChange: () => {
        const undo = get().plannerUndo;
        if (!undo) return false;
        set((state) => ({
          plannerTasks: state.plannerTasks.map((task) =>
            task.id === undo.taskId ? undo.before : task,
          ),
          plannerUndo: undefined,
        }));
        return true;
      },

      reserveStrategistPack: () => {
        const reservation = reserveEntitlement(
          get().entitlementUsage,
          "strategist_pack",
        );
        if (reservation.decision.allowed) {
          set({ entitlementUsage: reservation.usage });
        }
        return reservation.decision;
      },

      commitStrategistPack: () => {
        if ((get().entitlementUsage.reserved.strategist_pack ?? 0) < 1) return;
        set({
          entitlementUsage: commitEntitlement(
            get().entitlementUsage,
            "strategist_pack",
          ),
        });
      },

      releaseStrategistPack: () => {
        if ((get().entitlementUsage.reserved.strategist_pack ?? 0) < 1) return;
        set({
          entitlementUsage: releaseEntitlement(
            get().entitlementUsage,
            "strategist_pack",
          ),
        });
      },

      inviteMember: (email, role, at = now()) => {
        const normalizedEmail = email.trim().toLowerCase();
        const parsed = z.email().safeParse(normalizedEmail);
        if (!parsed.success) {
          return {
            ok: false,
            reason: "invalid",
            message: "Enter a valid email and choose Editor or Viewer.",
          };
        }
        const state = get();
        const policy = canInviteMember(state.entitlementUsage.plan, state.memberships);
        if (!policy.allowed) {
          return { ok: false, reason: "seat_limit", message: policy.message };
        }
        const prior = state.memberships.find(
          ({ email: candidate, status }) =>
            candidate === normalizedEmail && (status === "active" || status === "pending"),
        );
        if (prior) {
          return {
            ok: false,
            reason: "invalid",
            message: "This person already has an active or pending seat.",
          };
        }
        const id = `invite-${state.memberships.length + 1}`;
        const member = membershipSchema.parse({
          id,
          email: normalizedEmail,
          displayNameSnapshot: memberNameFromEmail(normalizedEmail),
          role,
          status: "pending",
          invitedAt: at,
        });
        const notificationId = `notification-${state.notifications.length + 1}`;
        const notification = collaborationNotificationSchema.parse({
          id: notificationId,
          kind: "invite",
          title: `Invite drafted for ${member.displayNameSnapshot}`,
          detail: "Saved locally. No email was sent in demo mode.",
          href: notificationHref(teamHref(id, "invite"), notificationId),
          recipientMembershipId:
            state.memberships.find(({ role: memberRole }) => memberRole === "owner")?.id,
          createdAt: at,
        });
        set((current) => ({
          memberships: [...current.memberships, member],
          notifications: [...current.notifications, notification],
        }));
        return { ok: true, id, delivery: "not_sent" };
      },

      updateInvitationStatus: (memberId, status, at = now()) => {
        const member = get().memberships.find(({ id }) => id === memberId);
        if (!member || member.role === "owner" || member.status !== "pending") return false;
        set((state) => ({
          memberships: state.memberships.map((candidate) =>
            candidate.id === memberId
              ? {
                  ...candidate,
                  status,
                  ...(status === "active" ? { joinedAt: at } : {}),
                }
              : candidate,
          ),
        }));
        return true;
      },

      resendInvitation: (memberId, at = now()) => {
        const state = get();
        const member = state.memberships.find(({ id }) => id === memberId);
        if (!member || member.role === "owner" || !["declined", "revoked", "expired"].includes(member.status)) {
          return { ok: false, delivery: "not_sent" };
        }
        const withoutCandidate = state.memberships.filter(({ id }) => id !== memberId);
        if (!canInviteMember(state.entitlementUsage.plan, withoutCandidate).allowed) {
          return { ok: false, delivery: "not_sent" };
        }
        set((current) => ({
          memberships: current.memberships.map((candidate) =>
            candidate.id === memberId
              ? { ...candidate, status: "pending", invitedAt: at, joinedAt: undefined, removedAt: undefined }
              : candidate,
          ),
        }));
        return { ok: true, delivery: "not_sent" };
      },

      switchDemoActor: (memberId) => {
        if (!get().memberships.some(({ id, status }) => id === memberId && status === "active")) return false;
        set({ currentActorMembershipId: memberId });
        return true;
      },

      removeMember: (memberId, at = now()) => {
        const member = get().memberships.find(({ id }) => id === memberId);
        if (!member || member.role === "owner" || member.status === "removed") return false;
        set((state) => ({
          memberships: state.memberships.map((candidate) =>
            candidate.id === memberId
              ? { ...candidate, status: "removed", removedAt: at }
              : candidate,
          ),
        }));
        return true;
      },

      transferOwnership: (memberId) => {
        const state = get();
        const nextOwner = state.memberships.find(
          ({ id, status }) => id === memberId && status === "active",
        );
        const currentOwner = state.memberships.find(({ role }) => role === "owner");
        if (!nextOwner || !currentOwner || nextOwner.id === currentOwner.id) return false;
        set({
          memberships: state.memberships.map((member) => {
            if (member.id === nextOwner.id) return { ...member, role: "owner" as const };
            if (member.id === currentOwner.id) return { ...member, role: "editor" as const };
            return member;
          }),
        });
        return true;
      },

      assignStage: ({ contentId, stage, assigneeMembershipId, reviewerMembershipId, at = now() }) => {
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const content = state.content.find(({ id }) => id === contentId);
        const isAvailable = (memberId?: string) =>
          !memberId || state.memberships.some(({ id, status }) => id === memberId && status === "active");
        if (!content || !isAvailable(assigneeMembershipId) || !isAvailable(reviewerMembershipId)) return false;
        const revision = state.assignments.filter(
          ({ contentId: candidateContentId, stage: candidateStage }) =>
            candidateContentId === contentId && candidateStage === stage,
        ).length + 1;
        const id = `assignment-${contentId}-${stage}-r${revision}`;
        const assignment = stageAssignmentSchema.parse({
          id,
          contentId,
          stage,
          assigneeMembershipId,
          reviewerMembershipId,
          updatedAt: at,
        });
        const recipients = [assigneeMembershipId, reviewerMembershipId]
          .filter((memberId): memberId is string => Boolean(memberId))
          .filter((memberId, index, all) => all.indexOf(memberId) === index);
        const notifications = recipients.map((recipientMembershipId, index) => {
          const notificationId = `notification-${state.notifications.length + index + 1}`;
          return collaborationNotificationSchema.parse({
            id: notificationId,
            kind: "assignment",
            title: `${content.title} assigned for ${stage}`,
            detail: "Open the exact stage assignment.",
            href: notificationHref(`/app/create/${contentId}?stage=${stage}&assignment=${id}`, notificationId),
            recipientMembershipId,
            createdAt: at,
          });
        });
        set((current) => ({
          assignments: [
            ...current.assignments,
            assignment,
          ],
          notifications: [...current.notifications, ...notifications],
        }));
        return true;
      },

      addReviewComment: (contentId, body, at = now()) => {
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const content = state.content.find(({ id }) => id === contentId);
        const author = state.memberships.find(
          ({ id, status }) => id === state.currentActorMembershipId && status === "active",
        );
        if (!content || !author || !body.trim()) return false;
        const mentioned = state.memberships.filter(({ id: memberId, displayNameSnapshot, status }) => {
          if (status !== "active") return false;
          if (memberId === author.id) return false;
          const firstName = displayNameSnapshot.split(" ")[0] ?? displayNameSnapshot;
          return body.toLocaleLowerCase().includes(`@${firstName.toLocaleLowerCase()}`);
        });
        const id = `${contentId}-review-comment-${state.reviewComments.length + 1}`;
        const comment: ReviewComment = reviewCommentSchema.parse({
          id,
          contentId,
          versionId: content.currentVersionId,
          stage: content.stage,
          authorMembershipId: author.id,
          authorDisplayNameSnapshot: author.displayNameSnapshot,
          body: body.trim(),
          mentionedMembershipIds: mentioned.map(({ id: memberId }) => memberId),
          createdAt: at,
        });
        const notifications = mentioned.map((member, index) => {
          const notificationId = `notification-${state.notifications.length + index + 1}`;
          return collaborationNotificationSchema.parse({
            id: notificationId,
            kind: "mention",
            title: `${author.displayNameSnapshot} mentioned ${member.displayNameSnapshot}`,
            detail: `Open the comment on version ${content.versions.find(({ id: versionId }) => versionId === content.currentVersionId)?.number ?? "current"}.`,
            href: notificationHref(mentionHref(comment), notificationId),
            recipientMembershipId: member.id,
            createdAt: at,
          });
        });
        set((current) => ({
          reviewComments: [...current.reviewComments, comment],
          notifications: [...current.notifications, ...notifications],
        }));
        return true;
      },

      toggleReviewComment: (commentId, at = now()) => {
        if (!collaborationEnabled(get())) return false;
        const comment = get().reviewComments.find(({ id }) => id === commentId);
        if (!comment) return false;
        set((state) => ({
          reviewComments: state.reviewComments.map((candidate) =>
            candidate.id === commentId
              ? candidate.resolvedAt
                ? { ...candidate, resolvedAt: undefined, reopenedAt: at }
                : { ...candidate, resolvedAt: at }
              : candidate,
          ),
        }));
        return true;
      },

      requestApproval: (contentId, reviewerMembershipId, at = now()) => {
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const content = state.content.find(({ id }) => id === contentId);
        const actor = state.memberships.find(
          ({ id, status }) => id === state.currentActorMembershipId && status === "active",
        );
        const reviewer = state.memberships.find(
          ({ id, status }) => id === reviewerMembershipId && status === "active",
        );
        if (!content || !actor || actor.role !== "owner" || !reviewer) return false;
        const event = approvalEventSchema.parse({
          id: `${contentId}-approval-${state.approvals.length + 1}`,
          contentId,
          versionId: content.currentVersionId,
          status: "requested",
          actorMembershipId: actor.id,
          actorDisplayNameSnapshot: actor.displayNameSnapshot,
          requesterMembershipId: actor.id,
          reviewerMembershipId: reviewer.id,
          createdAt: at,
          note: `Review requested from ${reviewer.displayNameSnapshot}.`,
        });
        const notificationId = `notification-${state.notifications.length + 1}`;
        const notification = collaborationNotificationSchema.parse({
          id: notificationId,
          kind: "review",
          title: `Review requested: ${content.title}`,
          detail: `${reviewer.displayNameSnapshot} can review this exact version.`,
          href: notificationHref(approvalHref(event), notificationId),
          recipientMembershipId: reviewer.id,
          createdAt: at,
        });
        set((current) => ({
          approvals: [...current.approvals, event],
          notifications: [...current.notifications, notification],
          content: current.content.map((candidate) =>
            candidate.id === contentId
              ? {
                  ...candidate,
                  approval: { status: "pending", versionId: candidate.currentVersionId },
                  updatedAt: at,
                }
              : candidate,
          ),
        }));
        return true;
      },

      decideApproval: (contentId, decision, note, at = now()) => {
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const content = state.content.find(({ id }) => id === contentId);
        const latest = [...state.approvals].reverse().find(({ contentId: eventContentId }) => eventContentId === contentId);
        const actor = state.memberships.find(
          ({ id, status }) => id === state.currentActorMembershipId && status === "active",
        );
        if (!content || !actor || latest?.status !== "requested" || latest.versionId !== content.currentVersionId || latest.reviewerMembershipId !== actor.id) return false;
        const event = approvalEventSchema.parse({
          id: `${contentId}-approval-${state.approvals.length + 1}`,
          contentId,
          versionId: content.currentVersionId,
          status: decision,
          actorMembershipId: actor.id,
          actorDisplayNameSnapshot: actor.displayNameSnapshot,
          requesterMembershipId: latest.requesterMembershipId,
          reviewerMembershipId: latest.reviewerMembershipId,
          createdAt: at,
          note: note?.trim() || undefined,
        });
        const notificationId = `notification-${state.notifications.length + 1}`;
        const notification = collaborationNotificationSchema.parse({
          id: notificationId,
          kind: "review",
          title: decision === "approved" ? `${content.title} approved` : `Changes requested: ${content.title}`,
          detail: `${actor.displayNameSnapshot} decided this exact version.`,
          href: notificationHref(approvalHref(event), notificationId),
          recipientMembershipId: latest.requesterMembershipId,
          createdAt: at,
        });
        set((current) => ({
          approvals: [...current.approvals, event],
          notifications: [...current.notifications, notification],
          content: current.content.map((candidate) =>
            candidate.id === contentId
              ? {
                  ...candidate,
                  approval: {
                    status: decision,
                    versionId: candidate.currentVersionId,
                    approvedBy: actor.displayNameSnapshot,
                    approvedAt: at,
                  },
                  updatedAt: at,
                }
              : candidate,
          ),
        }));
        return true;
      },

      openNotification: (notificationId, href, at = now()) => {
        const notification = get().notifications.find(({ id }) => id === notificationId);
        if (!notification || notification.href !== href) return false;
        if (notification.readAt) return true;
        set((state) => ({
          notifications: state.notifications.map((candidate) =>
            candidate.id === notificationId ? { ...candidate, readAt: candidate.readAt ?? at } : candidate,
          ),
        }));
        return true;
      },

      createExport: (contentId, requestedBy = "You", at = now()) => {
        const item = get().content.find(({ id }) => id === contentId);
        if (!item) return undefined;

        const manifest = buildExportManifest(item, {
          requestedAt: at,
          requestedBy,
        });
        set((state) => ({
          exports: [
            ...state.exports.filter(({ id }) => id !== manifest.id),
            manifest,
          ],
        }));
        return manifest.id;
      },

      recordPublishReceipt: (payload) => {
        const parsed = publishReceiptSchema.safeParse(payload);
        if (!parsed.success) return false;

        const receipt: PublishReceipt = parsed.data;
        const contentItem = get().content.find(
          ({ id }) => id === receipt.contentId,
        );
        if (!contentItem || contentItem.platform !== receipt.platform) {
          return false;
        }

        set((state) => ({
          publishReceipts: [
            ...state.publishReceipts.filter(({ id }) => id !== receipt.id),
            receipt,
          ],
          content: state.content.map((item) =>
            item.id === receipt.contentId
              ? transitionStage(item, {
                  type: "MOVE",
                  stage: "published",
                  at: receipt.recordedAt,
                })
              : item,
          ),
        }));
        return true;
      },

      importMetrics: (payload) => {
        const parsed = metricSamplesSchema.safeParse(payload);
        if (!parsed.success) return false;

        set((state) => {
          const deduplicationKeys = new Set(
            state.metrics.map(metricSampleDedupKey),
          );
          const metrics = [...state.metrics];
          for (const metric of parsed.data) {
            const key = metricSampleDedupKey(metric);
            if (deduplicationKeys.has(key)) continue;
            deduplicationKeys.add(key);
            metrics.push(metric);
          }

          const dismissals = new Map(
            state.learnings
              .filter(({ dismissedAt }) => dismissedAt !== undefined)
              .map(({ id, dismissedAt }) => [id, dismissedAt]),
          );
          const learnings = deriveLearnings(metrics).map((learning) => {
            const dismissedAt = dismissals.get(learning.id);
            return dismissedAt ? { ...learning, dismissedAt } : learning;
          });
          return { metrics, learnings };
        });
        return true;
      },

      dismissLearning: (learningId, at = now()) => {
        set((state) => ({
          learnings: state.learnings.map((learning) =>
            learning.id === learningId
              ? { ...learning, dismissedAt: at }
              : learning,
          ),
        }));
      },
    }),
    {
      name: MUSEBOARD_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      partialize: persistedState,
      merge: (persisted, current) => {
        const parsed = validatePersistedMuseboardData(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

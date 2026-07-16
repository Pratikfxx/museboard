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
  mergeMetricImport,
  metricSamplesSchema,
  type DuplicatePolicy,
} from "@/domain/analytics";
import {
  contentHypothesisSchema,
  contentSeriesSchema,
  creatorMemorySchema,
  createSeriesFromContent,
  offlineCaptureSchema,
  opportunityFeedbackSchema,
  workspaceRecoveryNoticeSchema,
  type CreatorMemory,
  type OpportunityFeedback,
} from "@/domain/creator-intelligence";
import {
  approvalEventSchema,
  approvalHref,
  activeActor,
  assignmentHref,
  canInviteMember,
  commentStatusEventSchema,
  collaborationNotificationSchema,
  effectiveMemberStatus,
  invitationExpiresAt,
  membershipSchema,
  mentionHref,
  notificationHref,
  reviewCommentSchema,
  stageAssignmentSchema,
  teamHref,
  type ApprovalEvent,
  type CommentStatusEvent,
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
  type Plan,
} from "@/domain/entitlements";
import { exportRecordSchema } from "@/domain/export";
import {
  ideaRecordSchema,
  opportunitySchema,
  visionReferenceSchema,
} from "@/domain/opportunities";
import type { VisionReference } from "@/domain/opportunities";
import { plannerTaskSchema, type PlannerTask } from "@/domain/planner";
import {
  roomCanConvert,
  thinkingRoomContentOriginSchema,
  type ThinkingRoom,
  type ThinkingRoomContentOrigin,
  type ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";
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
import { createClearedSampleWorkspace } from "@/lib/account/sample-workspace";
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
import {
  inspectPersistedWorkspaceEnvelope,
  MUSEBOARD_RECOVERY_BACKUP_KEY,
} from "@/lib/store/recovery";
import { useThinkingRoomStore } from "@/lib/store/thinking-room-store";

export const MUSEBOARD_STORAGE_KEY = "museboard-demo-v1";
const fallbackStorage = new Map<string, string>();
let pendingRecoveryNotice: DemoMuseboardData["recoveryNotice"];
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
      if (name !== MUSEBOARD_STORAGE_KEY || value === null) return value;
      const inspection = inspectPersistedWorkspaceEnvelope(
        value,
        (payload) => validatePersistedMuseboardData(payload).success,
      );
      if (inspection.ok) return value;
      fallbackStorage.set(MUSEBOARD_RECOVERY_BACKUP_KEY, inspection.rawBackup);
      try {
        window.localStorage.setItem(
          MUSEBOARD_RECOVERY_BACKUP_KEY,
          inspection.rawBackup,
        );
      } catch {
        // The in-memory quarantine remains downloadable for this tab.
      }
      pendingRecoveryNotice = inspection.notice;
      return null;
    } catch {
      pendingRecoveryNotice = {
        id: `recovery-${new Date().toISOString()}`,
        kind: "storage_unavailable",
        title: "Local saving is unavailable",
        detail:
          "Museboard will keep this workspace usable in the current tab, but your browser is blocking persistent storage.",
        detectedAt: new Date().toISOString(),
      };
      return fallbackStorage.get(name) ?? null;
    }
  },
  setItem: (name, value) => {
    if (name === MUSEBOARD_STORAGE_KEY) {
      try {
        const envelope = recordValue(JSON.parse(value));
        const state = recordValue(envelope?.state);
        if (state?.dataMode === "live") return;
      } catch {
        // Malformed values continue through the recovery-aware sample storage.
      }
    }
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
  exports: z.array(exportRecordSchema),
  publishReceipts: z.array(publishReceiptSchema),
  metrics: metricSamplesSchema,
  learnings: z.array(learningSchema),
  hypotheses: z.array(contentHypothesisSchema).default([]),
  series: z.array(contentSeriesSchema).default([]),
  creatorMemory: creatorMemorySchema.default({
    version: 1,
    preferredPhrases: [],
    avoidPhrases: [],
    preferredStructures: [],
    notes: [],
    updatedAt: "2026-07-13T09:00:00.000Z",
  }),
  opportunityFeedback: z.array(opportunityFeedbackSchema).default([]),
  offlineCaptures: z.array(offlineCaptureSchema).default([]),
  recoveryNotice: workspaceRecoveryNoticeSchema.optional(),
  entitlementUsage: entitlementUsageSchema,
  memberships: z.array(membershipSchema).default([]),
  currentActorMembershipId: z.string().min(1).default("member-owner"),
  assignments: z.array(stageAssignmentSchema).default([]),
  reviewComments: z.array(reviewCommentSchema).default([]),
  commentEvents: z.array(commentStatusEventSchema).default([]),
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
    ? state.memberships.map((value) => {
        const member = recordValue(value);
        if (!member || member.status !== "pending" || typeof member.expiresAt === "string") return value;
        return {
          ...member,
          expiresAt: invitationExpiresAt(
            typeof member.invitedAt === "string" ? member.invitedAt : "2026-07-13T09:00:00.000Z",
          ),
        };
      })
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
  const currentVersionByContent = new Map(
    (Array.isArray(state.content) ? state.content : []).flatMap((value) => {
      const content = recordValue(value);
      return typeof content?.id === "string" && typeof content.currentVersionId === "string"
        ? [[content.id, content.currentVersionId] as const]
        : [];
    }),
  );
  const assignments = Array.isArray(state.assignments)
    ? state.assignments.map((value) => {
        const assignment = recordValue(value);
        if (!assignment || typeof assignment.versionId === "string") return value;
        const versionId = typeof assignment.contentId === "string"
          ? currentVersionByContent.get(assignment.contentId)
          : undefined;
        return versionId ? { ...assignment, versionId } : value;
      })
    : [];

  return {
    ...state,
    memberships,
    currentActorMembershipId:
      typeof state.currentActorMembershipId === "string"
        ? state.currentActorMembershipId
        : typeof legacyOwnerId === "string"
          ? legacyOwnerId
          : "member-owner",
    assignments,
    reviewComments: Array.isArray(state.reviewComments) ? state.reviewComments : [],
    commentEvents: Array.isArray(state.commentEvents) ? state.commentEvents : [],
    approvals: Array.isArray(state.approvals) ? state.approvals : [],
    notifications: Array.isArray(state.notifications) ? state.notifications : [],
    hypotheses: Array.isArray(state.hypotheses) ? state.hypotheses : [],
    series: Array.isArray(state.series) ? state.series : [],
    creatorMemory: recordValue(state.creatorMemory) ?? {
      version: 1,
      preferredPhrases: [],
      avoidPhrases: [],
      preferredStructures: [],
      notes: [],
      updatedAt: "2026-07-13T09:00:00.000Z",
    },
    opportunityFeedback: Array.isArray(state.opportunityFeedback)
      ? state.opportunityFeedback
      : [],
    offlineCaptures: Array.isArray(state.offlineCaptures)
      ? state.offlineCaptures
      : [],
    recoveryNotice: recordValue(state.recoveryNotice),
    exports: Array.isArray(state.exports)
      ? state.exports.filter((value) => recordValue(value)?.status === "complete")
      : [],
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
  clearSampleWorkspace: () => boolean;
  setDemoPlan: (plan: Plan) => boolean;
  completeOnboarding: (workspace: StarterWorkspace) => void;
  hydrateLiveWorkspace: (payload: unknown) => boolean;
  selectOpportunity: (opportunityId: string) => void;
  saveOpportunity: (opportunityId: string) => void;
  dismissOpportunity: (opportunityId: string) => void;
  restoreOpportunity: (opportunityId: string) => void;
  shapeOpportunity: (opportunityId: string, at?: string) => string | undefined;
  createIdeaFromThinkingRoom: (roomId: string, at?: string) => string | undefined;
  createIdeaFromThinkingRoomOrigin: (input: {
    room: ThinkingRoom;
    synthesis: ThinkingSynthesisRevision;
    contributorCount: number;
    origin: ThinkingRoomContentOrigin;
  }) => string | undefined;
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
  recordExport: (record: unknown) => boolean;
  recordPublishReceipt: (receipt: unknown) => boolean;
  importMetrics: (metrics: unknown, policy?: DuplicatePolicy, at?: string) => boolean;
  deleteMetricImport: (importId: string, at?: string) => boolean;
  dismissLearning: (learningId: string, at?: string) => void;
  restoreLearning: (learningId: string) => void;
  createSeries: (input: {
    contentId: string;
    title: string;
    goal: string;
    at?: string;
  }) => string | undefined;
  addContentToSeries: (seriesId: string, contentId: string, at?: string) => boolean;
  setContentHypothesis: (input: {
    contentId: string;
    statement: string;
    expectedOutcome?: string;
    learningId?: string;
    at?: string;
  }) => string | undefined;
  recordOpportunityFeedback: (
    opportunityId: string,
    signal: OpportunityFeedback["signal"],
    at?: string,
  ) => boolean;
  updateCreatorMemory: (
    patch: Partial<Pick<CreatorMemory, "preferredPhrases" | "avoidPhrases" | "preferredStructures" | "notes">>,
    at?: string,
  ) => boolean;
  captureIdea: (text: string, at?: string) => string | undefined;
  dismissCapture: (captureId: string) => boolean;
  promoteCapture: (captureId: string, at?: string) => string | undefined;
  clearRecoveryNotice: () => void;
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

export function workspacePayloadFromState(state: MuseboardState): DemoMuseboardData {
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
    hypotheses: state.hypotheses,
    series: state.series,
    creatorMemory: state.creatorMemory,
    opportunityFeedback: state.opportunityFeedback,
    offlineCaptures: state.offlineCaptures,
    recoveryNotice: state.recoveryNotice,
    entitlementUsage: state.entitlementUsage,
    memberships: state.memberships,
    currentActorMembershipId: state.currentActorMembershipId,
    assignments: state.assignments,
    reviewComments: state.reviewComments,
    commentEvents: state.commentEvents,
    approvals: state.approvals,
    notifications: state.notifications,
  };
}

export function createOnboardedWorkspacePayload(
  base: DemoMuseboardData,
  workspace: StarterWorkspace,
  dataMode: DemoMuseboardData["dataMode"],
): DemoMuseboardData {
  const parsed = starterWorkspaceSchema.parse(workspace);
  const onboardingAt = parsed.content[0]?.createdAt ?? now();
  return {
    ...base,
    dataMode,
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
    hypotheses: [],
    series: [],
    creatorMemory: {
      version: 1,
      preferredPhrases: [],
      avoidPhrases: parsed.creator.boundaries,
      preferredStructures: [],
      notes: parsed.creator.voiceTraits,
      updatedAt: onboardingAt,
    },
    opportunityFeedback: [],
    offlineCaptures: [],
    recoveryNotice: undefined,
    memberships: [ownerMembership(parsed.creator.name, onboardingAt)],
    currentActorMembershipId: "member-owner",
    assignments: [],
    reviewComments: [],
    commentEvents: [],
    approvals: [],
    notifications: [],
    entitlementUsage: {
      plan: "free",
      used: {},
      reserved: {},
      resetAt: base.entitlementUsage.resetAt,
    },
  };
}

export const useMuseboardStore = create<MuseboardState>()(
  persist<MuseboardState, [], [], DemoMuseboardData>(
    (set, get) => ({
      ...createDemoState(),

      resetDemo: () => {
        const demo = createDemoState();
        set(demo);
        useThinkingRoomStore.getState().resetSample(demo.memberships);
      },

      clearSampleWorkspace: () => {
        const state = get();
        if (state.dataMode !== "sample") return false;
        set(createClearedSampleWorkspace(state.entitlementUsage.resetAt));
        return true;
      },

      setDemoPlan: (plan) => {
        const parsedPlan = z.enum(["free", "creator", "pro", "studio"]).safeParse(plan);
        if (!parsedPlan.success || get().dataMode !== "sample") return false;
        set((state) => ({
          entitlementUsage: {
            plan: parsedPlan.data,
            used: {},
            reserved: {},
            resetAt: state.entitlementUsage.resetAt,
          },
        }));
        return true;
      },

      completeOnboarding: (workspace) => {
        const onboarded = createOnboardedWorkspacePayload(
          workspacePayloadFromState(get()),
          workspace,
          "sample",
        );
        set(onboarded);
        useThinkingRoomStore.getState().resetSample(onboarded.memberships);
      },

      hydrateLiveWorkspace: (payload) => {
        const parsed = validatePersistedMuseboardData(payload);
        if (!parsed.success || parsed.data.dataMode !== "live") return false;
        set(parsed.data);
        return true;
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

      createIdeaFromThinkingRoom: (roomId, at = now()) => {
        const state = get();
        const thinkingRoomState = useThinkingRoomStore.getState();
        const room = thinkingRoomState.rooms.find(({ id }) => id === roomId);
        if (!room) return undefined;
        const synthesis = thinkingRoomState.synthesisRevisions
          .filter(({ roomId: revisionRoomId }) => revisionRoomId === room.id)
          .toSorted((left, right) => left.number - right.number)
          .at(-1);
        if (!synthesis) return undefined;

        const existing = state.ideas.find(
          ({ provenance }) =>
            provenance.thinkingRoomOrigin?.synthesisRevisionId === synthesis.id,
        );
        if (existing) return existing.id;
        if (!roomCanConvert(room, thinkingRoomState.synthesisRevisions)) {
          return undefined;
        }

        const contributorCount = new Set(
          thinkingRoomState.contributions
            .filter(
              (contribution) =>
                contribution.roomId === room.id && !contribution.deletedAt,
            )
            .map(({ authorMembershipId }) => authorMembershipId),
        ).size;
        const origin = thinkingRoomContentOriginSchema.parse({
          roomId: room.id,
          synthesisRevisionId: synthesis.id,
          ideaId: `idea-thinking-room-${synthesis.id}`,
          createdByMembershipId: room.decisionOwnerMembershipId,
          createdAt: at,
        });
        const ideaId = get().createIdeaFromThinkingRoomOrigin({
          room,
          synthesis,
          contributorCount,
          origin,
        });
        if (!ideaId) return undefined;
        if (!thinkingRoomState.markRoomConverted(room.id, at)) return undefined;
        return ideaId;
      },

      createIdeaFromThinkingRoomOrigin: ({
        room,
        synthesis,
        contributorCount,
        origin: originInput,
      }) => {
        const state = get();
        const origin = thinkingRoomContentOriginSchema.safeParse(originInput);
        if (
          !origin.success ||
          origin.data.roomId !== room.id ||
          origin.data.synthesisRevisionId !== synthesis.id ||
          synthesis.roomId !== room.id ||
          synthesis.status !== "accepted" ||
          !synthesis.acceptedByMembershipId ||
          !Number.isInteger(contributorCount) ||
          contributorCount < 0
        ) {
          return undefined;
        }
        const existing = state.ideas.find(
          ({ provenance }) =>
            provenance.thinkingRoomOrigin?.synthesisRevisionId === synthesis.id,
        );
        if (existing) return existing.id;
        if (state.ideas.some(({ id }) => id === origin.data.ideaId)) return undefined;

        const idea = ideaRecordSchema.parse({
          id: origin.data.ideaId,
          title: synthesis.chosenDirection.title,
          summary: synthesis.chosenDirection.angle,
          platform: state.creator?.platforms[0] ?? "instagram_reels",
          format: "story",
          pillar: state.creator?.contentPillars[0] ?? "Creator perspective",
          readiness: "ready",
          goal: "trust",
          createdAt: origin.data.createdAt,
          provenance: {
            provider: "museboard-thinking-room",
            mode: state.dataMode,
            thinkingRoomOrigin: {
              roomId: room.id,
              question: room.question,
              synthesisRevisionId: synthesis.id,
              contributorCount,
              convertedAt: origin.data.createdAt,
            },
          },
        });
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
        const cleanTitle = idea.title.replace(/[.!?]+$/u, "").toLocaleLowerCase();
        const cleanSummary = idea.summary.replace(/[.!?]+$/u, "");
        const promotedHooks = [
          {
            id: `${contentId}-hook-1`,
            contentId,
            text: `What ${cleanTitle} looks like in practice.`,
            rationale: "Opens with the specific promise already preserved in the shaped idea.",
          },
          {
            id: `${contentId}-hook-2`,
            contentId,
            text: `${cleanSummary}—here is the part worth testing.`,
            rationale: "Turns the source-backed summary into a concrete, testable opening.",
          },
          {
            id: `${contentId}-hook-3`,
            contentId,
            text: `If ${idea.pillar.toLocaleLowerCase()} matters to your work, start here.`,
            rationale: "Invites the intended audience in without manufacturing urgency.",
          },
        ].map((hook) => hookOptionSchema.parse(hook));
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
              selectedHookId: promotedHooks[0].id,
              selectedHookText: promotedHooks[0].text,
              script: "",
              createdAt: at,
            },
          ],
          createdAt: at,
          updatedAt: at,
        });
        set((current) => ({
          content: [...current.content, item],
          hooks: [...current.hooks, ...promotedHooks],
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
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        if (actor?.role !== "owner") {
          return { ok: false, reason: "invalid", message: "Only the workspace owner can invite collaborators." };
        }
        const policy = canInviteMember(state.entitlementUsage.plan, state.memberships, at);
        if (!policy.allowed) {
          return { ok: false, reason: "seat_limit", message: policy.message };
        }
        const prior = state.memberships.find(
          (member) => {
            const status = effectiveMemberStatus(member, at);
            return member.email === normalizedEmail && (status === "active" || status === "pending");
          },
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
          expiresAt: invitationExpiresAt(at),
        });
        const notificationId = `notification-${state.notifications.length + 1}`;
        const notification = collaborationNotificationSchema.parse({
          id: notificationId,
          kind: "invite",
          title: `Invite drafted for ${member.displayNameSnapshot}`,
          detail: "Saved locally. No email was sent in demo mode.",
          href: notificationHref(teamHref(id, "invite"), notificationId),
          recipientMembershipId:
            actor.id,
          createdAt: at,
        });
        set((current) => ({
          memberships: [...current.memberships, member],
          notifications: [...current.notifications, notification],
        }));
        return { ok: true, id, delivery: "not_sent" };
      },

      updateInvitationStatus: (memberId, status, at = now()) => {
        const state = get();
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const member = state.memberships.find(({ id }) => id === memberId);
        if (actor?.role !== "owner" || !member || member.role === "owner" || effectiveMemberStatus(member, at) !== "pending") return false;
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
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const member = state.memberships.find(({ id }) => id === memberId);
        if (actor?.role !== "owner" || !member || member.role === "owner" || !["declined", "revoked", "expired"].includes(effectiveMemberStatus(member, at))) {
          return { ok: false, delivery: "not_sent" };
        }
        const withoutCandidate = state.memberships.filter(({ id }) => id !== memberId);
        if (!canInviteMember(state.entitlementUsage.plan, withoutCandidate, at).allowed) {
          return { ok: false, delivery: "not_sent" };
        }
        set((current) => ({
          memberships: current.memberships.map((candidate) =>
            candidate.id === memberId
              ? { ...candidate, status: "pending", invitedAt: at, expiresAt: invitationExpiresAt(at), joinedAt: undefined, removedAt: undefined }
              : candidate,
          ),
        }));
        return { ok: true, delivery: "not_sent" };
      },

      switchDemoActor: (memberId) => {
        const state = get();
        if (!activeActor(state.memberships, memberId)) return false;
        set({ currentActorMembershipId: memberId });
        return true;
      },

      removeMember: (memberId, at = now()) => {
        const state = get();
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const member = state.memberships.find(({ id }) => id === memberId);
        if (actor?.role !== "owner" || memberId === actor.id || !member || member.role === "owner" || member.status === "removed") return false;
        set((state) => ({
          memberships: state.memberships.map((candidate) =>
            candidate.id === memberId
              ? { ...candidate, status: "removed", removedAt: at }
              : candidate,
          ),
        }));
        return true;
      },

      transferOwnership: (memberId, at = now()) => {
        const state = get();
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const nextOwner = state.memberships.find(
          ({ id, status }) => id === memberId && status === "active",
        );
        const currentOwner = state.memberships.find(({ role }) => role === "owner");
        if (actor?.role !== "owner" || actor.id !== currentOwner?.id || !nextOwner || !currentOwner || nextOwner.id === currentOwner.id) return false;
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
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const content = state.content.find(({ id }) => id === contentId);
        const isAvailable = (memberId?: string) =>
          !memberId || state.memberships.some(({ id, status }) => id === memberId && status === "active");
        if (!actor || !["owner", "editor"].includes(actor.role) || stage !== "review" || !content || !isAvailable(assigneeMembershipId) || !isAvailable(reviewerMembershipId)) return false;
        const revision = state.assignments.filter(
          ({ contentId: candidateContentId, stage: candidateStage }) =>
            candidateContentId === contentId && candidateStage === stage,
        ).length + 1;
        const id = `assignment-${contentId}-${stage}-r${revision}`;
        const assignment = stageAssignmentSchema.parse({
          id,
          contentId,
          stage,
          versionId: content.currentVersionId,
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
            href: notificationHref(assignmentHref(assignment), notificationId),
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
        const author = activeActor(state.memberships, state.currentActorMembershipId, at);
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
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const comment = state.reviewComments.find(({ id }) => id === commentId);
        if (!actor || !comment) return false;
        const latest = [...state.commentEvents].reverse().find(({ commentId: candidateId }) => candidateId === commentId);
        const resolved = latest ? latest.action === "resolved" : Boolean(comment.resolvedAt && (!comment.reopenedAt || comment.resolvedAt > comment.reopenedAt));
        const event: CommentStatusEvent = commentStatusEventSchema.parse({
          id: `${commentId}-status-${state.commentEvents.length + 1}`,
          commentId,
          action: resolved ? "reopened" : "resolved",
          actorMembershipId: actor.id,
          actorDisplayNameSnapshot: actor.displayNameSnapshot,
          createdAt: at,
        });
        set((current) => ({ commentEvents: [...current.commentEvents, event] }));
        return true;
      },

      requestApproval: (contentId, reviewerMembershipId, at = now()) => {
        const state = get();
        if (!collaborationEnabled(state)) return false;
        const content = state.content.find(({ id }) => id === contentId);
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        const reviewer = state.memberships.find(
          ({ id, status }) => id === reviewerMembershipId && status === "active",
        );
        const assignment = [...state.assignments].reverse().find(
          ({ contentId: candidateContentId, stage }) => candidateContentId === contentId && stage === "review",
        );
        const duplicatePending = state.approvals.some(
          ({ contentId: candidateContentId, versionId, status }) =>
            candidateContentId === contentId && versionId === content?.currentVersionId && status === "requested",
        );
        if (!content || !actor || actor.role !== "owner" || !reviewer || assignment?.versionId !== content.currentVersionId || assignment.reviewerMembershipId !== reviewer.id || duplicatePending) return false;
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
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
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
        const state = get();
        const notification = state.notifications.find(({ id }) => id === notificationId);
        const actor = activeActor(state.memberships, state.currentActorMembershipId, at);
        if (!notification || notification.href !== href || !actor || notification.recipientMembershipId !== actor.id) return false;
        if (notification.readAt) return true;
        set((state) => ({
          notifications: state.notifications.map((candidate) =>
            candidate.id === notificationId ? { ...candidate, readAt: candidate.readAt ?? at } : candidate,
          ),
        }));
        return true;
      },

      recordExport: (payload) => {
        const parsed = exportRecordSchema.safeParse(payload);
        if (!parsed.success) return false;
        const { manifest } = parsed.data;
        if (
          parsed.data.id !== manifest.id ||
          parsed.data.contentId !== manifest.contentId ||
          parsed.data.versionId !== manifest.versionId ||
          parsed.data.variantId !== manifest.variantId ||
          parsed.data.platform !== manifest.platform ||
          parsed.data.generatedAt !== manifest.generatedAt
        ) return false;
        const existing = get().exports.find(({ id }) => id === parsed.data.id);
        if (existing) return JSON.stringify(existing) === JSON.stringify(parsed.data);
        const item = get().content.find(({ id }) => id === parsed.data.contentId);
        if (!item || !item.versions.some(({ id }) => id === parsed.data.versionId) || item.platform !== parsed.data.platform) return false;
        set((state) => ({ exports: [...state.exports, parsed.data] }));
        return true;
      },

      recordPublishReceipt: (payload) => {
        const parsed = publishReceiptSchema.safeParse(payload);
        if (!parsed.success) return false;

        let receiptUrl: URL;
        try { receiptUrl = new URL(parsed.data.provenance.sourceUrl ?? ""); } catch { return false; }
        receiptUrl.hash = "";
        receiptUrl.hostname = receiptUrl.hostname.toLowerCase();
        receiptUrl.pathname = receiptUrl.pathname.replace(/\/+$/u, "") || "/";
        const receipt: PublishReceipt = {
          ...parsed.data,
          provenance: { ...parsed.data.provenance, sourceUrl: receiptUrl.href },
        };
        const contentItem = get().content.find(
          ({ id }) => id === receipt.contentId,
        );
        const exportRecord = get().exports.find(({ id }) => id === receipt.exportId);
        const duplicateUrl = get().publishReceipts.some(({ provenance }) => {
          try {
            const existing = new URL(provenance.sourceUrl ?? "");
            existing.hash = "";
            existing.hostname = existing.hostname.toLowerCase();
            existing.pathname = existing.pathname.replace(/\/+$/u, "") || "/";
            return existing.href === receipt.provenance.sourceUrl;
          } catch { return false; }
        });
        const platformHostMatches = (() => {
          try {
            const host = new URL(receipt.provenance.sourceUrl ?? "").hostname.toLowerCase();
            if (receipt.platform === "instagram_reels") return host === "instagram.com" || host.endsWith(".instagram.com");
            if (receipt.platform === "tiktok_video") return host === "tiktok.com" || host.endsWith(".tiktok.com");
            return host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be";
          } catch { return false; }
        })();
        if (
          !contentItem ||
          contentItem.platform !== receipt.platform ||
          !exportRecord ||
          exportRecord.contentId !== receipt.contentId ||
          exportRecord.versionId !== receipt.versionId ||
          exportRecord.platform !== receipt.platform ||
          !receipt.provenance.sourceUrl?.startsWith("https://") ||
          !platformHostMatches ||
          duplicateUrl
        ) {
          return false;
        }

        set((state) => ({
          publishReceipts: [...state.publishReceipts, receipt],
          content: state.content.map((item) =>
            item.id === receipt.contentId && item.currentVersionId === receipt.versionId
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

      importMetrics: (payload, policy = "skip", at = now()) => {
        const parsed = metricSamplesSchema.safeParse(payload);
        if (!parsed.success) return false;
        const merged = mergeMetricImport(get().metrics, parsed.data, policy);
        if (!merged.ok) return false;
        set((state) => {
          const dismissals = new Map(
            state.learnings
              .filter(({ dismissedAt }) => dismissedAt !== undefined)
              .map(({ id, dismissedAt }) => [id, dismissedAt]),
          );
          const learnings = deriveLearnings(merged.metrics, at).map((learning) => {
            const dismissedAt = dismissals.get(learning.id);
            return dismissedAt ? { ...learning, dismissedAt } : learning;
          });
          return { metrics: merged.metrics, learnings };
        });
        return true;
      },

      deleteMetricImport: (importId, at = now()) => {
        if (!get().metrics.some(({ importId: candidate }) => candidate === importId)) return false;
        set((state) => {
          const metrics = state.metrics.filter(({ importId: candidate }) => candidate !== importId);
          const dismissals = new Map(state.learnings.filter(({ dismissedAt }) => dismissedAt).map(({ id, dismissedAt }) => [id, dismissedAt]));
          const learnings = deriveLearnings(metrics, at).map((learning) => {
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

      restoreLearning: (learningId) => {
        set((state) => ({
          learnings: state.learnings.map((learning) => learning.id === learningId ? { ...learning, dismissedAt: undefined } : learning),
        }));
      },

      createSeries: ({ contentId, title, goal, at = now() }) => {
        const state = get();
        if (!state.content.some(({ id }) => id === contentId)) return undefined;
        const existing = state.series.find((candidate) => candidate.contentIds.includes(contentId));
        if (existing) return existing.id;
        const parsed = contentSeriesSchema.safeParse(
          createSeriesFromContent({ contentId, title, goal, at }),
        );
        if (!parsed.success) return undefined;
        set((current) => ({ series: [...current.series, parsed.data] }));
        return parsed.data.id;
      },

      addContentToSeries: (seriesId, contentId, at = now()) => {
        const state = get();
        const target = state.series.find(({ id }) => id === seriesId);
        if (!target || !state.content.some(({ id }) => id === contentId)) return false;
        if (target.contentIds.includes(contentId)) return true;
        set((current) => ({
          series: current.series.map((series) =>
            series.id === seriesId
              ? { ...series, contentIds: [...series.contentIds, contentId], updatedAt: at }
              : series,
          ),
        }));
        return true;
      },

      setContentHypothesis: ({
        contentId,
        statement,
        expectedOutcome,
        learningId,
        at = now(),
      }) => {
        const state = get();
        const content = state.content.find(({ id }) => id === contentId);
        if (!content || (learningId && !state.learnings.some(({ id }) => id === learningId))) {
          return undefined;
        }
        const sequence = state.hypotheses.filter(
          ({ contentId: candidateId }) => candidateId === contentId,
        ).length + 1;
        const parsed = contentHypothesisSchema.safeParse({
          id: `hypothesis-${contentId}-${sequence}`,
          contentId,
          opportunityId: content.opportunityId,
          learningId,
          statement,
          expectedOutcome,
          status: "planned",
          createdAt: at,
        });
        if (!parsed.success) return undefined;
        set((current) => ({ hypotheses: [...current.hypotheses, parsed.data] }));
        return parsed.data.id;
      },

      recordOpportunityFeedback: (opportunityId, signal, at = now()) => {
        const state = get();
        const opportunity = state.opportunities.find(({ id }) => id === opportunityId);
        if (!opportunity) return false;
        const prior = state.opportunityFeedback.find(
          (feedback) => feedback.opportunityId === opportunityId && feedback.signal === signal,
        );
        if (prior) return true;
        const parsed = opportunityFeedbackSchema.safeParse({
          id: `feedback-${state.opportunityFeedback.length + 1}`,
          opportunityId,
          signal,
          pillar: opportunity.pillar,
          format: opportunity.format,
          createdAt: at,
        });
        if (!parsed.success) return false;
        set((current) => ({
          opportunityFeedback: [
            ...current.opportunityFeedback.filter(
              (feedback) => feedback.opportunityId !== opportunityId,
            ),
            parsed.data,
          ],
          opportunityDecisions:
            signal === "not_for_me"
              ? { ...current.opportunityDecisions, [opportunityId]: "dismissed" }
              : current.opportunityDecisions,
        }));
        return true;
      },

      updateCreatorMemory: (patch, at = now()) => {
        const current = get().creatorMemory;
        const parsed = creatorMemorySchema.safeParse({
          ...current,
          ...patch,
          version: current.version + 1,
          updatedAt: at,
        });
        if (!parsed.success) return false;
        set({ creatorMemory: parsed.data });
        return true;
      },

      captureIdea: (text, at = now()) => {
        const trimmed = text.trim();
        if (!trimmed) return undefined;
        const state = get();
        const parsed = offlineCaptureSchema.safeParse({
          id: `capture-${state.offlineCaptures.length + 1}`,
          text: trimmed,
          status: "queued",
          createdAt: at,
        });
        if (!parsed.success) return undefined;
        set((current) => ({ offlineCaptures: [...current.offlineCaptures, parsed.data] }));
        return parsed.data.id;
      },

      dismissCapture: (captureId) => {
        if (!get().offlineCaptures.some(({ id }) => id === captureId)) return false;
        set((state) => ({
          offlineCaptures: state.offlineCaptures.map((capture) =>
            capture.id === captureId ? { ...capture, status: "dismissed" } : capture,
          ),
        }));
        return true;
      },

      promoteCapture: (captureId, at = now()) => {
        const state = get();
        const capture = state.offlineCaptures.find(({ id }) => id === captureId);
        if (!capture || capture.status === "dismissed") return undefined;
        const opportunityId = capture.promotedOpportunityId ?? `capture-opportunity-${capture.id}`;
        const existingIdea = state.ideas.find(({ opportunityId: candidate }) => candidate === opportunityId);
        if (existingIdea) return existingIdea.id;
        const expiresAt = new Date(at);
        expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
        const opportunity = opportunitySchema.parse({
          id: opportunityId,
          title: capture.text,
          summary: "A creator-owned quick capture ready to shape into a concrete post.",
          platform: state.creator?.platforms[0] ?? "instagram_reels",
          archetypes: state.creator?.archetypes ?? ["tech_education"],
          format: "story",
          pillar: state.creator?.contentPillars[0] ?? "Creator practice",
          readiness: "spark",
          goal: "community",
          geography: "Global",
          signals: { relevance: 95, momentum: 50, originality: 90, creatorFit: 98 },
          evidence: [
            {
              summary: "Captured directly by the creator in this workspace.",
              sourceLabel: "Creator quick capture",
            },
          ],
          provenance: {
            provider: "museboard-quick-capture",
            mode: "sample",
            fetchedAt: at,
            sourceClass: "creator_submission",
            sourceLabel: "Creator quick capture",
            observedAt: capture.createdAt,
            expiresAt: expiresAt.toISOString(),
          },
        });
        const idea = createIdeaFromOpportunity(opportunity, at);
        set((current) => ({
          opportunities: current.opportunities.some(({ id }) => id === opportunity.id)
            ? current.opportunities
            : [...current.opportunities, opportunity],
          ideas: [...current.ideas, idea],
          offlineCaptures: current.offlineCaptures.map((candidate) =>
            candidate.id === captureId
              ? {
                  ...candidate,
                  status: "promoted",
                  promotedOpportunityId: opportunityId,
                }
              : candidate,
          ),
        }));
        return idea.id;
      },

      clearRecoveryNotice: () => set({ recoveryNotice: undefined }),
    }),
    {
      name: MUSEBOARD_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      partialize: workspacePayloadFromState,
      merge: (persisted, current) => {
        const parsed = validatePersistedMuseboardData(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
      onRehydrateStorage: () => () => {
        if (!pendingRecoveryNotice) return;
        const notice = pendingRecoveryNotice;
        pendingRecoveryNotice = undefined;
        queueMicrotask(() => useMuseboardStore.setState({ recoveryNotice: notice }));
      },
    },
  ),
);

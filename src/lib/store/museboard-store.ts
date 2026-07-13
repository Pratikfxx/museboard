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
import { entitlementUsageSchema } from "@/domain/entitlements";
import { buildExportManifest, exportManifestSchema } from "@/domain/export";
import {
  ideaRecordSchema,
  opportunitySchema,
  visionReferenceSchema,
} from "@/domain/opportunities";
import type { VisionReference } from "@/domain/opportunities";
import { plannerTaskSchema } from "@/domain/planner";
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
import type {
  Comment,
  PublishReceipt,
  WorkflowStage,
} from "@/domain/schema";
import { approveCurrentVersion, transitionStage } from "@/domain/workflow";
import {
  CREATOR_OUTCOMES,
  createDemoState,
  type CreatorProfile,
  type DemoMuseboardData,
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
  comments: z.array(commentSchema),
  exports: z.array(exportManifestSchema),
  publishReceipts: z.array(publishReceiptSchema),
  metrics: metricSamplesSchema,
  learnings: z.array(learningSchema),
  entitlementUsage: entitlementUsageSchema,
});

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

  return {
    ...state,
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
  chooseHook: (contentId: string, hookId: string, at?: string) => void;
  moveTask: (contentId: string, stage: WorkflowStage, at?: string) => void;
  addComment: (
    contentId: string,
    body: string,
    author?: string,
    at?: string,
  ) => void;
  approveVersion: (contentId: string, approvedBy?: string, at?: string) => void;
  createExport: (contentId: string, requestedBy?: string, at?: string) => string | undefined;
  recordPublishReceipt: (receipt: unknown) => boolean;
  importMetrics: (metrics: unknown) => boolean;
  dismissLearning: (learningId: string, at?: string) => void;
}

export type MuseboardState = DemoMuseboardData & MuseboardActions;

function now(): string {
  return new Date().toISOString();
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
    comments: state.comments,
    exports: state.exports,
    publishReceipts: state.publishReceipts,
    metrics: state.metrics,
    learnings: state.learnings,
    entitlementUsage: state.entitlementUsage,
  };
}

export const useMuseboardStore = create<MuseboardState>()(
  persist<MuseboardState, [], [], DemoMuseboardData>(
    (set, get) => ({
      ...createDemoState(),

      resetDemo: () => set(createDemoState()),

      completeOnboarding: (workspace) => {
        const parsed = starterWorkspaceSchema.parse(workspace);
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
        const reference: VisionReference = visionReferenceSchema.parse({
          ...validation.input,
          id: `reference-${validation.input.sha256.slice(0, 16)}`,
          addedAt: at,
          provenance: { provider: "museboard-local", mode: "sample" },
        });
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

      chooseHook: (contentId, hookId, at = now()) => {
        const hookExists = get().hooks.some(
          (hook) => hook.id === hookId && hook.contentId === contentId,
        );
        if (!hookExists) return;

        set((state) => ({
          content: state.content.map((item) =>
            item.id === contentId
              ? transitionStage(item, {
                  type: "EDIT",
                  field: "hook",
                  value: hookId,
                  at,
                })
              : item,
          ),
        }));
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

      addComment: (contentId, body, author = "You", at = now()) => {
        if (!get().content.some(({ id }) => id === contentId)) return;
        const comment: Comment = commentSchema.parse({
          id: `${contentId}-comment-${get().comments.length + 1}`,
          contentId,
          author,
          body,
          createdAt: at,
        });
        set((state) => ({ comments: [...state.comments, comment] }));
      },

      approveVersion: (contentId, approvedBy = "You", at = now()) => {
        set((state) => ({
          content: state.content.map((item) =>
            item.id === contentId
              ? approveCurrentVersion(item, approvedBy, at)
              : item,
          ),
        }));
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
        const parsed = persistedMuseboardSchema.safeParse(
          upgradePersistedMuseboardData(persisted),
        );
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

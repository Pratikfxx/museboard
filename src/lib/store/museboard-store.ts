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
import { opportunitySchema } from "@/domain/opportunities";
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

interface MuseboardActions {
  resetDemo: () => void;
  completeOnboarding: (workspace: StarterWorkspace) => void;
  selectOpportunity: (opportunityId: string) => void;
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
          hooks: parsed.hooks,
          content: parsed.content,
          plannerTasks: parsed.plannerTasks,
        });
      },

      selectOpportunity: (opportunityId) => {
        if (!get().opportunities.some(({ id }) => id === opportunityId)) return;
        set({ selectedOpportunityId: opportunityId });
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
        const parsed = persistedMuseboardSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

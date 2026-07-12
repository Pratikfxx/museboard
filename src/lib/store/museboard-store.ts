"use client";

import { z } from "zod";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { deriveLearnings, metricSamplesSchema } from "@/domain/analytics";
import { entitlementUsageSchema } from "@/domain/entitlements";
import { buildExportManifest, exportManifestSchema } from "@/domain/export";
import { opportunitySchema } from "@/domain/opportunities";
import { plannerTaskSchema } from "@/domain/planner";
import {
  commentSchema,
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
  createDemoState,
  type CreatorProfile,
  type DemoMuseboardData,
} from "@/lib/demo/fixtures";

export const MUSEBOARD_STORAGE_KEY = "museboard-demo-v1";

const creatorProfileSchema: z.ZodType<CreatorProfile> = z.object({
  name: z.string().trim().min(1),
  archetype: creatorArchetypeSchema,
  weeklyCapacityMinutes: z.number().int().positive(),
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
  completeOnboarding: (profile: CreatorProfile) => void;
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

      completeOnboarding: (profile) => {
        const parsed = creatorProfileSchema.parse(profile);
        set({ onboardingComplete: true, creator: parsed });
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
          const metrics = [...state.metrics, ...parsed.data];
          return { metrics, learnings: deriveLearnings(metrics) };
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
      storage: createJSONStorage(() => localStorage),
      partialize: persistedState,
      merge: (persisted, current) => {
        const parsed = persistedMuseboardSchema.safeParse(persisted);
        return parsed.success ? { ...current, ...parsed.data } : current;
      },
    },
  ),
);

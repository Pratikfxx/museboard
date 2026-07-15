import { z } from "zod";

import {
  opportunityFormatSchema,
  type Opportunity,
  type OpportunityFormat,
} from "@/domain/opportunities";
import type { ContentItem, Learning } from "@/domain/schema";

export const CONTENT_HYPOTHESIS_STATUSES = [
  "planned",
  "running",
  "measured",
  "discarded",
] as const;
export type ContentHypothesisStatus = (typeof CONTENT_HYPOTHESIS_STATUSES)[number];

export interface ContentHypothesis {
  id: string;
  contentId: string;
  statement: string;
  status: ContentHypothesisStatus;
  learningId?: string;
  opportunityId?: string;
  expectedOutcome?: string;
  createdAt: string;
  measuredAt?: string;
}

export interface ContentSeries {
  id: string;
  title: string;
  goal: string;
  status: "draft" | "active" | "complete";
  contentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatorMemory {
  version: number;
  preferredPhrases: string[];
  avoidPhrases: string[];
  preferredStructures: string[];
  notes: string[];
  updatedAt: string;
}

export interface OpportunityFeedback {
  id: string;
  opportunityId: string;
  signal: "more_like_this" | "not_for_me";
  pillar: string;
  format: OpportunityFormat;
  createdAt: string;
}

export interface OfflineCapture {
  id: string;
  text: string;
  createdAt: string;
  status: "queued" | "promoted" | "dismissed";
  promotedOpportunityId?: string;
}

export interface WorkspaceRecoveryNotice {
  id: string;
  kind: "corrupt_json" | "invalid_workspace" | "storage_unavailable";
  title: string;
  detail: string;
  backupKey?: string;
  detectedAt: string;
}

export interface CreatorNextAction {
  kind: "apply_learning" | "continue_series" | "shape_opportunity" | "capture_idea";
  title: string;
  reason: string;
  evidenceLabel: string;
  confidence?: Learning["confidence"];
  href: string;
  sourceId?: string;
}

export const contentHypothesisSchema: z.ZodType<ContentHypothesis> = z.object({
  id: z.string().min(1),
  contentId: z.string().min(1),
  statement: z.string().trim().min(1),
  status: z.enum(CONTENT_HYPOTHESIS_STATUSES),
  learningId: z.string().min(1).optional(),
  opportunityId: z.string().min(1).optional(),
  expectedOutcome: z.string().trim().min(1).optional(),
  createdAt: z.iso.datetime(),
  measuredAt: z.iso.datetime().optional(),
});

export const contentSeriesSchema: z.ZodType<ContentSeries> = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  status: z.enum(["draft", "active", "complete"]),
  contentIds: z.array(z.string().min(1)).min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const creatorMemorySchema: z.ZodType<CreatorMemory> = z.object({
  version: z.number().int().positive(),
  preferredPhrases: z.array(z.string().trim().min(1)),
  avoidPhrases: z.array(z.string().trim().min(1)),
  preferredStructures: z.array(z.string().trim().min(1)),
  notes: z.array(z.string().trim().min(1)),
  updatedAt: z.iso.datetime(),
});

export const opportunityFeedbackSchema: z.ZodType<OpportunityFeedback> = z.object({
  id: z.string().min(1),
  opportunityId: z.string().min(1),
  signal: z.enum(["more_like_this", "not_for_me"]),
  pillar: z.string().min(1),
  format: opportunityFormatSchema,
  createdAt: z.iso.datetime(),
});

export const offlineCaptureSchema: z.ZodType<OfflineCapture> = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  status: z.enum(["queued", "promoted", "dismissed"]),
  promotedOpportunityId: z.string().min(1).optional(),
});

export const workspaceRecoveryNoticeSchema: z.ZodType<WorkspaceRecoveryNotice> = z.object({
  id: z.string().min(1),
  kind: z.enum(["corrupt_json", "invalid_workspace", "storage_unavailable"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  backupKey: z.string().min(1).optional(),
  detectedAt: z.iso.datetime(),
});

export const EMPTY_CREATOR_MEMORY: CreatorMemory = {
  version: 1,
  preferredPhrases: [],
  avoidPhrases: [],
  preferredStructures: [],
  notes: [],
  updatedAt: "2026-07-13T09:00:00.000Z",
};

function confidenceWeight(confidence: Learning["confidence"]): number {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

function sentenceLead(statement: string): string {
  return statement.split(/(?<=[.!?])\s/u)[0]?.replace(/[.!?]$/u, "") ?? statement;
}

export function createSeriesFromContent(input: {
  contentId: string;
  title: string;
  goal: string;
  at: string;
}): ContentSeries {
  return contentSeriesSchema.parse({
    id: `series-${input.contentId}`,
    title: input.title.trim(),
    goal: input.goal.trim(),
    status: "active",
    contentIds: [input.contentId],
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export function applyLearningAsHypothesis(
  content: ContentItem,
  learning: Learning,
  at: string,
): ContentHypothesis {
  return contentHypothesisSchema.parse({
    id: `hypothesis-${content.id}-${learning.id}`,
    contentId: content.id,
    learningId: learning.id,
    opportunityId: content.opportunityId,
    statement: `${sentenceLead(learning.statement)} for ${content.title}.`,
    expectedOutcome: learning.metricDefinition,
    status: "planned",
    createdAt: at,
  });
}

export function personalizeOpportunityScore(
  opportunity: Opportunity,
  feedback: OpportunityFeedback[],
): { score: number; adjustment: number; explanation: string } {
  const base =
    opportunity.signals.relevance * 0.4 +
    opportunity.signals.momentum * 0.3 +
    opportunity.signals.originality * 0.15 +
    opportunity.signals.creatorFit * 0.15;
  let adjustment = 0;
  for (const item of feedback) {
    const direction = item.signal === "more_like_this" ? 1 : -1;
    if (item.pillar === opportunity.pillar) adjustment += direction * 6;
    if (item.format === opportunity.format) adjustment += direction * 4;
  }
  const bounded = Math.max(0, Math.min(100, base + adjustment));
  return {
    score: Number(bounded.toFixed(2)),
    adjustment,
    explanation:
      adjustment > 0
        ? "More like this feedback raised the fit for this pillar and format."
        : adjustment < 0
          ? "Not for me feedback lowered the fit for this pillar and format."
          : "No preference adjustment yet; source signals determine the fit.",
  };
}

interface IntelligenceState {
  learnings: Learning[];
  series: ContentSeries[];
  content: ContentItem[];
  opportunities: Opportunity[];
  opportunityFeedback: OpportunityFeedback[];
}

export function recommendNextCreatorAction(
  state: IntelligenceState,
  at: string,
): CreatorNextAction {
  void at;
  const activeLearning = [...state.learnings]
    .filter(({ dismissedAt }) => !dismissedAt)
    .sort(
      (left, right) =>
        confidenceWeight(right.confidence) - confidenceWeight(left.confidence) ||
        Math.abs(right.effectPercent ?? 0) - Math.abs(left.effectPercent ?? 0) ||
        right.sampleSize - left.sampleSize,
    )[0];
  if (activeLearning) {
    return {
      kind: "apply_learning",
      title: sentenceLead(activeLearning.statement),
      reason: `Based on ${activeLearning.sampleSize} comparable posts. Use it as a test, not a guarantee.`,
      evidenceLabel: `${activeLearning.confidence[0].toUpperCase()}${activeLearning.confidence.slice(1)}-confidence learning`,
      confidence: activeLearning.confidence,
      href: `/app/learn?learningId=${encodeURIComponent(activeLearning.id)}`,
      sourceId: activeLearning.id,
    };
  }

  const unfinishedSeries = state.series.find((series) =>
    series.status === "active" &&
    series.contentIds.some((contentId) => {
      const item = state.content.find(({ id }) => id === contentId);
      return item && !["published", "measured", "archived"].includes(item.stage);
    }),
  );
  if (unfinishedSeries) {
    return {
      kind: "continue_series",
      title: `Continue ${unfinishedSeries.title}`,
      reason: unfinishedSeries.goal,
      evidenceLabel: "Active series",
      href: `/app/plan?seriesId=${encodeURIComponent(unfinishedSeries.id)}`,
      sourceId: unfinishedSeries.id,
    };
  }

  const opportunity = [...state.opportunities]
    .map((candidate) => ({
      candidate,
      adapted: personalizeOpportunityScore(candidate, state.opportunityFeedback),
    }))
    .sort((left, right) => right.adapted.score - left.adapted.score)[0];
  if (opportunity) {
    return {
      kind: "shape_opportunity",
      title: opportunity.candidate.title,
      reason: opportunity.adapted.explanation,
      evidenceLabel: `${Math.round(opportunity.adapted.score)} creator-fit score`,
      href: `/app/opportunities?opportunityId=${encodeURIComponent(opportunity.candidate.id)}`,
      sourceId: opportunity.candidate.id,
    };
  }

  return {
    kind: "capture_idea",
    title: "Capture the thought you do not want to lose",
    reason: "Museboard needs one real creator input before it can recommend a next move.",
    evidenceLabel: "Creator input",
    href: "/app/today#quick-capture",
  };
}

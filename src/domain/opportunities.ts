import { z } from "zod";

import type {
  ContentPlatform,
  CreatorArchetype,
  DataMode,
} from "@/domain/schema";
import {
  contentPlatformSchema,
  creatorArchetypeSchema,
  dataModeSchema,
} from "@/domain/schema";

export const OPPORTUNITY_FORMATS = [
  "tutorial",
  "behind_scenes",
  "story",
  "demonstration",
] as const;
export type OpportunityFormat = (typeof OPPORTUNITY_FORMATS)[number];

export const OPPORTUNITY_GOALS = [
  "reach",
  "trust",
  "community",
  "conversion",
] as const;
export type OpportunityGoal = (typeof OPPORTUNITY_GOALS)[number];

export const OPPORTUNITY_READINESS = ["spark", "shape", "ready"] as const;
export type OpportunityReadiness = (typeof OPPORTUNITY_READINESS)[number];

export const OPPORTUNITY_SOURCE_CLASSES = [
  "official_platform",
  "public_research",
  "creator_submission",
  "licensed_editorial",
] as const;
export type OpportunitySourceClass =
  (typeof OPPORTUNITY_SOURCE_CLASSES)[number];

export const opportunityFormatSchema = z.enum(OPPORTUNITY_FORMATS);
export const opportunityGoalSchema = z.enum(OPPORTUNITY_GOALS);
export const opportunityReadinessSchema = z.enum(OPPORTUNITY_READINESS);
export const opportunitySourceClassSchema = z.enum(OPPORTUNITY_SOURCE_CLASSES);

export interface Opportunity {
  id: string;
  title: string;
  summary: string;
  platform: ContentPlatform;
  archetypes: CreatorArchetype[];
  format: OpportunityFormat;
  pillar: string;
  readiness: OpportunityReadiness;
  goal: OpportunityGoal;
  geography: string;
  signals: {
    relevance: number;
    momentum: number;
    originality: number;
    creatorFit: number;
  };
  evidence: Array<{
    summary: string;
    sourceLabel: string;
  }>;
  provenance: {
    provider: string;
    mode: DataMode;
    fetchedAt: string;
    sourceClass: OpportunitySourceClass;
    sourceLabel: string;
    observedAt: string;
    expiresAt: string;
    sourceUrl?: string;
  };
}

export const OPPORTUNITY_RANKING_WEIGHTS = Object.freeze({
  relevance: 0.4,
  momentum: 0.3,
  originality: 0.15,
  creatorFit: 0.15,
}) satisfies Readonly<Record<keyof Opportunity["signals"], number>>;

export interface OpportunityRanking {
  score: number;
  factorBreakdown: Record<keyof Opportunity["signals"], number>;
  evidenceComplete: boolean;
}

export interface RankedOpportunity extends Opportunity {
  rankScore: number;
  scoreContributions: Record<keyof Opportunity["signals"], number>;
  evidenceComplete: boolean;
}

export interface IdeaRecord {
  id: string;
  opportunityId: string;
  title: string;
  summary: string;
  platform: ContentPlatform;
  format: OpportunityFormat;
  pillar: string;
  readiness: OpportunityReadiness;
  goal: OpportunityGoal;
  createdAt: string;
  promotedContentId?: string;
  provenance: {
    opportunityId: string;
    provider: string;
    mode: DataMode;
    sourceUrl?: string;
  };
}

export const VISION_REFERENCE_KINDS = ["url", "file"] as const;
export type VisionReferenceKind = (typeof VISION_REFERENCE_KINDS)[number];

export const VISION_RIGHTS_STATUSES = [
  "owned",
  "licensed",
  "permission",
  "public_domain",
  "unknown",
] as const;
export type VisionRightsStatus = (typeof VISION_RIGHTS_STATUSES)[number];

export interface VisionReference {
  id: string;
  kind: VisionReferenceKind;
  title: string;
  url?: string;
  fileName?: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  rightsStatus: VisionRightsStatus;
  addedAt: string;
  provenance: {
    provider: "museboard-local";
    mode: "sample";
  };
}

const scoreSchema = z.number().min(0).max(100);
const httpsUrlSchema = z
  .url()
  .refine((url) => url.startsWith("https://"), {
    message: "Source URL must use HTTPS",
  });

export const opportunitySchema: z.ZodType<Opportunity> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  platform: contentPlatformSchema,
  archetypes: z.array(creatorArchetypeSchema).min(1),
  format: opportunityFormatSchema,
  pillar: z.string().trim().min(1),
  readiness: opportunityReadinessSchema,
  goal: opportunityGoalSchema,
  geography: z.string().trim().min(1),
  signals: z.object({
    relevance: scoreSchema,
    momentum: scoreSchema,
    originality: scoreSchema,
    creatorFit: scoreSchema,
  }),
  evidence: z
    .array(
      z.object({
        summary: z.string().trim().min(1).max(280),
        sourceLabel: z.string().trim().min(1),
      }),
    )
    .max(6),
  provenance: z.object({
    provider: z.string().min(1),
    mode: dataModeSchema,
    fetchedAt: z.iso.datetime(),
    sourceClass: opportunitySourceClassSchema,
    sourceLabel: z.string().trim().min(1),
    sourceUrl: httpsUrlSchema.optional(),
    observedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  }),
});

export const opportunitiesSchema = z.array(opportunitySchema);

export const ideaRecordSchema: z.ZodType<IdeaRecord> = z.object({
  id: z.string().min(1),
  opportunityId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  platform: contentPlatformSchema,
  format: opportunityFormatSchema,
  pillar: z.string().min(1),
  readiness: opportunityReadinessSchema,
  goal: opportunityGoalSchema,
  createdAt: z.iso.datetime(),
  promotedContentId: z.string().min(1).optional(),
  provenance: z.object({
    opportunityId: z.string().min(1),
    provider: z.string().min(1),
    mode: dataModeSchema,
    sourceUrl: httpsUrlSchema.optional(),
  }),
});

export const visionReferenceSchema: z.ZodType<VisionReference> = z.object({
  id: z.string().min(1),
  kind: z.enum(VISION_REFERENCE_KINDS),
  title: z.string().trim().min(1),
  url: httpsUrlSchema.optional(),
  fileName: z.string().trim().min(1).optional(),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f\d]{64}$/iu),
  rightsStatus: z.enum(VISION_RIGHTS_STATUSES),
  addedAt: z.iso.datetime(),
  provenance: z.object({
    provider: z.literal("museboard-local"),
    mode: z.literal("sample"),
  }),
});

export function parseOpportunities(payload: unknown): Opportunity[] {
  return opportunitiesSchema.parse(payload);
}

function factorBreakdown(
  opportunity: Opportunity,
): OpportunityRanking["factorBreakdown"] {
  return {
    relevance: Number(
      (
        opportunity.signals.relevance * OPPORTUNITY_RANKING_WEIGHTS.relevance
      ).toFixed(2),
    ),
    momentum: Number(
      (
        opportunity.signals.momentum * OPPORTUNITY_RANKING_WEIGHTS.momentum
      ).toFixed(2),
    ),
    originality: Number(
      (
        opportunity.signals.originality *
        OPPORTUNITY_RANKING_WEIGHTS.originality
      ).toFixed(2),
    ),
    creatorFit: Number(
      (
        opportunity.signals.creatorFit * OPPORTUNITY_RANKING_WEIGHTS.creatorFit
      ).toFixed(2),
    ),
  };
}

export function rankOpportunity(opportunity: Opportunity): OpportunityRanking {
  const breakdown = factorBreakdown(opportunity);
  const evidenceComplete = Boolean(
    opportunity.provenance.sourceUrl && opportunity.evidence.length > 0,
  );
  const rawScore = Number(
    Object.values(breakdown)
      .reduce((sum, contribution) => sum + contribution, 0)
      .toFixed(2),
  );
  return {
    score: evidenceComplete ? rawScore : Math.min(rawScore, 95),
    factorBreakdown: breakdown,
    evidenceComplete,
  };
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function rankOpportunities(
  opportunities: Opportunity[],
): RankedOpportunity[] {
  return opportunities
    .map((opportunity) => {
      const ranking = rankOpportunity(opportunity);
      return {
        ...opportunity,
        rankScore: ranking.score,
        scoreContributions: ranking.factorBreakdown,
        evidenceComplete: ranking.evidenceComplete,
      };
    })
    .sort(
      (left, right) =>
        right.rankScore - left.rankScore || ordinalCompare(left.id, right.id),
    );
}

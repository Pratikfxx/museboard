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

export interface Opportunity {
  id: string;
  title: string;
  summary: string;
  platform: ContentPlatform;
  archetypes: CreatorArchetype[];
  signals: {
    relevance: number;
    momentum: number;
    originality: number;
    creatorFit: number;
  };
  provenance: {
    provider: string;
    mode: DataMode;
    fetchedAt: string;
    sourceUrl?: string;
  };
}

export const OPPORTUNITY_RANKING_WEIGHTS = Object.freeze({
  relevance: 0.4,
  momentum: 0.3,
  originality: 0.15,
  creatorFit: 0.15,
}) satisfies Readonly<Record<keyof Opportunity["signals"], number>>;

export interface RankedOpportunity extends Opportunity {
  rankScore: number;
  scoreContributions: Record<keyof Opportunity["signals"], number>;
}

const scoreSchema = z.number().min(0).max(100);

export const opportunitySchema: z.ZodType<Opportunity> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  platform: contentPlatformSchema,
  archetypes: z.array(creatorArchetypeSchema).min(1),
  signals: z.object({
    relevance: scoreSchema,
    momentum: scoreSchema,
    originality: scoreSchema,
    creatorFit: scoreSchema,
  }),
  provenance: z.object({
    provider: z.string().min(1),
    mode: dataModeSchema,
    fetchedAt: z.iso.datetime(),
    sourceUrl: z.url().optional(),
  }),
});

export const opportunitiesSchema = z.array(opportunitySchema);

export function parseOpportunities(payload: unknown): Opportunity[] {
  return opportunitiesSchema.parse(payload);
}

function scoreContributions(
  opportunity: Opportunity,
): RankedOpportunity["scoreContributions"] {
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
        opportunity.signals.originality * OPPORTUNITY_RANKING_WEIGHTS.originality
      ).toFixed(2),
    ),
    creatorFit: Number(
      (
        opportunity.signals.creatorFit * OPPORTUNITY_RANKING_WEIGHTS.creatorFit
      ).toFixed(2),
    ),
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
      const contributions = scoreContributions(opportunity);
      return {
        ...opportunity,
        rankScore: Number(
          Object.values(contributions)
            .reduce((sum, contribution) => sum + contribution, 0)
            .toFixed(2),
        ),
        scoreContributions: contributions,
      };
    })
    .sort(
      (left, right) =>
        right.rankScore - left.rankScore || ordinalCompare(left.id, right.id),
    );
}

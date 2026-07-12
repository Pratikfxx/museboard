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

export interface RankedOpportunity extends Opportunity {
  rankScore: number;
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

function score(opportunity: Opportunity): number {
  const { relevance, momentum, originality, creatorFit } = opportunity.signals;
  return Number(
    (
      relevance * 0.4 +
      momentum * 0.3 +
      originality * 0.15 +
      creatorFit * 0.15
    ).toFixed(2),
  );
}

export function rankOpportunities(
  opportunities: Opportunity[],
): RankedOpportunity[] {
  return opportunities
    .map((opportunity) => ({ ...opportunity, rankScore: score(opportunity) }))
    .sort(
      (left, right) =>
        right.rankScore - left.rankScore || left.id.localeCompare(right.id),
    );
}

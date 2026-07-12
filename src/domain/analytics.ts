import { z } from "zod";

import type { ContentPlatform, DataMode, Learning } from "@/domain/schema";
import {
  contentPlatformSchema,
  dataModeSchema,
} from "@/domain/schema";

export interface MetricSample {
  contentId: string;
  platform: ContentPlatform;
  metricKey: string;
  metricDefinition: string;
  value: number;
  sampleSize: number;
  sourceSampleId: string;
  measuredAt?: string;
  provenance: {
    provider: string;
    mode: DataMode;
    importedAt: string;
    sourceUrl?: string;
  };
}

export const metricSampleSchema: z.ZodType<MetricSample> = z.object({
  contentId: z.string().min(1),
  platform: contentPlatformSchema,
  metricKey: z.string().min(1),
  metricDefinition: z.string().min(1),
  value: z.number().finite(),
  sampleSize: z.number().int().positive(),
  sourceSampleId: z.string().min(1),
  measuredAt: z.iso.datetime().optional(),
  provenance: z.object({
    provider: z.string().min(1),
    mode: dataModeSchema,
    importedAt: z.iso.datetime(),
    sourceUrl: z.url().optional(),
  }),
});

export const metricSamplesSchema = z.array(metricSampleSchema);

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function stableDefinitionIdentity(definition: string): string {
  return encodeURIComponent(definition);
}

export function metricSampleDedupKey(metric: MetricSample): string {
  return JSON.stringify([
    metric.provenance.provider,
    metric.sourceSampleId,
    metric.contentId,
    metric.platform,
    metric.metricKey,
    metric.metricDefinition,
  ]);
}

function coefficientOfVariation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return values.every((value) => value === 0) ? 0 : Infinity;

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

function confidenceFor(
  contentCount: number,
  sampleSize: number,
  variation: number,
): Learning["confidence"] {
  if (contentCount >= 10 && sampleSize >= 100 && variation <= 0.15) {
    return "high";
  }

  if (contentCount >= 5 && sampleSize >= 50 && variation <= 0.3) {
    return "medium";
  }

  return "low";
}

export function deriveLearnings(metrics: MetricSample[]): Learning[] {
  const groups = new Map<string, MetricSample[]>();

  for (const metric of metrics) {
    const key = `${metric.platform}\u0000${metric.metricKey}\u0000${metric.metricDefinition}`;
    groups.set(key, [...(groups.get(key) ?? []), metric]);
  }

  return [...groups.values()]
    .map((group): Learning | undefined => {
      const contentIds = [...new Set(group.map((metric) => metric.contentId))].sort();
      const sampleSize = group.reduce(
        (sum, metric) => sum + metric.sampleSize,
        0,
      );

      if (contentIds.length < 3 || sampleSize < 30) return undefined;

      const [first] = group;
      const weightedAverage =
        group.reduce(
          (sum, metric) => sum + metric.value * metric.sampleSize,
          0,
        ) / sampleSize;
      const confidence = confidenceFor(
        contentIds.length,
        sampleSize,
        coefficientOfVariation(group.map((metric) => metric.value)),
      );

      return {
        id: `learning-${slug(first.platform)}-${slug(first.metricKey)}-${stableDefinitionIdentity(first.metricDefinition)}`,
        metricKey: first.metricKey,
        metricDefinition: first.metricDefinition,
        platform: first.platform,
        statement: `${first.metricDefinition} averages ${weightedAverage.toFixed(2)} across ${contentIds.length} ${first.platform.replaceAll("_", " ")} posts.`,
        sampleSize,
        confidence,
        includedContentIds: contentIds,
      };
    })
    .filter((learning): learning is Learning => learning !== undefined)
    .sort(
      (left, right) =>
        left.platform.localeCompare(right.platform) ||
        left.metricKey.localeCompare(right.metricKey),
    );
}

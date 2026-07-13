import Papa from "papaparse";
import { z } from "zod";

import type { ContentPlatform, DataMode, Learning } from "@/domain/schema";
import { contentPlatformSchema, dataModeSchema } from "@/domain/schema";

export const COMPARISON_DIMENSIONS = ["hook_strategy", "content_pillar", "format", "opening_style", "cta_style", "posting_time"] as const;
export type ComparisonDimension = (typeof COMPARISON_DIMENSIONS)[number];

export interface MetricSample {
  contentId: string;
  platform: ContentPlatform;
  metricKey: string;
  metricDefinition: string;
  value: number;
  sampleSize: number;
  sourceSampleId: string;
  measuredAt?: string;
  externalPostId?: string;
  publishedAt?: string;
  reportingWindow?: string;
  rawMetricName?: string;
  semanticCategory?: string;
  unit?: "count" | "percent" | "seconds" | "ratio";
  format?: string;
  comparisonDimension?: ComparisonDimension;
  comparisonGroup?: string;
  importId?: string;
  sourceRow?: number;
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
  value: z.number().finite().nonnegative(),
  sampleSize: z.number().int().positive(),
  sourceSampleId: z.string().min(1),
  measuredAt: z.iso.datetime().optional(),
  externalPostId: z.string().min(1).optional(),
  publishedAt: z.iso.datetime().optional(),
  reportingWindow: z.string().min(1).optional(),
  rawMetricName: z.string().min(1).optional(),
  semanticCategory: z.string().min(1).optional(),
  unit: z.enum(["count", "percent", "seconds", "ratio"]).optional(),
  format: z.string().min(1).optional(),
  comparisonDimension: z.enum(COMPARISON_DIMENSIONS).optional(),
  comparisonGroup: z.string().min(1).optional(),
  importId: z.string().min(1).optional(),
  sourceRow: z.number().int().positive().optional(),
  provenance: z.object({
    provider: z.string().min(1),
    mode: dataModeSchema,
    importedAt: z.iso.datetime(),
    sourceUrl: z.url().optional(),
  }),
});

export const metricSamplesSchema = z.array(metricSampleSchema);

export type AnalyticsColumn = "content_id" | "platform" | "post_url" | "published_at" | "format" | "metric_name" | "metric_value" | "unit" | "reporting_window" | "dimension" | "group";
export type AnalyticsMapping = Record<AnalyticsColumn, string>;
export type DuplicatePolicy = "skip" | "replace" | "cancel";

export interface AnalyticsImportPreview {
  importId: string;
  headers: string[];
  facts: MetricSample[];
  errors: Array<{ row: number; message: string }>;
  unknownFields: string[];
  duplicateKeys: string[];
}

const defaultMapping: AnalyticsMapping = {
  content_id: "content_id", platform: "platform", post_url: "post_url", published_at: "published_at", format: "format",
  metric_name: "metric_name", metric_value: "metric_value", unit: "unit", reporting_window: "reporting_window", dimension: "dimension", group: "group",
};

const metricDefinitions: Record<string, { definition: string; semantic: string }> = {
  views: { definition: "Platform-reported views", semantic: "exposure" },
  plays: { definition: "Platform-reported plays", semantic: "exposure" },
  reach: { definition: "Platform-reported unique reach", semantic: "reach" },
  impressions: { definition: "Platform-reported impressions", semantic: "impressions" },
  completion_rate: { definition: "Share of viewers who reached the end", semantic: "retention" },
  retention_3s: { definition: "Share of viewers still watching at three seconds", semantic: "retention" },
  watch_time_seconds: { definition: "Platform-reported watch time in seconds", semantic: "watch_time" },
};

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/(^-|-$)/gu, "");
}

function stableDefinitionIdentity(definition: string): string {
  return encodeURIComponent(definition);
}

export function metricSampleDedupKey(metric: MetricSample): string {
  if (metric.externalPostId && metric.rawMetricName && metric.reportingWindow) {
    return JSON.stringify([metric.platform, metric.externalPostId, metric.rawMetricName, metric.reportingWindow]);
  }
  return JSON.stringify([metric.provenance.provider, metric.sourceSampleId, metric.contentId, metric.platform, metric.metricKey, metric.metricDefinition]);
}

function coefficientOfVariation(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return values.every((value) => value === 0) ? 0 : Infinity;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function legacyLearnings(metrics: MetricSample[]): Learning[] {
  const groups = new Map<string, MetricSample[]>();
  for (const metric of metrics.filter((candidate) => !candidate.comparisonDimension || !candidate.comparisonGroup)) {
    const key = `${metric.platform}\u0000${metric.metricKey}\u0000${metric.metricDefinition}`;
    groups.set(key, [...(groups.get(key) ?? []), metric]);
  }
  return [...groups.values()].map((group): Learning | undefined => {
    const contentIds = [...new Set(group.map(({ contentId }) => contentId))].sort();
    const sampleSize = group.reduce((sum, metric) => sum + metric.sampleSize, 0);
    if (contentIds.length < 3 || sampleSize < 30) return undefined;
    const [first] = group;
    const average = group.reduce((sum, metric) => sum + metric.value * metric.sampleSize, 0) / sampleSize;
    const variation = coefficientOfVariation(group.map(({ value }) => value));
    const confidence = contentIds.length >= 10 && sampleSize >= 100 && variation <= 0.15 ? "high" : contentIds.length >= 5 && sampleSize >= 50 && variation <= 0.3 ? "medium" : "low";
    return {
      id: `learning-${slug(first.platform)}-${slug(first.metricKey)}-${stableDefinitionIdentity(first.metricDefinition)}`,
      metricKey: first.metricKey, metricDefinition: first.metricDefinition, platform: first.platform,
      statement: `${first.metricDefinition} averages ${average.toFixed(2)} across ${contentIds.length} ${first.platform.replaceAll("_", " ")} posts.`,
      sampleSize, confidence, includedContentIds: contentIds,
    };
  }).filter((learning): learning is Learning => Boolean(learning));
}

function stableAcrossWindows(groupA: MetricSample[], groupB: MetricSample[]): boolean {
  const buckets = new Map<string, { a: number[]; b: number[] }>();
  for (const metric of groupA) {
    const bucket = metric.publishedAt?.slice(0, 7) ?? "unknown";
    const entry = buckets.get(bucket) ?? { a: [], b: [] }; entry.a.push(metric.value); buckets.set(bucket, entry);
  }
  for (const metric of groupB) {
    const bucket = metric.publishedAt?.slice(0, 7) ?? "unknown";
    const entry = buckets.get(bucket) ?? { a: [], b: [] }; entry.b.push(metric.value); buckets.set(bucket, entry);
  }
  return [...buckets.values()].filter(({ a, b }) => a.length && b.length).filter(({ a, b }) => median(a) > median(b)).length >= 2;
}

export function deriveLearnings(metrics: MetricSample[], recomputedAt?: string): Learning[] {
  const learnings = legacyLearnings(metrics);
  const comparable = metrics.filter((metric) => metric.comparisonDimension && metric.comparisonGroup && metric.format && metric.rawMetricName && metric.unit && metric.reportingWindow);
  const groups = new Map<string, MetricSample[]>();
  for (const metric of comparable) {
    const key = [metric.platform, metric.format, metric.rawMetricName, metric.unit, metric.reportingWindow, metric.comparisonDimension].join("\u0000");
    groups.set(key, [...(groups.get(key) ?? []), metric]);
  }
  for (const [identity, samples] of groups) {
    const byGroup = new Map<string, MetricSample[]>();
    for (const sample of samples) byGroup.set(sample.comparisonGroup!, [...(byGroup.get(sample.comparisonGroup!) ?? []), sample]);
    const ranked = [...byGroup.entries()].sort((left, right) => median(right[1].map(({ value }) => value)) - median(left[1].map(({ value }) => value)));
    if (ranked.length < 2) continue;
    const [winnerName, winner] = ranked[0];
    const [baselineName, baseline] = ranked.at(-1)!;
    const uniqueWinner = [...new Set(winner.map(({ contentId }) => contentId))];
    const uniqueBaseline = [...new Set(baseline.map(({ contentId }) => contentId))];
    if (uniqueWinner.length < 3 || uniqueBaseline.length < 3) continue;
    const winnerMedian = median(winner.map(({ value }) => value));
    const baselineMedian = median(baseline.map(({ value }) => value));
    const effect = baselineMedian === 0 ? 0 : ((winnerMedian - baselineMedian) / Math.abs(baselineMedian)) * 100;
    const stable = stableAcrossWindows(winner, baseline);
    const confidence: Learning["confidence"] = uniqueWinner.length >= 10 && uniqueBaseline.length >= 10 && effect >= 15 && stable ? "high" : uniqueWinner.length >= 5 && uniqueBaseline.length >= 5 && effect >= 10 ? "medium" : "low";
    const first = winner[0];
    const included = [...new Set([...uniqueWinner, ...uniqueBaseline])].sort();
    const excluded = metrics.filter((metric) => !included.includes(metric.contentId)).map(({ contentId }) => contentId).filter((id, index, all) => all.indexOf(id) === index).sort();
    learnings.push({
      id: `learning-association-${slug(identity)}-${slug(winnerName)}-${slug(baselineName)}`,
      metricKey: first.metricKey,
      metricDefinition: `${first.metricDefinition}; ${first.reportingWindow} reporting window, ${first.unit}`,
      platform: first.platform,
      statement: `${winnerName} is associated with ${effect.toFixed(1)}% higher median ${first.rawMetricName} than ${baselineName}. This is an association, not proof of causation.`,
      sampleSize: included.length,
      confidence,
      includedContentIds: included,
      excludedContentIds: excluded,
      effectPercent: Number(effect.toFixed(1)),
      comparison: `${first.comparisonDimension}: ${winnerName} vs ${baselineName}`,
      confidenceRule: confidence === "high" ? "10+ posts per group, 15%+ effect, same direction in two non-overlapping month windows" : confidence === "medium" ? "5+ posts per group and 10%+ effect" : "3+ posts per group; directional evidence only",
      lastRecomputedAt: recomputedAt,
    });
  }
  return learnings.sort((left, right) => left.platform.localeCompare(right.platform) || left.metricKey.localeCompare(right.metricKey));
}

function normalizedPlatform(value: string): ContentPlatform | undefined {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/gu, "_");
  if (["instagram", "instagram_reel", "instagram_reels"].includes(normalized)) return "instagram_reels";
  if (["tiktok", "tiktok_video"].includes(normalized)) return "tiktok_video";
  if (["youtube", "youtube_short", "youtube_shorts"].includes(normalized)) return "youtube_shorts";
  return undefined;
}

function postUrlForPlatform(value: string, platform?: ContentPlatform): URL | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return undefined;
    const host = url.hostname.toLowerCase();
    const matches = platform === "instagram_reels" ? host === "instagram.com" || host.endsWith(".instagram.com") : platform === "tiktok_video" ? host === "tiktok.com" || host.endsWith(".tiktok.com") : platform === "youtube_shorts" ? host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be" : false;
    return matches ? url : undefined;
  } catch { return undefined; }
}

function timestampInTimezone(value: string, timezone: string): string | undefined {
  if (!value) return undefined;
  if (/(?:Z|[+-]\d\d:\d\d)$/u.test(value)) {
    const instant = new Date(value);
    return Number.isFinite(instant.getTime()) ? instant.toISOString() : undefined;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/u.exec(value);
  if (!match) return undefined;
  const desired = match.slice(1).map((part) => Number(part ?? "0"));
  let instant = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4], desired[5] ?? 0);
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, Number(part)]));
      const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const target = Date.UTC(desired[0], desired[1] - 1, desired[2], desired[3], desired[4], desired[5] ?? 0);
      instant += target - represented;
    }
    const verification = formatter.formatToParts(new Date(instant));
    const finalParts = Object.fromEntries(verification.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, Number(part)]));
    if ([finalParts.year, finalParts.month, finalParts.day, finalParts.hour, finalParts.minute, finalParts.second].join() !== desired.join()) return undefined;
    return new Date(instant).toISOString();
  } catch {
    return undefined;
  }
}

export function parseAnalyticsCsv(csv: string, options: { mapping?: AnalyticsMapping; existing?: MetricSample[]; importedAt: string; timezone: string; importId: string }): AnalyticsImportPreview {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: "greedy", transformHeader: (header) => header.trim() });
  const headers = parsed.meta.fields ?? [];
  const mapping = options.mapping ?? defaultMapping;
  const facts: MetricSample[] = [];
  const errors: Array<{ row: number; message: string }> = parsed.errors.map((error) => ({ row: (error.row ?? 0) + 2, message: error.message }));
  parsed.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const get = (column: AnalyticsColumn) => row[mapping[column]]?.trim() ?? "";
    const platform = normalizedPlatform(get("platform"));
    const value = Number(get("metric_value"));
    const metricName = get("metric_name").toLowerCase();
    const metric = metricDefinitions[metricName] ?? (metricName ? { definition: `Platform-reported ${metricName.replaceAll("_", " ")}`, semantic: "platform_native" } : undefined);
    const url = get("post_url");
    const validPostUrl = postUrlForPlatform(url, platform);
    const publishedRaw = get("published_at");
    const publishedAt = timestampInTimezone(publishedRaw, options.timezone);
    const unit = get("unit") as MetricSample["unit"];
    const dimension = get("dimension") as ComparisonDimension;
    const invalid = !platform ? "Unknown platform." : !validPostUrl ? "Post URL must be HTTPS and match the selected platform host." : !metric ? "Metric name is required." : !Number.isFinite(value) || value < 0 ? "Metric value must be zero or greater." : !publishedAt ? `Published time is invalid in workspace timezone ${options.timezone}.` : !get("format") ? "Format is required for comparable learning." : !get("reporting_window") ? "Reporting window is required." : !["count", "percent", "seconds", "ratio"].includes(unit ?? "") ? "Unit must be count, percent, seconds, or ratio." : !COMPARISON_DIMENSIONS.includes(dimension) ? "Comparison dimension is not supported." : !get("group") ? "Comparison group is required." : "";
    if (invalid) { errors.push({ row: rowNumber, message: invalid }); return; }
    const externalPostId = validPostUrl!.pathname.replace(/\/$/u, "") || validPostUrl!.href;
    facts.push(metricSampleSchema.parse({
      contentId: get("content_id") || `imported-${slug(externalPostId)}`,
      platform,
      metricKey: metric.semantic,
      metricDefinition: metric.definition,
      rawMetricName: metricName,
      semanticCategory: metric.semantic,
      value,
      unit,
      sampleSize: 1,
      sourceSampleId: `${options.importId}-row-${rowNumber}`,
      externalPostId,
      publishedAt,
      measuredAt: options.importedAt,
      reportingWindow: get("reporting_window"),
      format: get("format"),
      comparisonDimension: dimension,
      comparisonGroup: get("group"),
      importId: options.importId,
      sourceRow: rowNumber,
      provenance: { provider: "manual-csv", mode: "sample", importedAt: options.importedAt, sourceUrl: url },
    }));
  });
  const existingKeys = new Set((options.existing ?? []).map(metricSampleDedupKey));
  const seen = new Set<string>();
  const duplicateKeys = facts.map(metricSampleDedupKey).filter((key) => existingKeys.has(key) || (seen.has(key) ? true : (seen.add(key), false)));
  const mappedHeaders = new Set(Object.values(mapping));
  return { importId: options.importId, headers, facts, errors, unknownFields: headers.filter((header) => !mappedHeaders.has(header)), duplicateKeys: [...new Set(duplicateKeys)] };
}

export function mergeMetricImport(existing: MetricSample[], incoming: MetricSample[], policy: DuplicatePolicy): { ok: boolean; metrics: MetricSample[]; duplicates: number } {
  const existingByKey = new Map(existing.map((metric) => [metricSampleDedupKey(metric), metric]));
  const incomingKeys = incoming.map(metricSampleDedupKey);
  const duplicates = incomingKeys.filter((key, index) => existingByKey.has(key) || incomingKeys.indexOf(key) !== index).length;
  if (duplicates && policy === "cancel") return { ok: false, metrics: existing, duplicates };
  const merged = new Map(existingByKey);
  for (const metric of incoming) {
    const key = metricSampleDedupKey(metric);
    if (policy === "skip" && merged.has(key)) continue;
    merged.set(key, metric);
  }
  return { ok: true, metrics: [...merged.values()], duplicates };
}

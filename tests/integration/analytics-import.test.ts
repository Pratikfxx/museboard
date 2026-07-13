import { describe, expect, it } from "vitest";

import { deriveLearnings, mergeMetricImport, parseAnalyticsCsv, type MetricSample } from "@/domain/analytics";

const header = "content_id,platform,post_url,published_at,format,metric_name,metric_value,unit,reporting_window,dimension,group";

function fact(index: number, group: string, value: number, overrides: Partial<MetricSample> = {}): MetricSample {
  return {
    contentId: `post-${index}`, platform: "instagram_reels", metricKey: "exposure", metricDefinition: "Platform-reported views", value, sampleSize: 1,
    sourceSampleId: `import-row-${index}`, externalPostId: `/reel/${index}`, publishedAt: `2026-${index < 6 ? "05" : "06"}-${String((index % 20) + 1).padStart(2, "0")}T14:00:00.000Z`, reportingWindow: "7d", rawMetricName: "views", semanticCategory: "exposure", unit: "count", format: "reel", comparisonDimension: "opening_style", comparisonGroup: group, importId: "import-1", sourceRow: index + 1,
    provenance: { provider: "manual-csv", mode: "sample", importedAt: "2026-07-13T09:00:00.000Z", sourceUrl: `https://instagram.com/reel/${index}` }, ...overrides,
  };
}

describe("analytics import and learning", () => {
  it("converts naive timestamps in the confirmed timezone and preserves unknown native metrics", () => {
    const csv = `${header}\na,instagram,https://instagram.com/reel/a,2026-01-15 10:00,reel,rewatches,12,count,7d,opening_style,question`;
    const preview = parseAnalyticsCsv(csv, { importedAt: "2026-07-13T09:00:00.000Z", timezone: "America/New_York", importId: "import-a" });
    expect(preview.errors).toEqual([]);
    expect(preview.facts[0]).toMatchObject({ publishedAt: "2026-01-15T15:00:00.000Z", rawMetricName: "rewatches", semanticCategory: "platform_native" });
    const invalid = parseAnalyticsCsv(`${header}\na,instagram,https://,2026-01-15 10:00,reel,views,12,count,7d,opening_style,question\nb,instagram,https://tiktok.com/@x/video/1,2026-01-15 10:00,reel,views,12,count,7d,opening_style,question`, { importedAt: "2026-07-13T09:00:00.000Z", timezone: "America/New_York", importId: "import-invalid" });
    expect(invalid.facts).toEqual([]);
    expect(invalid.errors.map(({ message }) => message)).toEqual(["Post URL must be HTTPS and match the selected platform host.", "Post URL must be HTTPS and match the selected platform host."]);
  });

  it("previews stable duplicates and supports Skip, Replace, or Cancel", () => {
    const existing = [fact(1, "question", 100)];
    const corrected = fact(1, "question", 125, { sourceSampleId: "corrected" });
    expect(mergeMetricImport(existing, [corrected], "cancel")).toMatchObject({ ok: false, duplicates: 1 });
    expect(mergeMetricImport(existing, [corrected], "skip").metrics[0].value).toBe(100);
    expect(mergeMetricImport(existing, [corrected], "replace").metrics[0].value).toBe(125);
  });

  it("derives only same-platform/format/metric/unit/window associations with inspectable confidence", () => {
    const metrics = [
      ...Array.from({ length: 10 }, (_, index) => fact(index + 1, "question", 120)),
      ...Array.from({ length: 10 }, (_, index) => fact(index + 11, "statement", 100, { publishedAt: `2026-${index < 5 ? "05" : "06"}-${String(index + 1).padStart(2, "0")}T14:00:00.000Z` })),
      fact(30, "question", 999, { platform: "tiktok_video" }),
      fact(31, "question", 999, { format: "carousel" }),
    ];
    const learning = deriveLearnings(metrics, "2026-07-13T12:00:00.000Z")[0];
    expect(learning).toMatchObject({ platform: "instagram_reels", confidence: "high", effectPercent: 20, sampleSize: 20 });
    expect(learning.statement).toContain("association, not proof of causation");
    expect(learning.excludedContentIds).toEqual(["post-30", "post-31"]);
  });
});

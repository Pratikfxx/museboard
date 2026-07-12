import { describe, expect, it } from "vitest";

import type { MetricSample } from "@/domain/analytics";
import { deriveLearnings } from "@/domain/analytics";

const sparseMetrics: MetricSample[] = Array.from({ length: 2 }, (_, index) => ({
  contentId: `sparse-${index}`,
  platform: "instagram_reels",
  metricKey: "retention_3s",
  metricDefinition: "Share of viewers still watching at three seconds",
  value: 0.7,
  sampleSize: 10,
  sourceSampleId: `sample-sparse-${index}`,
  provenance: {
    provider: "museboard-demo",
    mode: "sample",
    importedAt: "2026-07-13T09:00:00.000Z",
  },
}));

const stableTenByTen: MetricSample[] = Array.from(
  { length: 10 },
  (_, index) => ({
    contentId: `stable-${index}`,
    platform: "youtube_shorts",
    metricKey: "completion_rate",
    metricDefinition: "Share of viewers who reached the end",
    value: 0.6,
    sampleSize: 10,
    sourceSampleId: `sample-stable-${index}`,
    provenance: {
      provider: "museboard-demo",
      mode: "sample",
      importedAt: "2026-07-13T09:00:00.000Z",
    },
  }),
);

describe("deriveLearnings", () => {
  it("does not emit a learning from sparse evidence", () => {
    expect(deriveLearnings(sparseMetrics)).toEqual([]);
  });

  it("assigns high confidence to stable evidence across ten pieces", () => {
    const learning = deriveLearnings(stableTenByTen)[0];

    expect(learning.confidence).toBe("high");
    expect(learning.sampleSize).toBe(100);
    expect(learning.includedContentIds).toHaveLength(10);
    expect(learning.metricDefinition).toBe(
      "Share of viewers who reached the end",
    );
  });

  it("never merges the same metric across platforms", () => {
    const splitPlatforms = stableTenByTen.map((metric, index) => ({
      ...metric,
      platform: index < 5 ? "instagram_reels" : "tiktok_video",
    })) satisfies MetricSample[];

    const learnings = deriveLearnings(splitPlatforms);

    expect(learnings).toHaveLength(2);
    expect(learnings.every((learning) => learning.confidence === "medium")).toBe(
      true,
    );
    expect(learnings.map((learning) => learning.platform).sort()).toEqual([
      "instagram_reels",
      "tiktok_video",
    ]);
  });

  it("uses metric definition identity in otherwise matching learning ids", () => {
    const metrics = Array.from({ length: 6 }, (_, index) => ({
      contentId: `definition-${index}`,
      platform: "instagram_reels" as const,
      metricKey: "retention",
      metricDefinition:
        index < 3 ? "Still watching at 3 seconds" : "Still watching at 5 seconds",
      value: 0.5,
      sampleSize: 10,
      sourceSampleId: `definition-sample-${index}`,
      provenance: {
        provider: "museboard-demo",
        mode: "sample" as const,
        importedAt: "2026-07-13T09:00:00.000Z",
      },
    }));

    const learnings = deriveLearnings(metrics);

    expect(learnings).toHaveLength(2);
    expect(new Set(learnings.map(({ id }) => id)).size).toBe(2);
  });
});

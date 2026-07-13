import { beforeEach, describe, expect, it } from "vitest";

import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import {
  upgradePersistedMuseboardData,
  useMuseboardStore,
} from "@/lib/store/museboard-store";

function starterWorkspace() {
  return buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "tech_education",
    audience: "Curious builders",
    platforms: ["instagram_reels"],
    weeklyCapacityMinutes: 300,
    voice: "Clear, practical, and direct",
    boundaries: "No hype",
    firstHook: "The useful part takes less than a minute.",
  });
}

function metricSample(index: number) {
  return {
    contentId: `content-metric-${index}`,
    platform: "instagram_reels" as const,
    metricKey: "retention_3s",
    metricDefinition: "Share still watching at three seconds",
    value: 0.6,
    sampleSize: 10,
    sourceSampleId: `source-sample-${index}`,
    provenance: {
      provider: "museboard-demo",
      mode: "sample" as const,
      importedAt: "2026-07-13T09:00:00.000Z",
    },
  };
}

function publishReceipt(
  overrides: Partial<{
    id: string;
    contentId: string;
    platform: "instagram_reels" | "tiktok_video" | "youtube_shorts";
  }> = {},
) {
  return {
    id: "receipt-1",
    contentId: "content-desk",
    platform: "instagram_reels" as const,
    publishedAt: "2026-07-13T12:00:00.000Z",
    recordedAt: "2026-07-13T12:01:00.000Z",
    provenance: { provider: "manual", mode: "sample" as const },
    ...overrides,
  };
}

describe("Museboard demo store", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
  });

  it("keeps explicit sample mode while completing onboarding", () => {
    const workspace = starterWorkspace();
    workspace.creator.name = "Aarav";
    useMuseboardStore.getState().completeOnboarding(workspace);

    const state = useMuseboardStore.getState();
    expect(state.dataMode).toBe("sample");
    expect(state.onboardingComplete).toBe(true);
    expect(state.creator?.name).toBe("Aarav");
  });

  it("upgrades a pre-Task-5 opportunity without discarding the saved creator", () => {
    const workspace = starterWorkspace();
    const legacy = {
      ...useMuseboardStore.getState(),
      onboardingComplete: true,
      creator: workspace.creator,
      opportunities: workspace.opportunities.map((opportunity) => {
        const candidate = structuredClone(opportunity) as unknown as Record<
          string,
          unknown
        >;
        delete candidate.format;
        delete candidate.pillar;
        delete candidate.readiness;
        delete candidate.goal;
        delete candidate.geography;
        delete candidate.evidence;
        candidate.provenance = {
          provider: opportunity.provenance.provider,
          mode: opportunity.provenance.mode,
          fetchedAt: opportunity.provenance.fetchedAt,
        };
        return candidate;
      }),
    };

    const upgraded = upgradePersistedMuseboardData(legacy) as {
      creator?: { audience: string };
      opportunities: Array<{
        format: string;
        provenance: { sourceLabel: string; expiresAt: string };
      }>;
    };

    expect(upgraded.creator?.audience).toBe("Curious builders");
    expect(upgraded.opportunities[0]).toMatchObject({
      format: "tutorial",
      provenance: {
        sourceLabel: "museboard-onboarding",
        expiresAt: expect.any(String),
      },
    });
  });

  it("rejects malformed provider metrics without changing state", () => {
    const before = useMuseboardStore.getState().metrics;

    const imported = useMuseboardStore
      .getState()
      .importMetrics([{ metricKey: "views" }]);

    expect(imported).toBe(false);
    expect(useMuseboardStore.getState().metrics).toBe(before);
  });

  it("clears optional user selections when the demo is reset", () => {
    const state = useMuseboardStore.getState();
    const workspace = starterWorkspace();
    state.completeOnboarding(workspace);
    state.selectOpportunity(workspace.opportunities[1].id);

    useMuseboardStore.getState().resetDemo();

    expect(useMuseboardStore.getState().creator).toBeUndefined();
    expect(useMuseboardStore.getState().selectedOpportunityId).toBeUndefined();
  });

  it("deduplicates a reimported provider metric by stable source sample", () => {
    const sample = metricSample(1);

    expect(useMuseboardStore.getState().importMetrics([sample])).toBe(true);
    expect(useMuseboardStore.getState().importMetrics([sample])).toBe(true);

    expect(useMuseboardStore.getState().metrics).toHaveLength(1);
    expect(useMuseboardStore.getState().learnings).toHaveLength(0);
  });

  it("preserves a dismissed learning when later samples recompute it", () => {
    useMuseboardStore
      .getState()
      .importMetrics([metricSample(1), metricSample(2), metricSample(3)]);
    const learningId = useMuseboardStore.getState().learnings[0].id;
    useMuseboardStore
      .getState()
      .dismissLearning(learningId, "2026-07-13T13:00:00.000Z");

    useMuseboardStore.getState().importMetrics([metricSample(4)]);

    expect(
      useMuseboardStore.getState().learnings.find(({ id }) => id === learningId)
        ?.dismissedAt,
    ).toBe("2026-07-13T13:00:00.000Z");
  });

  it("rejects publish receipts for missing content without mutating state", () => {
    const before = useMuseboardStore.getState();

    expect(
      before.recordPublishReceipt(
        publishReceipt({ id: "receipt-missing", contentId: "missing-content" }),
      ),
    ).toBe(false);
    expect(useMuseboardStore.getState().publishReceipts).toHaveLength(0);
    expect(useMuseboardStore.getState().content).toBe(before.content);
  });

  it("rejects publish receipts whose platform does not match the content", () => {
    const before = useMuseboardStore.getState();

    expect(
      before.recordPublishReceipt(
        publishReceipt({ id: "receipt-mismatch", platform: "tiktok_video" }),
      ),
    ).toBe(false);
    expect(useMuseboardStore.getState().publishReceipts).toHaveLength(0);
    expect(useMuseboardStore.getState().content).toBe(before.content);
  });
});

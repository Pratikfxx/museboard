import { beforeEach, describe, expect, it } from "vitest";

import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import {
  createOnboardedWorkspacePayload,
  upgradePersistedMuseboardData,
  useMuseboardStore,
  workspacePayloadFromState,
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

  it("can build a live onboarding payload without mutating the sample store", () => {
    const sampleBefore = workspacePayloadFromState(useMuseboardStore.getState());
    const payload = createOnboardedWorkspacePayload(
      sampleBefore,
      starterWorkspace(),
      "live",
    );

    expect(payload.dataMode).toBe("live");
    expect(payload.onboardingComplete).toBe(true);
    expect(payload.creator?.audience).toBe("Curious builders");
    expect(payload.exports).toEqual([]);
    expect(payload.publishReceipts).toEqual([]);
    expect(payload.metrics).toEqual([]);
    expect(payload.learnings).toEqual([]);
    expect(workspacePayloadFromState(useMuseboardStore.getState())).toEqual(sampleBefore);
  });

  it("hydrates live data without overwriting the separate sample workspace", () => {
    const sampleEnvelope = localStorage.getItem("museboard-demo-v1");
    const payload = {
      ...workspacePayloadFromState(useMuseboardStore.getState()),
      dataMode: "live" as const,
      onboardingComplete: true,
    };

    expect(useMuseboardStore.getState().hydrateLiveWorkspace(payload)).toBe(true);
    useMuseboardStore.getState().saveOpportunity("opportunity-desk");

    expect(useMuseboardStore.getState().dataMode).toBe("live");
    expect(localStorage.getItem("museboard-demo-v1")).toBe(sampleEnvelope);
    expect(workspacePayloadFromState(useMuseboardStore.getState())).not.toHaveProperty(
      "hydrateLiveWorkspace",
    );
  });

  it("rejects sample payloads at the live hydration boundary", () => {
    const payload = workspacePayloadFromState(useMuseboardStore.getState());
    expect(useMuseboardStore.getState().hydrateLiveWorkspace(payload)).toBe(false);
    expect(useMuseboardStore.getState().dataMode).toBe("sample");
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

  it("persists a series and creator hypothesis around existing content", () => {
    const state = useMuseboardStore.getState();
    const seriesId = state.createSeries({
      contentId: "content-desk",
      title: "Creator systems in practice",
      goal: "Teach one sustainable system across three posts",
      at: "2026-07-13T11:00:00.000Z",
    });
    const hypothesisId = state.setContentHypothesis({
      contentId: "content-desk",
      statement: "Question-led openings will improve completion.",
      expectedOutcome: "Seven-day completion rate",
      at: "2026-07-13T11:01:00.000Z",
    });

    expect(seriesId).toBe("series-content-desk");
    expect(hypothesisId).toBe("hypothesis-content-desk-1");
    expect(useMuseboardStore.getState().series[0]).toMatchObject({
      title: "Creator systems in practice",
      contentIds: ["content-desk"],
    });
    expect(useMuseboardStore.getState().hypotheses[0]).toMatchObject({
      contentId: "content-desk",
      statement: "Question-led openings will improve completion.",
      status: "planned",
    });
  });

  it("records explainable opportunity feedback and versions creator memory", () => {
    const state = useMuseboardStore.getState();
    expect(
      state.recordOpportunityFeedback(
        "opportunity-desk",
        "more_like_this",
        "2026-07-13T11:00:00.000Z",
      ),
    ).toBe(true);
    expect(
      state.updateCreatorMemory(
        {
          preferredPhrases: ["Here is the useful part"],
          avoidPhrases: ["game changer"],
          preferredStructures: ["question then demonstration"],
        },
        "2026-07-13T11:01:00.000Z",
      ),
    ).toBe(true);

    const updated = useMuseboardStore.getState();
    expect(updated.opportunityFeedback[0]).toMatchObject({
      opportunityId: "opportunity-desk",
      signal: "more_like_this",
      pillar: "Practical creator systems",
    });
    expect(updated.creatorMemory).toMatchObject({
      version: 2,
      preferredPhrases: ["Here is the useful part"],
      avoidPhrases: ["game changer"],
    });
  });

  it("keeps quick captures visible and promotes one into the idea board", () => {
    const state = useMuseboardStore.getState();
    const captureId = state.captureIdea(
      "Show the one shortcut I use before every recording",
      "2026-07-13T11:00:00.000Z",
    );

    expect(captureId).toBe("capture-1");
    expect(useMuseboardStore.getState().offlineCaptures[0]).toMatchObject({
      text: "Show the one shortcut I use before every recording",
      status: "queued",
    });

    const ideaId = useMuseboardStore
      .getState()
      .promoteCapture(captureId!, "2026-07-13T11:02:00.000Z");

    expect(ideaId).toBe("idea-capture-opportunity-capture-1");
    expect(useMuseboardStore.getState().ideas.at(-1)?.title).toBe(
      "Show the one shortcut I use before every recording",
    );
    expect(useMuseboardStore.getState().offlineCaptures[0].status).toBe("promoted");
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

import { describe, expect, test } from "vitest";

import {
  applyLearningAsHypothesis,
  createSeriesFromContent,
  personalizeOpportunityScore,
  recommendNextCreatorAction,
} from "@/domain/creator-intelligence";
import { createDemoState, DEMO_NOW } from "@/lib/demo/fixtures";

describe("creator intelligence", () => {
  test("turns the strongest active learning into the next creator action", () => {
    const state = createDemoState();
    state.learnings = [
      {
        id: "learning-question-openings",
        metricKey: "retention",
        metricDefinition: "Seven-day completion rate",
        platform: "instagram_reels",
        statement: "Question openings are associated with 18% higher completion.",
        sampleSize: 12,
        confidence: "medium",
        effectPercent: 18,
        comparison: "opening_style: question vs statement",
        includedContentIds: ["post-1", "post-2", "post-3", "post-4", "post-5", "post-6"],
      },
    ];

    const action = recommendNextCreatorAction(state, DEMO_NOW);

    expect(action.kind).toBe("apply_learning");
    expect(action.title).toContain("Question openings");
    expect(action.reason).toContain("12 comparable posts");
    expect(action.evidenceLabel).toBe("Medium-confidence learning");
    expect(action.href).toBe("/app/learn?learningId=learning-question-openings");
  });

  test("ignores dismissed learnings and returns unfinished series work", () => {
    const state = createDemoState();
    state.learnings = [
      {
        id: "learning-dismissed",
        metricKey: "retention",
        metricDefinition: "Completion rate",
        platform: "instagram_reels",
        statement: "A dismissed pattern.",
        sampleSize: 10,
        confidence: "high",
        includedContentIds: ["post-1", "post-2", "post-3"],
        dismissedAt: DEMO_NOW,
      },
    ];
    state.series = [createSeriesFromContent({
      contentId: "content-desk",
      title: "Low-friction creator systems",
      goal: "Build a three-part teaching sequence",
      at: DEMO_NOW,
    })];

    const action = recommendNextCreatorAction(state, DEMO_NOW);

    expect(action.kind).toBe("continue_series");
    expect(action.title).toContain("Low-friction creator systems");
    expect(action.href).toBe("/app/plan?seriesId=series-content-desk");
  });

  test("uses explicit feedback to adapt fit without changing source evidence", () => {
    const state = createDemoState();
    const opportunity = state.opportunities[0];
    const evidence = structuredClone(opportunity.evidence);

    const base = personalizeOpportunityScore(opportunity, []);
    const adapted = personalizeOpportunityScore(opportunity, [
      {
        id: "feedback-1",
        opportunityId: opportunity.id,
        signal: "more_like_this",
        pillar: opportunity.pillar,
        format: opportunity.format,
        createdAt: DEMO_NOW,
      },
    ]);

    expect(adapted.score).toBeGreaterThan(base.score);
    expect(adapted.adjustment).toBeGreaterThan(0);
    expect(adapted.explanation).toContain("More like this");
    expect(opportunity.evidence).toEqual(evidence);
  });

  test("creates an attributable hypothesis from a learning", () => {
    const state = createDemoState();
    const learning = {
      id: "learning-question-openings",
      metricKey: "retention",
      metricDefinition: "Seven-day completion rate",
      platform: "instagram_reels" as const,
      statement: "Question openings are associated with 18% higher completion.",
      sampleSize: 12,
      confidence: "medium" as const,
      effectPercent: 18,
      comparison: "opening_style: question vs statement",
      includedContentIds: ["post-1", "post-2", "post-3"],
    };

    const hypothesis = applyLearningAsHypothesis(
      state.content[0],
      learning,
      DEMO_NOW,
    );

    expect(hypothesis.contentId).toBe("content-desk");
    expect(hypothesis.learningId).toBe(learning.id);
    expect(hypothesis.statement).toContain("Question openings");
    expect(hypothesis.status).toBe("planned");
  });
});

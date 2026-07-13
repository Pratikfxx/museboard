import { describe, expect, it } from "vitest";

import type { PlannerTask } from "@/domain/planner";
import { planWeek } from "@/domain/planner";
import type { Opportunity } from "@/domain/opportunities";
import {
  OPPORTUNITY_RANKING_WEIGHTS,
  rankOpportunities,
} from "@/domain/opportunities";

const tasks: PlannerTask[] = [
  {
    id: "task-low",
    title: "Polish an evergreen draft",
    estimatedMinutes: 70,
    priority: 50,
    opportunityScore: 40,
  },
  {
    id: "task-high",
    title: "Respond to a timely signal",
    estimatedMinutes: 118,
    priority: 95,
    opportunityScore: 90,
  },
  {
    id: "task-medium",
    title: "Record a planned tutorial",
    estimatedMinutes: 58,
    priority: 75,
    opportunityScore: 70,
  },
];

describe("planWeek", () => {
  it("keeps the default scheduled load at or below 80% of capacity", () => {
    const plan = planWeek({ capacityMinutes: 300, tasks });

    expect(plan.scheduledMinutes).toBeLessThanOrEqual(240);
    expect(plan.availableMinutes).toBe(240);
  });

  it("uses 15-minute increments and deterministic priority ranking", () => {
    const plan = planWeek({ capacityMinutes: 300, tasks });

    expect(plan.scheduled.map((task) => task.id)).toEqual([
      "task-high",
      "task-medium",
    ]);
    expect(plan.scheduled.map((task) => task.scheduledMinutes)).toEqual([120, 60]);
    expect(plan.scheduledMinutes % 15).toBe(0);
    expect(plan.unscheduled.map((task) => task.id)).toEqual(["task-low"]);
  });
});

describe("rankOpportunities", () => {
  it("uses stable weighted scores with an id tie-breaker", () => {
    const base: Omit<Opportunity, "id" | "title"> = {
      summary: "A source-backed idea",
      platform: "youtube_shorts",
      archetypes: ["tech_education"],
      format: "tutorial",
      pillar: "Useful concepts made clear",
      readiness: "ready",
      goal: "trust",
      geography: "Global",
      signals: {
        relevance: 80,
        momentum: 70,
        originality: 60,
        creatorFit: 90,
      },
      evidence: [
        { summary: "A public metadata observation.", sourceLabel: "Demo" },
      ],
      provenance: {
        provider: "museboard-demo",
        mode: "sample",
        fetchedAt: "2026-07-13T09:00:00.000Z",
        sourceClass: "public_research",
        sourceLabel: "Demo",
        sourceUrl: "https://museboard.example/sample",
        observedAt: "2026-07-13T06:00:00.000Z",
        expiresAt: "2026-07-14T06:00:00.000Z",
      },
    };
    const opportunities: Opportunity[] = [
      { ...base, id: "b", title: "Second" },
      { ...base, id: "a", title: "First" },
    ];

    expect(rankOpportunities(opportunities).map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
    expect(rankOpportunities(opportunities)[0].rankScore).toBe(75.5);
    expect(OPPORTUNITY_RANKING_WEIGHTS).toEqual({
      relevance: 0.4,
      momentum: 0.3,
      originality: 0.15,
      creatorFit: 0.15,
    });
    expect(rankOpportunities(opportunities)[0].scoreContributions).toEqual({
      relevance: 32,
      momentum: 21,
      originality: 9,
      creatorFit: 13.5,
    });
  });

  it("uses locale-independent ordinal ids to break equal-score ties", () => {
    const base: Omit<Opportunity, "id" | "title"> = {
      summary: "A source-backed idea",
      platform: "youtube_shorts",
      archetypes: ["tech_education"],
      format: "tutorial",
      pillar: "Useful concepts made clear",
      readiness: "ready",
      goal: "trust",
      geography: "Global",
      signals: {
        relevance: 80,
        momentum: 70,
        originality: 60,
        creatorFit: 90,
      },
      evidence: [
        { summary: "A public metadata observation.", sourceLabel: "Demo" },
      ],
      provenance: {
        provider: "museboard-demo",
        mode: "sample",
        fetchedAt: "2026-07-13T09:00:00.000Z",
        sourceClass: "public_research",
        sourceLabel: "Demo",
        sourceUrl: "https://museboard.example/sample",
        observedAt: "2026-07-13T06:00:00.000Z",
        expiresAt: "2026-07-14T06:00:00.000Z",
      },
    };

    expect(
      rankOpportunities([
        { ...base, id: "ä", title: "Umlaut" },
        { ...base, id: "z", title: "Zed" },
      ]).map(({ id }) => id),
    ).toEqual(["z", "ä"]);
  });
});

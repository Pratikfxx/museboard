import type { Opportunity } from "@/domain/opportunities";
import { planWeek, type PlannerTask } from "@/domain/planner";
import type {
  ContentItem,
  ContentPlatform,
  CreatorArchetype,
  HookOption,
} from "@/domain/schema";
import {
  DEMO_NOW,
  type CreatorOutcome,
  type StarterWorkspace,
} from "@/lib/demo/fixtures";

export interface StarterWorkspaceInput {
  name?: string;
  outcome: CreatorOutcome;
  archetype: CreatorArchetype;
  audience: string;
  platforms: ContentPlatform[];
  weeklyCapacityMinutes: number;
  voice: string;
  boundaries: string;
  firstHook: string;
  now?: string;
}

const CONTENT_PILLARS: Record<
  CreatorArchetype,
  [string, string, string]
> = {
  music: [
    "Songcraft decisions",
    "Making music in public",
    "Sustainable release rituals",
  ],
  tech_education: [
    "Useful concepts made clear",
    "Builds and lessons in public",
    "Practical creator systems",
  ],
  lifestyle_business: [
    "Calm operating systems",
    "Visible work decisions",
    "Sustainable independent growth",
  ],
};

const OPPORTUNITY_TITLES: Record<CreatorArchetype, readonly string[]> = {
  music: [
    "Let listeners choose the chorus turn",
    "The eight seconds before the hook",
    "One sound, three different moods",
    "The lyric that changed the track",
    "Build the drop with your audience",
  ],
  tech_education: [
    "Teach the shortcut through one real task",
    "The mistake your first version made",
    "One concept, three visual examples",
    "The tiny system behind the result",
    "Make the jargon pass the plain-language test",
  ],
  lifestyle_business: [
    "The ritual that makes starting lighter",
    "Show the system behind a calm week",
    "A boundary that improved the work",
    "One small decision with a visible result",
    "Turn the weekly reset into a conversation",
  ],
};

const MATCHING_HOOKS: Record<CreatorArchetype, readonly [string, string]> = {
  music: [
    "The part of this track I nearly deleted became the hook.",
    "Help me choose what the chorus does next.",
  ],
  tech_education: [
    "The useful part takes less than a minute to understand.",
    "Here is the mistake the polished tutorial skips.",
  ],
  lifestyle_business: [
    "This boundary made the work easier to keep doing.",
    "A calmer week started with one smaller promise.",
  ],
};

function splitTraits(value: string): string[] {
  return value
    .split(/,|\band\b/iu)
    .map((trait) => trait.trim())
    .filter(Boolean);
}

function splitBoundaries(value: string): string[] {
  return value
    .split(/\n|;/u)
    .map((boundary) => boundary.trim())
    .filter(Boolean);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function normalizedPlannerAnchor(isoDate: string): string {
  const date = new Date(isoDate);
  date.setUTCHours(9, 0, 0, 0);
  return date.toISOString();
}

function createOpportunities({
  archetype,
  audience,
  platforms,
  now = DEMO_NOW,
}: StarterWorkspaceInput): Opportunity[] {
  return OPPORTUNITY_TITLES[archetype].map((title, index) => ({
    id: `starter-${archetype}-opportunity-${index + 1}`,
    title,
    summary: `A sample angle for ${audience.toLocaleLowerCase()} that can become a concrete short-form post.`,
    platform: platforms[index % platforms.length],
    archetypes: [archetype],
    format: (["tutorial", "behind_scenes", "story", "demonstration"] as const)[
      index % 4
    ],
    pillar: CONTENT_PILLARS[archetype][index % CONTENT_PILLARS[archetype].length],
    readiness: (["ready", "shape", "spark"] as const)[index % 3],
    goal: (["trust", "community", "reach", "conversion"] as const)[index % 4],
    geography: "Global",
    signals: {
      relevance: 94 - index * 2,
      momentum: 82 - index,
      originality: 78 + index * 2,
      creatorFit: 96 - index,
    },
    evidence: [
      {
        summary: "A local sample prompt generated from the onboarding choices.",
        sourceLabel: "Museboard onboarding sample",
      },
    ],
    provenance: {
      provider: "museboard-onboarding",
      mode: "sample",
      fetchedAt: now,
      sourceClass: "creator_submission",
      sourceLabel: "Museboard onboarding sample",
      sourceUrl: `https://museboard.example/sample/${archetype}/${index + 1}`,
      observedAt: now,
      expiresAt: addDays(now, 7),
    },
  }));
}

function createHooks(
  archetype: CreatorArchetype,
  contentId: string,
  firstHook: string,
): HookOption[] {
  return [firstHook, ...MATCHING_HOOKS[archetype]].map((text, index) => ({
    id: `${contentId}-hook-${index + 1}`,
    contentId,
    text,
    rationale:
      index === 0
        ? "Keeps the creator's own first opening as the recommended starting point."
        : "Offers a sample alternative matched to the selected creator archetype.",
  }));
}

function createPlannerTasks(
  contentId: string,
  firstHook: string,
  weeklyCapacityMinutes: number,
  anchor: string,
): PlannerTask[] {
  const candidates: PlannerTask[] = [
    {
      id: `${contentId}-task-hook`,
      contentId,
      title: `Shape the hook: ${firstHook}`,
      estimatedMinutes: 30,
      priority: 95,
      opportunityScore: 92,
    },
    {
      id: `${contentId}-task-outline`,
      contentId,
      title: "Outline the first short-form post",
      estimatedMinutes: 45,
      priority: 86,
      opportunityScore: 90,
    },
    {
      id: `${contentId}-task-record`,
      contentId,
      title: "Record a rough first take",
      estimatedMinutes: 60,
      priority: 78,
      opportunityScore: 84,
    },
  ];
  const scheduled = planWeek({
    capacityMinutes: weeklyCapacityMinutes,
    tasks: candidates,
  }).scheduled;
  const dayOffsets = [1, 3, 5];

  return scheduled.map((task, index) => ({
    id: task.id,
    contentId: task.contentId,
    title: task.title,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    opportunityScore: task.opportunityScore,
    scheduledFor: addDays(anchor, dayOffsets[index]),
  }));
}

export function buildStarterWorkspace(
  input: StarterWorkspaceInput,
): StarterWorkspace {
  const audience = input.audience.trim();
  const firstHook = input.firstHook.trim();
  const generatedAt = input.now ?? DEMO_NOW;
  const plannerAnchor = normalizedPlannerAnchor(generatedAt);
  const opportunities = createOpportunities({ ...input, audience });
  const selectedOpportunity = opportunities[0];
  const contentId = `starter-${input.archetype}-content`;
  const versionId = `${contentId}-v1`;
  const hooks = createHooks(input.archetype, contentId, firstHook);
  const plannerTasks = createPlannerTasks(
    contentId,
    firstHook,
    input.weeklyCapacityMinutes,
    plannerAnchor,
  );
  const content: ContentItem = {
    id: contentId,
    title: selectedOpportunity.title,
    platform: input.platforms[0],
    archetype: input.archetype,
    stage: "hook",
    currentVersionId: versionId,
    opportunityId: selectedOpportunity.id,
    scheduledFor: plannerTasks.at(-1)?.scheduledFor,
    versions: [
      {
        id: versionId,
        contentId,
        number: 1,
        angle: selectedOpportunity.summary,
        selectedHookId: hooks[0].id,
        script: `Opening: ${firstHook}\nAudience: ${audience}\nVoice: ${input.voice.trim()}`,
        createdAt: generatedAt,
      },
    ],
    createdAt: generatedAt,
    updatedAt: generatedAt,
  };

  return {
    creator: {
      name: input.name?.trim() || `${input.archetype.replaceAll("_", " ")} creator`,
      outcome: input.outcome,
      archetype: input.archetype,
      archetypes: [input.archetype],
      audience,
      platforms: [...input.platforms],
      weeklyCapacityMinutes: input.weeklyCapacityMinutes,
      voiceTraits: splitTraits(input.voice),
      boundaries: splitBoundaries(input.boundaries),
      contentPillars: CONTENT_PILLARS[input.archetype],
      timezone: "UTC",
      recoveryDays: [4],
    },
    opportunities,
    selectedOpportunityId: selectedOpportunity.id,
    hooks,
    content: [content],
    plannerTasks,
  };
}

import type { MetricSample } from "@/domain/analytics";
import type { EntitlementUsage } from "@/domain/entitlements";
import type { ExportManifest } from "@/domain/export";
import type { Opportunity } from "@/domain/opportunities";
import type { PlannerTask } from "@/domain/planner";
import type {
  Comment,
  ContentItem,
  CreatorArchetype,
  DataMode,
  HookOption,
  Learning,
  PublishReceipt,
} from "@/domain/schema";

export const DEMO_NOW = "2026-07-13T09:00:00.000Z";
export const DEMO_RESET_AT = "2026-08-01T00:00:00.000Z";

export interface CreatorProfile {
  name: string;
  archetype: CreatorArchetype;
  weeklyCapacityMinutes: number;
}

export interface DemoMuseboardData {
  schemaVersion: 1;
  dataMode: DataMode;
  onboardingComplete: boolean;
  creator?: CreatorProfile;
  opportunities: Opportunity[];
  selectedOpportunityId?: string;
  hooks: HookOption[];
  content: ContentItem[];
  plannerTasks: PlannerTask[];
  comments: Comment[];
  exports: ExportManifest[];
  publishReceipts: PublishReceipt[];
  metrics: MetricSample[];
  learnings: Learning[];
  entitlementUsage: EntitlementUsage;
}

export function createDemoState(): DemoMuseboardData {
  const content: ContentItem[] = [
    {
      id: "content-desk",
      title: "The desk reset that protects your ideas",
      platform: "instagram_reels",
      archetype: "tech_education",
      stage: "hook",
      currentVersionId: "content-desk-v1",
      opportunityId: "opportunity-desk",
      versions: [
        {
          id: "content-desk-v1",
          contentId: "content-desk",
          number: 1,
          angle: "A calmer setup makes it easier to begin creating.",
          selectedHookId: "hook-desk-1",
          script: "Your next idea does not need a new desk. It needs a reset ritual.",
          createdAt: DEMO_NOW,
        },
      ],
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    },
  ];

  const opportunities: Opportunity[] = [
    {
      id: "opportunity-desk",
      title: "The low-friction creator desk",
      summary: "Show one small setup change that removes resistance before recording.",
      platform: "instagram_reels",
      archetypes: ["tech_education", "lifestyle_business"],
      signals: { relevance: 92, momentum: 76, originality: 81, creatorFit: 94 },
      provenance: { provider: "museboard-demo", mode: "sample", fetchedAt: DEMO_NOW },
    },
    {
      id: "opportunity-chorus",
      title: "Build the chorus in public",
      summary: "Turn one production choice into an audience participation moment.",
      platform: "tiktok_video",
      archetypes: ["music"],
      signals: { relevance: 86, momentum: 91, originality: 75, creatorFit: 82 },
      provenance: { provider: "museboard-demo", mode: "sample", fetchedAt: DEMO_NOW },
    },
    {
      id: "opportunity-systems",
      title: "The tiny system behind consistent work",
      summary: "Teach a useful weekly ritual through one concrete before-and-after.",
      platform: "youtube_shorts",
      archetypes: ["lifestyle_business", "tech_education"],
      signals: { relevance: 89, momentum: 72, originality: 84, creatorFit: 88 },
      provenance: { provider: "museboard-demo", mode: "sample", fetchedAt: DEMO_NOW },
    },
  ];

  return {
    schemaVersion: 1,
    dataMode: "sample",
    onboardingComplete: false,
    creator: undefined,
    opportunities,
    selectedOpportunityId: undefined,
    hooks: [
      {
        id: "hook-desk-1",
        contentId: "content-desk",
        text: "Your desk is not the problem. Starting is.",
        rationale: "Names the emotional job before showing the practical ritual.",
      },
      {
        id: "hook-desk-2",
        contentId: "content-desk",
        text: "Reset your studio in less time than this Reel.",
        rationale: "Makes the promised effort feel concrete and achievable.",
      },
    ],
    content,
    plannerTasks: [
      {
        id: "task-desk",
        contentId: "content-desk",
        title: "Record the desk reset",
        estimatedMinutes: 75,
        priority: 85,
        opportunityScore: 88,
      },
    ],
    comments: [],
    exports: [],
    publishReceipts: [],
    metrics: [],
    learnings: [],
    entitlementUsage: {
      plan: "free",
      used: {},
      reserved: {},
      resetAt: DEMO_RESET_AT,
    },
  };
}

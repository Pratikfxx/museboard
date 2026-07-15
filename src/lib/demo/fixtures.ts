import type { MetricSample } from "@/domain/analytics";
import type { EntitlementUsage } from "@/domain/entitlements";
import type {
  ApprovalEvent,
  CollaborationNotification,
  CommentStatusEvent,
  Membership,
  ReviewComment,
  StageAssignment,
} from "@/domain/collaboration";
import type { ExportRecord } from "@/domain/export";
import type {
  ContentHypothesis,
  ContentSeries,
  CreatorMemory,
  OfflineCapture,
  OpportunityFeedback,
  WorkspaceRecoveryNotice,
} from "@/domain/creator-intelligence";
import { EMPTY_CREATOR_MEMORY } from "@/domain/creator-intelligence";
import type {
  IdeaRecord,
  Opportunity,
  VisionReference,
} from "@/domain/opportunities";
import type { PlannerTask } from "@/domain/planner";
import type {
  ContributionReaction,
  ThinkingContribution,
  ThinkingRoom,
  ThinkingSynthesisRevision,
} from "@/domain/thinking-rooms";
import type {
  Comment,
  ContentItem,
  ContentPlatform,
  CreatorArchetype,
  DataMode,
  HookOption,
  Learning,
  PublishReceipt,
} from "@/domain/schema";

export const DEMO_NOW = "2026-07-13T09:00:00.000Z";
export const DEMO_RESET_AT = "2026-08-01T00:00:00.000Z";

export const CREATOR_OUTCOMES = [
  "plan_week",
  "find_ideas",
  "build_system",
] as const;

export type CreatorOutcome = (typeof CREATOR_OUTCOMES)[number];

export interface CreatorProfile {
  name: string;
  outcome: CreatorOutcome;
  archetype: CreatorArchetype;
  archetypes: CreatorArchetype[];
  audience: string;
  platforms: ContentPlatform[];
  weeklyCapacityMinutes: number;
  voiceTraits: string[];
  boundaries: string[];
  contentPillars: [string, string, string];
  timezone?: string;
  recoveryDays?: number[];
}

export interface PlannerUndo {
  taskId: string;
  before: PlannerTask;
  after: PlannerTask;
  label: string;
}

export interface StarterWorkspace {
  creator: CreatorProfile;
  opportunities: Opportunity[];
  selectedOpportunityId: string;
  hooks: HookOption[];
  content: ContentItem[];
  plannerTasks: PlannerTask[];
}

export interface DemoMuseboardData {
  schemaVersion: 1;
  dataMode: DataMode;
  onboardingComplete: boolean;
  creator?: CreatorProfile;
  opportunities: Opportunity[];
  selectedOpportunityId?: string;
  opportunityDecisions: Record<string, "saved" | "dismissed">;
  ideas: IdeaRecord[];
  visionReferences: VisionReference[];
  selectedReferenceIds: string[];
  hooks: HookOption[];
  content: ContentItem[];
  plannerTasks: PlannerTask[];
  plannerUndo?: PlannerUndo;
  comments: Comment[];
  memberships: Membership[];
  currentActorMembershipId: string;
  assignments: StageAssignment[];
  reviewComments: ReviewComment[];
  commentEvents: CommentStatusEvent[];
  approvals: ApprovalEvent[];
  notifications: CollaborationNotification[];
  exports: ExportRecord[];
  publishReceipts: PublishReceipt[];
  metrics: MetricSample[];
  learnings: Learning[];
  hypotheses: ContentHypothesis[];
  series: ContentSeries[];
  creatorMemory: CreatorMemory;
  opportunityFeedback: OpportunityFeedback[];
  offlineCaptures: OfflineCapture[];
  recoveryNotice?: WorkspaceRecoveryNotice;
  entitlementUsage: EntitlementUsage;
}

export interface SampleThinkingRoomData {
  rooms: ThinkingRoom[];
  contributions: ThinkingContribution[];
  reactions: ContributionReaction[];
  synthesisRevisions: ThinkingSynthesisRevision[];
  selectedRoomId?: string;
  syncState: "idle" | "syncing" | "offline" | "error";
}

export function createSampleThinkingRoomData(
  memberships: readonly Membership[],
): SampleThinkingRoomData {
  const activeMemberships = memberships.filter(
    ({ status }) => status === "active",
  );
  const owner = activeMemberships.find(({ role }) => role === "owner");
  const collaborator = activeMemberships.find(({ id }) => id !== owner?.id) ?? owner;
  if (!owner || !collaborator) {
    throw new Error("Sample Thinking Room requires an active workspace owner");
  }

  const roomId = "thinking-room-sample-direction";
  const createdAt = "2026-07-13T10:00:00.000Z";
  const decidedAt = "2026-07-13T11:00:00.000Z";
  const contributions: ThinkingContribution[] = [
    {
      id: "thinking-contribution-sample-tension",
      roomId,
      lens: "audience_tensions",
      body: "Sample note: creators want consistency without sounding repetitive.",
      authorMembershipId: owner.id,
      authorDisplayNameSnapshot: owner.displayNameSnapshot,
      createdAt,
      updatedAt: createdAt,
      revision: 1,
    },
    {
      id: "thinking-contribution-sample-evidence",
      roomId,
      lens: "evidence",
      body: "Sample note: recent audience replies ask for repeatable weekly formats.",
      authorMembershipId: collaborator.id,
      authorDisplayNameSnapshot: collaborator.displayNameSnapshot,
      sourceReferenceId: "sample-reference-audience-replies",
      createdAt: "2026-07-13T10:10:00.000Z",
      updatedAt: "2026-07-13T10:10:00.000Z",
      revision: 1,
    },
    {
      id: "thinking-contribution-sample-challenge",
      roomId,
      lens: "challenges",
      body: "Sample note: a rigid template could flatten the creator's voice.",
      authorMembershipId: collaborator.id,
      authorDisplayNameSnapshot: collaborator.displayNameSnapshot,
      createdAt: "2026-07-13T10:20:00.000Z",
      updatedAt: "2026-07-13T10:20:00.000Z",
      revision: 1,
    },
    {
      id: "thinking-contribution-sample-possibility",
      roomId,
      lens: "possibilities",
      body: "Sample note: keep one recognizable constraint and vary the proof each week.",
      authorMembershipId: owner.id,
      authorDisplayNameSnapshot: owner.displayNameSnapshot,
      relatedContributionId: "thinking-contribution-sample-challenge",
      createdAt: "2026-07-13T10:30:00.000Z",
      updatedAt: "2026-07-13T10:30:00.000Z",
      revision: 1,
    },
  ];

  return {
    rooms: [
      {
        id: roomId,
        organizationId: "organization-sample",
        workspaceId: "workspace-sample",
        question: "Sample room: Which tension should anchor our next series?",
        templateId: "content-direction",
        status: "decided",
        facilitatorMembershipId: owner.id,
        decisionOwnerMembershipId: owner.id,
        context: "This is sample data for exploring the Thinking Room workflow.",
        createdAt,
        updatedAt: decidedAt,
        revision: 3,
      },
    ],
    contributions,
    reactions: [
      {
        id: "thinking-reaction-sample-promising",
        roomId,
        contributionId: "thinking-contribution-sample-possibility",
        membershipId: collaborator.id,
        kind: "promising",
        createdAt: "2026-07-13T10:35:00.000Z",
      },
    ],
    synthesisRevisions: [
      {
        id: "thinking-synthesis-sample-accepted",
        roomId,
        number: 1,
        belief: "A useful constraint can make a series recognizable without making it repetitive.",
        unknowns: ["Which proof format earns the strongest response?"],
        confidence: "high",
        chosenDirection: {
          title: "Sample direction: One constraint, fresh proof",
          audienceTension: "Creators want consistency without becoming repetitive.",
          angle: "Keep one recognizable constraint and reveal a different proof each week.",
          keyChallenge: "The repeated structure must leave room for the creator's voice.",
          evidenceReferenceIds: ["sample-reference-audience-replies"],
          basis: "evidence",
        },
        openChallengeIds: [],
        sourceContributionIds: contributions.map(({ id }) => id),
        createdByMembershipId: owner.id,
        status: "accepted",
        createdAt: decidedAt,
        acceptedAt: decidedAt,
        acceptedByMembershipId: owner.id,
      },
    ],
    selectedRoomId: roomId,
    syncState: "idle",
  };
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
      format: "tutorial",
      pillar: "Practical creator systems",
      readiness: "ready",
      goal: "trust",
      geography: "Global",
      signals: { relevance: 92, momentum: 76, originality: 81, creatorFit: 94 },
      evidence: [
        {
          summary: "A sample editorial observation about reducing setup friction.",
          sourceLabel: "Museboard demo desk",
        },
      ],
      provenance: {
        provider: "museboard-demo",
        mode: "sample",
        fetchedAt: DEMO_NOW,
        sourceClass: "creator_submission",
        sourceLabel: "Museboard demo desk",
        sourceUrl: "https://museboard.example/sample/creator-desk",
        observedAt: "2026-07-13T06:00:00.000Z",
        expiresAt: "2026-07-14T06:00:00.000Z",
      },
    },
    {
      id: "opportunity-chorus",
      title: "Build the chorus in public",
      summary: "Turn one production choice into an audience participation moment.",
      platform: "tiktok_video",
      archetypes: ["music"],
      format: "behind_scenes",
      pillar: "Making music in public",
      readiness: "shape",
      goal: "community",
      geography: "Global",
      signals: { relevance: 86, momentum: 91, originality: 75, creatorFit: 82 },
      evidence: [
        {
          summary: "A sample prompt for audience participation during songcraft.",
          sourceLabel: "Museboard demo desk",
        },
      ],
      provenance: {
        provider: "museboard-demo",
        mode: "sample",
        fetchedAt: DEMO_NOW,
        sourceClass: "creator_submission",
        sourceLabel: "Museboard demo desk",
        sourceUrl: "https://museboard.example/sample/chorus-in-public",
        observedAt: "2026-07-13T05:00:00.000Z",
        expiresAt: "2026-07-15T05:00:00.000Z",
      },
    },
    {
      id: "opportunity-systems",
      title: "The tiny system behind consistent work",
      summary: "Teach a useful weekly ritual through one concrete before-and-after.",
      platform: "youtube_shorts",
      archetypes: ["lifestyle_business", "tech_education"],
      format: "demonstration",
      pillar: "Calm operating systems",
      readiness: "spark",
      goal: "reach",
      geography: "India + global English",
      signals: { relevance: 89, momentum: 72, originality: 84, creatorFit: 88 },
      evidence: [
        {
          summary: "A sample editorial pattern for showing a sustainable weekly ritual.",
          sourceLabel: "Museboard demo desk",
        },
      ],
      provenance: {
        provider: "museboard-demo",
        mode: "sample",
        fetchedAt: DEMO_NOW,
        sourceClass: "creator_submission",
        sourceLabel: "Museboard demo desk",
        sourceUrl: "https://museboard.example/sample/tiny-system",
        observedAt: "2026-07-13T04:00:00.000Z",
        expiresAt: "2026-07-16T04:00:00.000Z",
      },
    },
  ];

  return {
    schemaVersion: 1,
    dataMode: "sample",
    onboardingComplete: false,
    creator: undefined,
    opportunities,
    selectedOpportunityId: undefined,
    opportunityDecisions: {},
    ideas: [],
    visionReferences: [],
    selectedReferenceIds: [],
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
    plannerUndo: undefined,
    comments: [],
    memberships: [
      {
        id: "member-owner",
        email: "maya@museboard.local",
        displayNameSnapshot: "Maya Chen",
        role: "owner",
        status: "active",
        invitedAt: DEMO_NOW,
        joinedAt: DEMO_NOW,
      },
      {
        id: "member-sam",
        email: "sam@museboard.local",
        displayNameSnapshot: "Sam Rivera",
        role: "editor",
        status: "active",
        invitedAt: "2026-07-10T09:00:00.000Z",
        joinedAt: "2026-07-10T10:00:00.000Z",
      },
      {
        id: "invite-priya",
        email: "priya@museboard.local",
        displayNameSnapshot: "Priya Shah",
        role: "viewer",
        status: "pending",
        invitedAt: "2026-07-12T09:00:00.000Z",
        expiresAt: "2026-07-19T09:00:00.000Z",
      },
      {
        id: "invite-lina",
        email: "lina@museboard.local",
        displayNameSnapshot: "Lina Torres",
        role: "editor",
        status: "declined",
        invitedAt: "2026-07-08T09:00:00.000Z",
      },
      {
        id: "invite-omar",
        email: "omar@museboard.local",
        displayNameSnapshot: "Omar Bell",
        role: "viewer",
        status: "revoked",
        invitedAt: "2026-07-07T09:00:00.000Z",
      },
      {
        id: "invite-bea",
        email: "bea@museboard.local",
        displayNameSnapshot: "Bea Kim",
        role: "viewer",
        status: "expired",
        invitedAt: "2026-06-10T09:00:00.000Z",
      },
    ],
    currentActorMembershipId: "member-owner",
    assignments: [
      {
        id: "assignment-desk-review",
        contentId: "content-desk",
        stage: "review",
        versionId: "content-desk-v1",
        assigneeMembershipId: "member-sam",
        reviewerMembershipId: "member-sam",
        updatedAt: "2026-07-13T09:30:00.000Z",
      },
    ],
    reviewComments: [
      {
        id: "comment-desk-1",
        contentId: "content-desk",
        versionId: "content-desk-v1",
        stage: "review",
        authorMembershipId: "member-sam",
        authorDisplayNameSnapshot: "Sam Rivera",
        body: "The practical opening lands. I would hold the proof shot one beat longer.",
        mentionedMembershipIds: ["member-owner"],
        createdAt: "2026-07-13T10:00:00.000Z",
      },
    ],
    commentEvents: [],
    approvals: [
      {
        id: "approval-desk-stale",
        contentId: "content-desk",
        versionId: "content-desk-v1",
        status: "stale",
        actorMembershipId: "member-owner",
        actorDisplayNameSnapshot: "Maya Chen",
        requesterMembershipId: "member-owner",
        reviewerMembershipId: "member-sam",
        createdAt: "2026-07-13T10:15:00.000Z",
        note: "The draft changed after review.",
      },
    ],
    notifications: [
      {
        id: "notification-assignment-desk",
        kind: "assignment",
        title: "Desk reset assigned for review",
        detail: "Sam is shaping the review pass.",
        href: "/app/create/content-desk?stage=review&version=content-desk-v1&assignment=assignment-desk-review&notification=notification-assignment-desk",
        recipientMembershipId: "member-sam",
        createdAt: "2026-07-13T09:31:00.000Z",
      },
      {
        id: "notification-mention-desk",
        kind: "mention",
        title: "Sam mentioned you",
        detail: "Open the exact comment on version 1.",
        href: "/app/create/content-desk?stage=review&version=content-desk-v1&comment=comment-desk-1&notification=notification-mention-desk",
        recipientMembershipId: "member-owner",
        createdAt: "2026-07-13T10:01:00.000Z",
      },
      {
        id: "notification-review-desk",
        kind: "review",
        title: "Approval needs review again",
        detail: "The desk reset changed after its last decision.",
        href: "/app/create/content-desk?stage=review&version=content-desk-v1&approval=approval-desk-stale&notification=notification-review-desk",
        recipientMembershipId: "member-owner",
        createdAt: "2026-07-13T10:16:00.000Z",
      },
    ],
    exports: [],
    publishReceipts: [],
    metrics: [],
    learnings: [],
    hypotheses: [],
    series: [],
    creatorMemory: { ...EMPTY_CREATOR_MEMORY },
    opportunityFeedback: [],
    offlineCaptures: [],
    recoveryNotice: undefined,
    entitlementUsage: {
      plan: "studio",
      used: {},
      reserved: {},
      resetAt: DEMO_RESET_AT,
    },
  };
}

import type { DemoMuseboardData } from "@/lib/demo/fixtures";
import { EMPTY_CREATOR_MEMORY } from "@/domain/creator-intelligence";

export const SAMPLE_WORKSPACE_DELETE_PHRASE = "DELETE SAMPLE WORKSPACE";

type WorkspaceLike = DemoMuseboardData;

function workspaceData(state: WorkspaceLike): DemoMuseboardData {
  return {
    schemaVersion: state.schemaVersion,
    dataMode: state.dataMode,
    onboardingComplete: state.onboardingComplete,
    creator: state.creator,
    opportunities: state.opportunities,
    selectedOpportunityId: state.selectedOpportunityId,
    opportunityDecisions: state.opportunityDecisions,
    ideas: state.ideas,
    visionReferences: state.visionReferences,
    selectedReferenceIds: state.selectedReferenceIds,
    hooks: state.hooks,
    content: state.content,
    plannerTasks: state.plannerTasks,
    plannerUndo: state.plannerUndo,
    comments: state.comments,
    memberships: state.memberships,
    currentActorMembershipId: state.currentActorMembershipId,
    assignments: state.assignments,
    reviewComments: state.reviewComments,
    commentEvents: state.commentEvents,
    approvals: state.approvals,
    notifications: state.notifications,
    exports: state.exports,
    publishReceipts: state.publishReceipts,
    metrics: state.metrics,
    learnings: state.learnings,
    hypotheses: state.hypotheses,
    series: state.series,
    creatorMemory: state.creatorMemory,
    opportunityFeedback: state.opportunityFeedback,
    offlineCaptures: state.offlineCaptures,
    recoveryNotice: state.recoveryNotice,
    entitlementUsage: state.entitlementUsage,
  };
}

export function createSampleWorkspaceExport(
  state: WorkspaceLike,
  exportedAt = new Date().toISOString(),
) {
  return {
    schema: "museboard.sample-workspace" as const,
    schemaVersion: 1 as const,
    exportedAt,
    notice:
      "This is a local sample workspace export from this device. It is not a cloud account export.",
    workspace: workspaceData(state),
  };
}

export function createClearedSampleWorkspace(resetAt: string): DemoMuseboardData {
  return {
    schemaVersion: 1,
    dataMode: "sample",
    onboardingComplete: false,
    creator: undefined,
    opportunities: [],
    selectedOpportunityId: undefined,
    opportunityDecisions: {},
    ideas: [],
    visionReferences: [],
    selectedReferenceIds: [],
    hooks: [],
    content: [],
    plannerTasks: [],
    plannerUndo: undefined,
    comments: [],
    memberships: [],
    currentActorMembershipId: "member-owner",
    assignments: [],
    reviewComments: [],
    commentEvents: [],
    approvals: [],
    notifications: [],
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
      plan: "free",
      used: {},
      reserved: {},
      resetAt,
    },
  };
}

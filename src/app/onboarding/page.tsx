import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseWorkspaceSnapshotStore,
  entitlementResetAt,
  loadCanonicalWorkspace,
  type SupabaseWorkspaceSnapshotClient,
} from "@/lib/workspace/repository";

export const metadata: Metadata = {
  title: "Set up your workspace",
  description: "Create a personalized Museboard workspace without a card or social connection.",
};

export default async function OnboardingPage() {
  if (getFeatureConfig().authMode !== "live") return <OnboardingFlow />;

  const workspace = await getAuthenticatedWorkspace();
  if (!workspace) return <OnboardingFlow />;
  const supabase = await createClient();
  const snapshot = await loadCanonicalWorkspace(
    createSupabaseWorkspaceSnapshotStore(
      supabase as unknown as SupabaseWorkspaceSnapshotClient,
    ),
    workspace.organizationId,
    {
      userId: workspace.userId,
      memberships: workspace.memberships,
      currentActorMembershipId: workspace.currentActorMembershipId,
      plan: workspace.plan,
      used: workspace.used,
      reserved: workspace.reserved,
      resetAt: entitlementResetAt(workspace.plan),
    },
  );
  if (snapshot) redirect("/app/today");
  return <OnboardingFlow liveOrganizationId={workspace.organizationId} />;
}

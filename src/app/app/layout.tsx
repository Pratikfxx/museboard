import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { LiveWorkspaceProvider } from "@/components/workspace/live-workspace-provider";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";
import { createClient } from "@/lib/supabase/server";
import {
  createSupabaseWorkspaceSnapshotStore,
  entitlementResetAt,
  loadCanonicalWorkspace,
  type SupabaseWorkspaceSnapshotClient,
} from "@/lib/workspace/repository";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const config = getFeatureConfig();
  if (config.authMode === "unavailable") redirect("/login?error=configuration");
  if (config.authMode === "live") {
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) redirect("/login?next=/app/today");
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
    if (!snapshot) redirect("/onboarding");
    return (
      <AppShell
        liveWorkspace={{
          displayName: workspace.displayName,
          organizationName: workspace.organizationName,
          plan: workspace.plan,
        }}
      >
        <LiveWorkspaceProvider
          initialSnapshot={snapshot}
          organizationId={workspace.organizationId}
        >
          {children}
        </LiveWorkspaceProvider>
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}

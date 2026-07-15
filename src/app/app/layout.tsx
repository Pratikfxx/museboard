import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const config = getFeatureConfig();
  if (config.authMode === "unavailable") redirect("/login?error=configuration");
  if (config.authMode === "live") {
    const workspace = await getAuthenticatedWorkspace();
    if (!workspace) redirect("/login?next=/app/today");
    return (
      <AppShell
        liveWorkspace={{
          displayName: workspace.displayName,
          organizationName: workspace.organizationName,
          plan: workspace.plan,
        }}
      >
        {children}
      </AppShell>
    );
  }
  return <AppShell>{children}</AppShell>;
}

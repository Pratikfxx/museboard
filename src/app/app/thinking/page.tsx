import { ThinkingRoomLibrary } from "@/components/thinking-rooms/thinking-room-library";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";

export default async function ThinkingPage() {
  const mode = getFeatureConfig().authMode;
  if (mode !== "live") return <ThinkingRoomLibrary mode="sample" />;

  const workspace = await getAuthenticatedWorkspace();
  return (
    <ThinkingRoomLibrary
      liveContext={workspace ? {
        organizationId: workspace.organizationId,
        workspaceId: workspace.organizationSlug,
        userId: workspace.userId,
        displayName: workspace.displayName,
        canCreate: workspace.role !== "viewer",
        canAssignDecisionOwner: workspace.role === "owner",
      } : undefined}
      mode="live"
    />
  );
}

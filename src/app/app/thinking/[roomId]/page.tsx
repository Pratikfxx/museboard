import { ThinkingRoomWorkspace } from "@/components/thinking-rooms/thinking-room-workspace";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";

export default async function ThinkingRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const mode = getFeatureConfig().authMode;
  if (mode !== "live") return <ThinkingRoomWorkspace mode="sample" roomId={roomId} />;

  const workspace = await getAuthenticatedWorkspace();
  return (
    <ThinkingRoomWorkspace
      liveContext={workspace ? {
        userId: workspace.userId,
        displayName: workspace.displayName,
        canEdit: workspace.role !== "viewer",
        presenceEnabled: true,
      } : undefined}
      mode="live"
      roomId={roomId}
    />
  );
}

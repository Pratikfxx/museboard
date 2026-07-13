import { WorkshopWorkspace } from "@/components/workshop/workshop-workspace";

export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ stage?: string; mode?: string; assignment?: string; version?: string; comment?: string; approval?: string; notification?: string }>;
}) {
  const [{ contentId }, query] = await Promise.all([params, searchParams]);
  const stage = ["hook", "outline", "script", "review"].includes(query.stage ?? "")
    ? (query.stage as "hook" | "outline" | "script" | "review")
    : undefined;
  const focusKind = query.comment ? "comment" : query.approval ? "approval" : query.assignment ? "assignment" : undefined;
  return <WorkshopWorkspace contentId={contentId} focusKind={focusKind} focusTarget={query.comment ?? query.approval ?? query.assignment} initialStage={stage} notificationId={query.notification} requestedVersionId={query.version} voiceMode={query.mode === "voice"} />;
}

import { WorkshopWorkspace } from "@/components/workshop/workshop-workspace";

export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ contentId: string }>;
  searchParams: Promise<{ stage?: string; mode?: string }>;
}) {
  const [{ contentId }, query] = await Promise.all([params, searchParams]);
  const stage = ["hook", "outline", "script"].includes(query.stage ?? "")
    ? (query.stage as "hook" | "outline" | "script")
    : undefined;
  return <WorkshopWorkspace contentId={contentId} initialStage={stage} voiceMode={query.mode === "voice"} />;
}

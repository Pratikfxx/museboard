import { TeamWorkspace } from "@/components/collaboration/team-workspace";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; invite?: string; member?: string }>;
}) {
  const query = await searchParams;
  const initialTab = ["people", "review", "inbox"].includes(query.tab ?? "")
    ? (query.tab as "people" | "review" | "inbox")
    : "people";
  return (
    <TeamWorkspace
      focusId={query.invite ?? query.member}
      initialTab={initialTab}
    />
  );
}

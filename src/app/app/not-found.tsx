import { EmptyState } from "@/components/ui/empty-state";

export default function WorkspaceNotFound() {
  return <EmptyState actionHref="/app/today" actionLabel="Return to Today" detail="That workspace view is not available in this build." title="We couldn’t find that view." />;
}

"use client";

import { ErrorBoundaryState } from "@/components/ui/error-boundary";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorBoundaryState reset={reset} />;
}

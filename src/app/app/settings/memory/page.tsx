import type { Metadata } from "next";

import { CreatorMemoryWorkspace } from "@/components/memory/creator-memory-workspace";

export const metadata: Metadata = { title: "Creator memory · Museboard" };

export default function CreatorMemoryPage() {
  return <CreatorMemoryWorkspace />;
}

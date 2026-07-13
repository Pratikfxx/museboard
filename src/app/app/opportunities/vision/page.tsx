import type { Metadata } from "next";

import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";

export const metadata: Metadata = {
  title: "Vision Board",
  description: "Keep rights-aware local reference metadata ready for strategy.",
};

export default function VisionBoardPage() {
  return <OpportunitiesWorkspace view="vision" />;
}

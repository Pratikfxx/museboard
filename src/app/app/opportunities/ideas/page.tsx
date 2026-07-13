import type { Metadata } from "next";

import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";

export const metadata: Metadata = {
  title: "Idea Board",
  description: "Group source-backed ideas and promote them safely into the workshop.",
};

export default function IdeaBoardPage() {
  return <OpportunitiesWorkspace view="ideas" />;
}

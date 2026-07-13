import type { Metadata } from "next";

import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";

export const metadata: Metadata = {
  title: "Opportunities",
  description: "Review source-backed creative openings and shape the useful ones.",
};

export default function OpportunitiesPage() {
  return <OpportunitiesWorkspace view="for-you" />;
}

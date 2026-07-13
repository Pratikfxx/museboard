import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { OwnerOpportunityConsole } from "@/components/opportunities/owner-opportunity-console";

export const metadata: Metadata = {
  title: "Opportunity Operator Preview",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function InternalOpportunitiesPage() {
  const expectedToken = process.env.MUSEBOARD_OWNER_PREVIEW_TOKEN;
  const suppliedToken = (await cookies()).get("museboard-owner-preview")?.value;
  if (!expectedToken || suppliedToken !== expectedToken) notFound();

  return <OwnerOpportunityConsole />;
}

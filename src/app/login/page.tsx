import type { Metadata } from "next";

import { DemoAccess } from "@/components/marketing/demo-access";
import { LiveAuthAccess } from "@/components/marketing/live-auth-access";
import { safeInternalPath } from "@/lib/auth/redirect";
import { getFeatureConfig } from "@/lib/config/features";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const config = getFeatureConfig();
  if (config.authMode === "live") {
    const query = await searchParams;
    return <LiveAuthAccess mode="login" next={safeInternalPath(query.next)} />;
  }
  return <DemoAccess configurationUnavailable={config.authMode === "unavailable"} mode="login" />;
}

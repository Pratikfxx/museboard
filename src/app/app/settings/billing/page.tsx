import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { getAuthenticatedWorkspace } from "@/lib/auth/workspace";
import { getFeatureConfig } from "@/lib/config/features";
import { hasManageableSubscription } from "@/lib/stripe/server";

export default async function BillingSettingsPage() {
  const config = getFeatureConfig();
  const mode =
    config.billingMode === "live" && !config.features.liveBilling
      ? "unavailable"
      : config.billingMode;
  const workspace = mode === "live" ? await getAuthenticatedWorkspace() : null;

  return (
    <BillingWorkspace
      authoritativePlan={workspace?.plan}
      hasSubscription={workspace ? hasManageableSubscription(workspace) : false}
      mode={mode}
      organizationId={workspace?.organizationId}
      stripeStatus={workspace?.stripeStatus}
      unavailableReason={
        mode === "unavailable"
          ? config.unavailableReason ?? "Live billing is currently disabled."
          : undefined
      }
    />
  );
}

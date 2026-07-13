import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { getFeatureConfig } from "@/lib/config/features";

export default function BillingSettingsPage() {
  const config = getFeatureConfig();
  const mode =
    config.billingMode === "live" && !config.features.liveBilling
      ? "unavailable"
      : config.billingMode;
  return (
    <BillingWorkspace
      mode={mode}
      unavailableReason={
        mode === "unavailable"
          ? config.unavailableReason ?? "Live billing is currently disabled."
          : undefined
      }
    />
  );
}

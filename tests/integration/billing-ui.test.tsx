import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { BillingWorkspace } from "@/components/billing/billing-workspace";
import { getFeatureConfig } from "@/lib/config/features";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("billing settings", () => {
  beforeEach(() => {
    useMuseboardStore.getState().resetDemo();
  });

  it("labels sample billing as local and never implies a charge", async () => {
    const user = userEvent.setup();
    render(<BillingWorkspace mode="demo" />);

    expect(screen.getByText(/sample billing · no charge/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /try creator in sample workspace/i }));
    expect(useMuseboardStore.getState().entitlementUsage.plan).toBe("creator");
    expect(screen.getByText(/no payment was made/i)).toBeInTheDocument();
  });

  it("fails closed when live billing configuration is incomplete", () => {
    render(
      <BillingWorkspace
        mode="unavailable"
        unavailableReason="Live billing is not fully configured."
      />,
    );

    expect(screen.getByText(/billing unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button").every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("renders server-confirmed live plan state and routes subscribers to management", () => {
    render(
      <BillingWorkspace
        authoritativePlan="pro"
        hasSubscription
        mode="live"
        organizationId="6d9bb4d1-2276-46d0-9a0b-c5286198c23f"
        stripeStatus="active"
      />,
    );

    expect(screen.getByText("Pro", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText(/stripe status: active/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /current plan/i })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /manage plan/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /manage billing on stripe/i })).toBeEnabled();
  });

  it("does not enable live billing from a partial environment", () => {
    const config = getFeatureConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      STRIPE_SECRET_KEY: "sk_test_partial",
    });

    expect(config.billingMode).toBe("unavailable");
    expect(config.features.liveBilling).toBe(false);
  });

  it("links billing settings to local data controls", () => {
    render(<BillingWorkspace mode="demo" />);

    expect(screen.getByRole("link", { name: /data controls/i })).toHaveAttribute(
      "href",
      "/app/settings/data",
    );
  });
});

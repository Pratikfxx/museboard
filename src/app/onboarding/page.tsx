import type { Metadata } from "next";

import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

export const metadata: Metadata = {
  title: "Set up your sample workspace",
  description: "Create a personalized Museboard starter workspace without a card or social connection.",
};

export default function OnboardingPage() {
  return <OnboardingFlow />;
}

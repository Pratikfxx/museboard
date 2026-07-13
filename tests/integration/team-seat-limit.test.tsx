import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { TeamWorkspace } from "@/components/collaboration/team-workspace";
import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";
import { useMuseboardStore } from "@/lib/store/museboard-store";

describe("team seat limit", () => {
  beforeEach(() => {
    localStorage.clear();
    useMuseboardStore.getState().resetDemo();
    useMuseboardStore.getState().completeOnboarding(buildStarterWorkspace({
      name: "Maya Chen",
      outcome: "build_system",
      archetype: "tech_education",
      audience: "Independent creators",
      platforms: ["youtube_shorts"],
      weeklyCapacityMinutes: 240,
      voice: "Warm and precise",
      boundaries: "No unsupported claims",
      firstHook: "The useful system is the one you can repeat.",
    }));
  });

  it("makes the full free-plan seat state explicit before submission", () => {
    render(<TeamWorkspace />);

    expect(screen.getByRole("button", { name: /seat limit reached/i })).toBeDisabled();
    expect(screen.getByText(/upgrade to pro for 2 seats/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /compare plans and team seats/i })).toHaveAttribute(
      "href",
      "/app/settings/billing",
    );
  });
});

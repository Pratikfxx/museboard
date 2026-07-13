import { describe, expect, it } from "vitest";

import { buildStarterWorkspace } from "@/lib/demo/starter-workspace";

describe("starter workspace identity", () => {
  it("uses the creator name captured during onboarding", () => {
    const workspace = buildStarterWorkspace({
      name: "  Maya Chen  ",
      outcome: "plan_week",
      archetype: "music",
      audience: "Independent artists",
      platforms: ["instagram_reels"],
      weeklyCapacityMinutes: 240,
      voice: "Warm and direct",
      boundaries: "No fake urgency",
      firstHook: "The unfinished chorus is worth sharing.",
    });

    expect(workspace.creator.name).toBe("Maya Chen");
  });
});

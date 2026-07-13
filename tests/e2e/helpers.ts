import type { Page } from "@playwright/test";

import { createDemoState } from "../../src/lib/demo/fixtures";
import { buildStarterWorkspace } from "../../src/lib/demo/starter-workspace";

export async function installSampleWorkspace(page: Page) {
  const workspace = buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "lifestyle_business",
    audience: "Independent creators building a sustainable practice",
    platforms: ["youtube_shorts", "instagram_reels"],
    weeklyCapacityMinutes: 240,
    voice: "Warm, candid, and useful",
    boundaries: "No fake urgency or trend chasing",
    firstHook: "The quiet work is finally becoming visible.",
  });
  const state = {
    ...createDemoState(),
    ...workspace,
    onboardingComplete: true,
    creator: { ...workspace.creator, name: "Maya Chen" },
  };
  await page.addInitScript((sample) => {
    localStorage.setItem(
      "museboard-demo-v1",
      JSON.stringify({ state: sample, version: 1 }),
    );
  }, state);
}

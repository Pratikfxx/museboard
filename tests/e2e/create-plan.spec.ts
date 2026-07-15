import { expect, test } from "@playwright/test";

import { createDemoState } from "../../src/lib/demo/fixtures";
import { buildStarterWorkspace } from "../../src/lib/demo/starter-workspace";

function activeWorkspace() {
  const workspace = buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "tech_education",
    audience: "Independent creators building calmer publishing systems",
    platforms: ["youtube_shorts"],
    weeklyCapacityMinutes: 240,
    voice: "Warm, candid, and precise",
    boundaries: "No unsupported claims",
    firstHook: "Your content calendar is not the system.",
  });
  workspace.creator.timezone = "Asia/Kolkata";
  return {
    ...createDemoState(),
    onboardingComplete: true,
    creator: workspace.creator,
    opportunities: workspace.opportunities,
    selectedOpportunityId: workspace.selectedOpportunityId,
    hooks: workspace.hooks,
    content: workspace.content,
    plannerTasks: workspace.plannerTasks,
    creatorMemory: {
      version: 2,
      preferredPhrases: ["Here is the useful part"],
      avoidPhrases: ["whole system"],
      preferredStructures: ["Name the tension, show the reset, offer one action"],
      notes: ["Keep the language grounded"],
      updatedAt: "2026-07-15T10:00:00.000Z",
    },
  };
}

test("workshop stages and planner move persist in the sample workflow", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript((state) => {
    if (!window.localStorage.getItem("museboard-demo-v1")) {
      window.localStorage.setItem(
        "museboard-demo-v1",
        JSON.stringify({ state, version: 1 }),
      );
    }
  }, activeWorkspace());

  await page.goto("/app/today");
  await expect(page.getByText(/sample workspace · not live/i).first()).toBeVisible();
  await page.getByRole("link", { name: /rewrite in my voice/i }).click();
  await expect(page.getByRole("heading", { name: /rewrite in your voice/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /script draft/i })).toBeEditable();
  await page.getByRole("button", { name: /generate voice rewrite/i }).click();
  await expect(page.getByRole("heading", { name: /suggested rewrite/i })).toBeFocused();
  await expect(page.getByRole("textbox", { name: /suggested script/i })).toHaveValue(/Here is the useful part/u);
  await page.getByRole("button", { name: /use this rewrite/i }).click();
  await expect(page.getByText(/rewrite saved as version 2/i)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: /script draft/i })).toContainText(/Here is the useful part/u);

  await page.getByRole("button", { name: /hooks/i }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: /use this hook/i }).click();
  await expect(page.getByRole("heading", { name: /shape the outline/i })).toBeVisible();
  const outline = page.getByRole("textbox", { name: /outline beats/i });
  await outline.fill("Name the tension\nShow the reset\nOffer one action");
  await expect(page.getByText(/^saved/i)).toBeVisible();
  await page.getByRole("button", { name: /script/i }).click();
  await expect(page.getByRole("textbox", { name: /script draft/i })).toContainText(/your content calendar/i);
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("museboard-demo-v1");
    if (!raw) return "";
    const state = JSON.parse(raw).state;
    return state.content?.[0]?.versions?.at(-1)?.outline?.join(" ") ?? "";
  })).toContain("Show the reset");

  await page.reload();
  await expect(page.getByRole("textbox", { name: /script draft/i })).toBeEditable();
  await page.getByRole("button", { name: /outline/i }).click();
  await expect(page.getByRole("textbox", { name: /outline beats/i })).toHaveValue(/show the reset/i);

  await page.goto("/app/plan");
  const moveButton = page.getByRole("button", { name: /move record/i }).first();
  await moveButton.click();
  let sheet = page.getByRole("dialog", { name: /move record/i });
  await expect(sheet.getByLabel(/day/i)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(moveButton).toBeFocused();
  await moveButton.click();
  sheet = page.getByRole("dialog", { name: /move record/i });
  await sheet.getByLabel(/day/i).selectOption("2026-07-17");
  await sheet.getByLabel(/time/i).selectOption("10:15");
  await sheet.getByRole("button", { name: /move task/i }).click();
  await expect(page.getByRole("status")).toContainText(/friday/i);
  await page.getByRole("button", { name: /undo move/i }).click();
  await expect(page.getByRole("status")).toContainText(/restored/i);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

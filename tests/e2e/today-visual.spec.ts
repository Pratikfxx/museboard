import { chromium, expect, test, type Page } from "@playwright/test";

import { createDemoState } from "../../src/lib/demo/fixtures";
import { buildStarterWorkspace } from "../../src/lib/demo/starter-workspace";

const storageKey = "museboard-demo-v1";
const themeKey = "museboard-theme";

test.describe.configure({ mode: "serial", timeout: 60_000 });

function personalizedState() {
  const workspace = buildStarterWorkspace({
    outcome: "plan_week",
    archetype: "lifestyle_business",
    audience: "Independent designers rebuilding a sustainable creative habit",
    platforms: ["youtube_shorts", "tiktok_video"],
    weeklyCapacityMinutes: 240,
    voice: "Warm, candid, and precise",
    boundaries: "No fake urgency or trend chasing",
    firstHook: "Perfection is costing us the story.",
  });
  const [selectedOpportunity, ...otherOpportunities] = workspace.opportunities;
  const opportunity = {
    ...selectedOpportunity,
    title: "The quiet return of imperfect creative work.",
    summary:
      "Behind-the-scenes process stories are outpacing polished content across your saved references.",
  };

  return {
    ...createDemoState(),
    onboardingComplete: true,
    creator: { ...workspace.creator, name: "Maya Chen" },
    opportunities: [opportunity, ...otherOpportunities],
    selectedOpportunityId: workspace.selectedOpportunityId,
    hooks: workspace.hooks,
    content: workspace.content.map((item) => ({
      ...item,
      title: opportunity.title,
      versions: item.versions.map((version) => ({
        ...version,
        angle: "What I stopped polishing",
      })),
    })),
    plannerTasks: workspace.plannerTasks,
  };
}

async function openToday(
  page: Page,
  {
    theme,
    viewport,
    reducedMotion = "no-preference",
    waitForImages = true,
  }: {
    theme: "light" | "dark";
    viewport: { width: number; height: number };
    reducedMotion?: "reduce" | "no-preference";
    waitForImages?: boolean;
  },
) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.setViewportSize(viewport);
  await page.emulateMedia({ colorScheme: theme, reducedMotion });
  await page.addInitScript(
    ({ demo, selectedTheme, stateKey, preferenceKey }) => {
      window.localStorage.setItem(
        stateKey,
        JSON.stringify({ state: demo, version: 1 }),
      );
      window.localStorage.setItem(preferenceKey, selectedTheme);
    },
    {
      demo: personalizedState(),
      selectedTheme: theme,
      stateKey: storageKey,
      preferenceKey: themeKey,
    },
  );
  await page.goto("/app/today");
  await expect(
    page.getByRole("heading", { name: "Good morning, Maya" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
  await expect(
    page.getByText("Sample workspace · not live", { exact: true }).first(),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    )
    .toBe(true);
  if (waitForImages) {
    await expect
      .poll(() =>
        page.evaluate(() =>
          Array.from(document.images)
            .filter((image) => image.getClientRects().length > 0)
            .every((image) => image.complete && image.naturalWidth > 0),
        ),
        { timeout: 15_000 },
      )
      .toBe(true);
  }
  return consoleErrors;
}

for (const theme of ["light", "dark"] as const) {
  test(`Today ${theme} desktop matches the approved hierarchy`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Canonical screenshots run once because each test sets its own viewport.",
    );
    const errors = await openToday(page, {
      theme,
      viewport: { width: 1440, height: 1024 },
      reducedMotion: "reduce",
    });

    await expect(
      page.locator('[data-fallback-reason="reduced-motion"]:visible'),
    ).toBeVisible();
    await expect(page).toHaveScreenshot(`today-desktop-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    expect(errors).toEqual([]);
  });

  test(`Today ${theme} mobile keeps navigation and agenda usable`, async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Canonical screenshots run once because each test sets its own viewport.",
    );
    const errors = await openToday(page, {
      theme,
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });

    await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Next planned block" })).toBeVisible();
    await expect(page.locator('[data-fallback-reason="reduced-motion"]:visible')).toBeVisible();
    await expect(page).toHaveScreenshot(`today-mobile-${theme}.png`, {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    });
    expect(errors).toEqual([]);
  });
}

test("idea motion pauses and resumes without blocking the decision", async ({ baseURL }) => {
  const browser = await chromium.launch({
    args: [
      "--enable-webgl",
      "--ignore-gpu-blocklist",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({ baseURL });

  try {
    const errors = await openToday(page, {
      theme: "light",
      viewport: { width: 1440, height: 1024 },
      waitForImages: false,
    });

    const figure = page.getByRole("figure", { name: /woven paths/i });
    const fallback = page.locator("[data-fallback-reason]:visible");
    if (await fallback.count()) {
      await expect(fallback).toHaveAttribute("data-renderer", "static");
      await expect(page.getByRole("radio").first()).toBeVisible();
      expect(errors).toEqual([]);
      return;
    }
    const pause = page.getByRole("button", { name: "Pause idea sculpture" });
    await expect(pause).toBeVisible();
    await pause.click();
    await expect(figure).toHaveAttribute("data-motion", "paused");
    await page.getByRole("button", { name: "Resume idea sculpture" }).click();
    await expect(figure).toHaveAttribute("data-motion", "playing");
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});

test("hook choice persists, advances to Outline, and theme changes", async ({ page }) => {
  const errors = await openToday(page, {
    theme: "light",
    viewport: { width: 1440, height: 1024 },
  });

  await page.getByText("Confession", { exact: true }).click();
  await page.getByRole("button", { name: "Choose a hook" }).click();
  await expect(page.getByText("Hook chosen · Outline is next")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const value = window.localStorage.getItem(key);
        const state = value ? JSON.parse(value).state : undefined;
        const active = state?.content?.[0];
        return (
          active?.stage === "outline" &&
          active?.versions?.at(-1)?.selectedHookId === state?.hooks?.[1]?.id
        );
      }, storageKey),
    )
    .toBe(true);
  const workflow = page.getByRole("list", { name: "Content workflow" });
  await expect(workflow.locator("li").filter({ hasText: "Hook" })).toHaveAttribute(
    "data-state",
    "complete",
  );
  await expect(
    workflow.locator("li").filter({ hasText: "Outline" }),
  ).toHaveAttribute("data-state", "active");
  await expect(
    page.getByRole("button", { name: "Choose a hook" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Open outline workshop" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /theme: light/i }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), themeKey))
    .toBe("dark");
  expect(errors).toEqual([]);
});

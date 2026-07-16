import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

for (const route of [
  "/",
  "/app/today",
  "/app/plan",
  "/app/thinking",
  "/app/thinking/thinking-room-sample-direction",
] as const) {
  test(`${route} has no serious automated accessibility violations`, async ({ page }) => {
    await installSampleWorkspace(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    if (route === "/app/today") {
      await expect(page.getByRole("heading", { name: "Good morning, Maya" })).toBeVisible();
    } else if (route === "/app/plan") {
      await expect(page.getByRole("heading", { name: /production week/i })).toBeVisible();
    } else if (route === "/app/thinking") {
      await expect(page.getByRole("heading", { name: /bring the question/i })).toBeVisible();
    } else if (route.includes("thinking-room-sample-direction")) {
      await expect(page.getByRole("heading", { name: /sample room: which tension/i })).toBeVisible();
    } else {
      await page.getByRole("main").waitFor();
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      results.violations.filter(({ impact }) =>
        impact === "serious" || impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("keyboard users can skip straight to the workspace", async ({ page }) => {
  await installSampleWorkspace(page);
  await page.goto("/app/today");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to workspace" });
  await expect(skip).toBeFocused();
  await skip.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("dark Today keeps the same serious-violation accessibility gate", async ({ page }) => {
  await installSampleWorkspace(page);
  await page.addInitScript(() => localStorage.setItem("museboard-theme", "dark"));
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/app/today");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Good morning, Maya" })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations.filter(({ impact }) => impact === "serious" || impact === "critical")).toEqual([]);
});

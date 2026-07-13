import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

for (const route of ["/", "/app/today", "/app/plan"] as const) {
  test(`${route} has no serious automated accessibility violations`, async ({ page }) => {
    await installSampleWorkspace(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    await page.locator("main, body").first().waitFor();

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

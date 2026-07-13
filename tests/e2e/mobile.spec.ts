import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

test("320px navigation stays usable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await installSampleWorkspace(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/today");

  const nav = page.getByRole("navigation", { name: "Mobile primary" });
  await expect(nav).toContainText("Today");
  await expect(nav).toContainText("Opportunities");
  await expect(nav).toContainText("Create");
  await expect(nav).toContainText("Plan");
  await expect(nav.getByRole("button", { name: "More" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await nav.getByRole("button", { name: "More" }).click();
  const sheet = page.getByRole("dialog", { name: "More Museboard destinations" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("link", { name: /data controls/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

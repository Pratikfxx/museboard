import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

test("offline quick capture stays visible and can be shaped after reconnecting", async ({ page }) => {
  await installSampleWorkspace(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/today");
  const capture = page.getByLabel("Quick capture");
  const save = page.getByRole("button", { name: "Save idea" });
  await expect(capture).toBeVisible();
  await expect(save).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  await capture.fill("Offline idea worth keeping");
  await save.click();
  await expect(page.getByText(/saved on this device/i)).toBeVisible();
  await expect(page.getByText(/visible in your capture inbox/i)).toBeVisible();
  await expect(page.getByText("Offline idea worth keeping", { exact: true })).toBeVisible();

  await page.context().setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.reload();
  await expect(page.getByText("Offline idea worth keeping", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Shape capture" }).click();
  await expect(page.getByText(/capture shaped on your idea board/i)).toBeVisible();
  await expect(page.getByText("Offline idea worth keeping", { exact: true })).toHaveCount(0);
  await expect(page.locator("#capture-inbox header b")).toHaveText("0");
});

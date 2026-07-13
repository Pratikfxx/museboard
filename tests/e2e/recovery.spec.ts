import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

test("offline quick capture stays on the device without claiming cloud sync", async ({ page }) => {
  await installSampleWorkspace(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/app/today");
  const capture = page.getByLabel("Quick capture");
  await expect(capture).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));

  await capture.fill("Offline idea worth keeping");
  await page.getByRole("button", { name: "Save idea" }).click();
  await expect(page.getByText(/saved on this device/i)).toBeVisible();
  await expect(page.getByText(/waiting for a connected account to sync/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("museboard-offline-captures-v1");
    return raw ? JSON.parse(raw).length : 0;
  })).toBe(1);

  await page.context().setOffline(false);
});

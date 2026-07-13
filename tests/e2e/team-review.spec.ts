import { expect, test } from "@playwright/test";

import { createDemoState } from "../../src/lib/demo/fixtures";

test("owner reviews a version and opens the exact notification destination", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const state = createDemoState();
  state.entitlementUsage.plan = "studio";
  const firstVersion = state.content[0].versions[0];
  state.content[0].versions.push({
    ...firstVersion,
    id: "content-desk-v2",
    number: 2,
    script: "A current version that remains separate from the historical review.",
    createdAt: "2026-07-13T11:00:00.000Z",
  });
  state.content[0].currentVersionId = "content-desk-v2";
  await page.addInitScript((payload) => {
    localStorage.setItem("museboard-demo-v1", JSON.stringify({ state: payload, version: 1 }));
  }, state);

  await page.goto("/app/team?tab=review");
  await expect(page.getByRole("heading", { name: /team studio/i })).toBeVisible();
  await page.getByRole("button", { name: /request fresh review/i }).click();
  await page.getByRole("button", { name: /^approve version/i }).click();
  await expect(page.getByText(/approved for this version/i)).toBeVisible();

  await page.getByRole("button", { name: /inbox/i }).click();
  const notification = page.getByRole("link", { name: /approval needs review again/i }).first();
  await notification.click();
  await expect(page).toHaveURL(/\/app\/create\/content-desk\?.*approval=/);
  await expect(page.getByText(/historical version 1 · read only/i)).toBeVisible();
  await expect(page.getByText(/approval stale by maya chen/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /return to current version 2/i })).toBeVisible();

  await page.goto("/app/team?tab=people");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

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
  state.assignments[0].versionId = "content-desk-v2";
  state.notifications.push({
    id: "notification-missing-target",
    kind: "review",
    title: "Missing review target",
    detail: "This notification intentionally points to a removed target.",
    href: "/app/create/content-desk?stage=review&version=content-desk-v1&approval=missing-approval&notification=notification-missing-target",
    recipientMembershipId: "member-owner",
    createdAt: "2026-07-13T10:20:00.000Z",
  });
  await page.addInitScript((payload) => {
    localStorage.setItem("museboard-demo-v1", JSON.stringify({ state: payload, version: 1 }));
  }, state);

  await page.goto("/app/team?tab=review");
  await expect(page.getByRole("heading", { name: /team studio/i })).toBeVisible();
  await page.getByRole("button", { name: /request fresh review/i }).click();
  await expect(page.getByText(/awaiting sam rivera/i)).toBeVisible();
  await page.getByLabel(/preview collaboration as/i).selectOption("member-sam");
  await page.getByRole("button", { name: /^approve version/i }).click();
  await expect(page.getByText(/approved for this version/i)).toBeVisible();
  await page.getByLabel(/preview collaboration as/i).selectOption("member-owner");

  await page.getByRole("button", { name: /inbox/i }).click();
  const notification = page.getByRole("link", { name: /approval needs review again/i }).first();
  await expect(notification).toHaveAttribute("data-read", "false");
  await notification.click();
  await expect(page).toHaveURL(/\/app\/create\/content-desk\?.*approval=/);
  await expect(page.getByText(/historical version 1 · read only/i)).toBeVisible();
  await expect(page.getByText(/approval stale by maya chen/i)).toBeVisible();
  await expect(page.getByText(/approval stale by maya chen/i).locator(".." )).toBeFocused();
  await expect(page.getByRole("link", { name: /return to current version 2/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("museboard-demo-v1");
    if (!raw) return undefined;
    const persisted = JSON.parse(raw).state;
    return persisted.notifications?.find(({ id }: { id: string }) => id === "notification-review-desk")?.readAt;
  })).toEqual(expect.any(String));

  await page.getByRole("link", { name: /^team$|team and profile/i }).first().click();
  await page.getByRole("button", { name: /inbox/i }).click();
  await expect(page.getByRole("link", { name: /approval needs review again/i }).first()).toHaveAttribute("data-read", "true");
  const missing = page.getByRole("link", { name: /missing review target/i });
  await expect(missing).toHaveAttribute("data-read", "false");
  await missing.click();
  await expect(page.getByText(/linked approval is no longer available/i)).toBeVisible();
  await page.getByRole("link", { name: /^team$|team and profile/i }).first().click();
  await page.getByRole("button", { name: /inbox/i }).click();
  await expect(page.getByRole("link", { name: /missing review target/i })).toHaveAttribute("data-read", "false");

  await page.getByRole("button", { name: /people/i }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

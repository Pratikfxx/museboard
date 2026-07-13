import { expect, test } from "@playwright/test";

test("approved draft exports, records a receipt, and learns from imported results", async ({ page }) => {
  await page.goto("/app/team");
  await page.getByRole("button", { name: "Review" }).click();
  await page.getByRole("button", { name: /request fresh review/i }).click();
  await page.getByLabel("Preview collaboration as").selectOption({ label: "Sam Rivera" });
  await page.getByRole("button", { name: /approve version/i }).click();
  await expect(page.getByRole("heading", { name: /approved for this version/i })).toBeVisible();

  await page.goto("/app/create/content-desk?stage=review");
  await page.getByRole("button", { name: /^ready$/i }).click();
  await expect(page.getByRole("heading", { name: /package the work/i })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /download validated zip/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^museboard-.+-instagram-reels-\d{4}-\d{2}-\d{2}-v1\.zip$/u);
  await expect(page.getByText(/package validated and recorded/i)).toBeVisible();

  await page.getByLabel("Published HTTPS post URL").fill("https://www.instagram.com/reel/museboard-demo/");
  await page.getByLabel("Published time").fill("2026-07-13T12:00");
  await page.getByRole("button", { name: /save manual unverified receipt/i }).click();
  await expect(page.getByText(/1 manual unverified receipt recorded/i)).toBeVisible();

  await page.goto("/app/learn");
  await page.getByRole("button", { name: /load safe sample/i }).click();
  await page.getByRole("button", { name: /preview mapping/i }).click();
  await expect(page.getByText("10 valid", { exact: true })).toBeVisible();
  await page.getByLabel(/confirm naive published times/i).check();
  await page.getByRole("button", { name: /save valid rows and recompute/i }).click();
  await expect(page.getByText(/associated with \d+\.\d+% higher median views/i)).toBeVisible();
  await expect(page.getByText(/medium confidence/i)).toBeVisible();
});

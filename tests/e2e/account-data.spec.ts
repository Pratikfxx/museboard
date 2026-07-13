import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

test("creator downloads an inspectable local export, then clears only workspace data", async ({ page }) => {
  await installSampleWorkspace(page);
  await page.addInitScript(() => localStorage.setItem("museboard-theme", "dark"));
  await page.goto("/app/settings/data");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download workspace JSON" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^museboard-sample-workspace-\d{4}-\d{2}-\d{2}\.json$/u);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const payload = JSON.parse(await readFile(downloadPath!, "utf8"));
  expect(payload).toMatchObject({
    schema: "museboard.sample-workspace",
    schemaVersion: 1,
    workspace: { dataMode: "sample", onboardingComplete: true },
  });
  expect(payload.workspace.content.length).toBeGreaterThan(0);

  const confirmation = page.getByLabel(/type delete sample workspace to confirm/i);
  await confirmation.fill("delete sample workspace");
  await expect(page.getByRole("button", { name: /delete sample workspace from this device/i })).toBeDisabled();
  await confirmation.fill("DELETE SAMPLE WORKSPACE");
  await page.getByRole("button", { name: /delete sample workspace from this device/i }).click();
  await expect(page.getByRole("status")).toContainText("No cloud account or provider data was deleted");
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem("museboard-demo-v1");
    const state = raw ? JSON.parse(raw).state : undefined;
    return { content: state?.content?.length, theme: localStorage.getItem("museboard-theme") };
  })).toEqual({ content: 0, theme: "dark" });
});

test("private operations route fails closed when production auth is absent", async ({ page }) => {
  const response = await page.goto("/app/internal/ops");

  expect(response?.status()).toBe(404);
  await expect(page.getByText(/safe job state/i)).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("visitor can activate a sample workspace without an account or card", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Know what to make next." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Try the sample workspace" }).first().click();

  await page.getByRole("button", { name: "Plan my next week" }).click();
  await page.getByRole("button", { name: "Music creator" }).click();
  await page.getByRole("button", { name: "Continue to formats" }).click();
  await page.getByRole("checkbox", { name: "Instagram Reels" }).check();
  await page.getByRole("checkbox", { name: "TikTok video" }).check();
  await page.getByRole("button", { name: "Continue to capacity" }).click();
  await page.getByRole("button", { name: "4 hours per week" }).click();
  await page.getByRole("button", { name: "Continue to boundaries" }).click();
  await page.getByRole("button", { name: "Continue to your first hook" }).click();
  await page.getByRole("button", { name: "Create sample workspace" }).click();

  await expect(page).toHaveURL(/\/app\/today$/);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = localStorage.getItem("museboard-demo-v1");
        return raw ? JSON.parse(raw).state?.onboardingComplete : false;
      }),
    )
    .toBe(true);
});

test("pricing is explicit about the free workflow and exact plan limits", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(page.getByRole("heading", { name: "Pricing that grows with your rhythm" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Free", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Creator", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pro", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Studio", exact: true })).toBeVisible();
  await expect(page.getByText("5 opportunities per week")).toBeVisible();
  await expect(page.getByText("250 opportunities per month")).toBeVisible();
  await expect(page.getByText("Unlimited manual planning").first()).toBeVisible();
});

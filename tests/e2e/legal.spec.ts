import { expect, test } from "@playwright/test";

const legalPages = [
  { path: "/privacy", heading: "Privacy without the fog." },
  { path: "/terms", heading: "Clear rules for making together." },
  { path: "/data-policy", heading: "Know where the work goes." },
];

test("legal drafts stay navigable and fit the viewport", async ({ page }) => {
  for (const legalPage of legalPages) {
    await page.goto(legalPage.path);

    await expect(page.getByRole("heading", { level: 1, name: legalPage.heading })).toBeVisible();
    await expect(page.getByText("Pre-launch draft · pending legal review")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Legal documents" })).toBeVisible();

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    );
    expect(viewportFits).toBe(true);
  }

  await page.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await page.getByRole("link", { name: "Back to Museboard" }).click();
  await expect(page).toHaveURL(/\/$/);
});

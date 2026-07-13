import { expect, test } from "@playwright/test";

test("opportunity tabs shape an idea and validate Vision metadata without overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/opportunities");
  await expect(
    page.getByText("Sample workspace · not live", { exact: true }).first(),
  ).toBeVisible();

  const firstOpportunity = page.getByRole("article").first();
  const opportunityTitle = await firstOpportunity
    .getByRole("heading")
    .textContent();
  await firstOpportunity.getByRole("button", { name: "Shape idea" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /shaped/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Idea Board", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/opportunities\/ideas$/);
  await expect(
    page.getByRole("heading", { name: opportunityTitle ?? "" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Promote to workshop" }).click();
  await expect(page.getByRole("link", { name: /open in workshop/i })).toBeVisible();

  await page.getByRole("link", { name: "Vision Board", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/opportunities\/vision$/);
  await page.getByRole("textbox", { name: "Reference title" }).fill(
    "Warm editorial pacing",
  );
  await page
    .getByRole("textbox", { name: "Reference URL" })
    .fill("http://example.com/reference");
  await page
    .getByRole("textbox", { name: /content hash/i })
    .fill("a".repeat(64));
  await page.getByRole("combobox", { name: "Rights status" }).selectOption(
    "owned",
  );
  await page.getByRole("button", { name: "Add reference metadata" }).click();
  await expect(
    page.getByText("Use an HTTPS URL for web references."),
  ).toBeVisible();

  await page
    .getByRole("textbox", { name: "Reference URL" })
    .fill("https://example.com/reference");
  await page.getByRole("button", { name: "Add reference metadata" }).click();
  await expect(page.getByText(/no file or media was uploaded/i)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole("navigation", { name: "Mobile primary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Vision Board" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);

  expect(errors).toEqual([]);

  await page.goto("/app/internal/opportunities");
  await expect(
    page.getByRole("heading", { name: /couldn.t find that view/i }),
  ).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";

import { installSampleWorkspace } from "./helpers";

const QUESTION = "Which audience truth should anchor our next practical series?";
const CONTEXT = "Choose a credible direction for three weekly episodes.";
const EVIDENCE = "Audience replies keep saving practical examples that name a real constraint.";
const CHALLENGE = "A repeated format could feel predictable unless every episode earns fresh proof.";
const POSSIBILITY = "Build each episode around one recognizable constraint and one new piece of proof.";
const DECISION = `${POSSIBILITY} Start with the audience's most costly weekly trade-off.`;

const variants = [
  { name: "desktop light", project: "chromium", width: 1440, height: 1000, theme: "light", synthesisPosition: "sticky" },
  { name: "desktop dark", project: "chromium", width: 1440, height: 1000, theme: "dark", synthesisPosition: "sticky" },
  { name: "mobile light", project: "mobile-chrome", width: 390, height: 844, theme: "light", synthesisPosition: "static" },
  { name: "mobile dark", project: "mobile-chrome", width: 390, height: 844, theme: "dark", synthesisPosition: "static" },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
}

async function addContribution(page: Page, lens: "Evidence" | "Challenges" | "Possibilities", body: string) {
  const tab = page.getByRole("tab", { name: lens });
  if (await tab.isVisible()) await tab.click();
  await page.getByRole("button", { name: `Add ${lens.toLocaleLowerCase()}` }).click();
  const composer = page.getByRole("region", { name: `Contribution composer for ${lens}` });
  await composer.getByRole("textbox", { name: `Contribution to ${lens}` }).fill(body);
  await composer.getByRole("button", { name: "Add contribution" }).press("Enter");
  await expect(page.getByText(body, { exact: true })).toBeVisible();
}

for (const variant of variants) {
  test(`${variant.name} completes a Thinking Room decision and preserves Idea Board provenance`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== variant.project, `covered by the ${variant.project} project`);
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
    });
    page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

    await page.setViewportSize({ width: variant.width, height: variant.height });
    await installSampleWorkspace(page);
    await page.addInitScript((theme) => localStorage.setItem("museboard-theme", theme), variant.theme);
    await page.emulateMedia({ colorScheme: variant.theme, reducedMotion: "reduce" });

    await page.goto("/app/thinking");
    await expect(page.locator("html")).toHaveAttribute("data-theme", variant.theme);
    await expect(page.getByRole("heading", { name: "Bring the question you cannot settle in a comment thread." })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`thinking-library-${variant.theme}.png`) });

    await page.getByRole("button", { name: "New Thinking Room" }).click();
    await page.getByRole("textbox", { name: "Strategic question" }).fill(QUESTION);
    await page.getByRole("textbox", { name: "Optional context" }).fill(CONTEXT);
    await page.getByRole("button", { name: "Create room" }).press("Enter");

    const roomLink = page.getByRole("link", { name: new RegExp(QUESTION, "i") });
    await expect(roomLink).toBeFocused();
    await roomLink.press("Enter");
    await expect(page).toHaveURL(/\/app\/thinking\/thinking-room-/);
    const roomUrl = page.url();
    await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const synthesis = page.getByRole("complementary", { name: "Synthesis" });
    await expect(synthesis).toHaveCSS("position", variant.synthesisPosition);

    if (variant.width < 720) {
      const evidenceTab = page.getByRole("tab", { name: "Evidence" });
      await evidenceTab.focus();
      await evidenceTab.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Challenges" })).toBeFocused();
    }

    await addContribution(page, "Evidence", EVIDENCE);
    await addContribution(page, "Challenges", CHALLENGE);
    await addContribution(page, "Possibilities", POSSIBILITY);

    await synthesis.getByRole("button", { name: "Begin synthesis" }).click();
    await expect(synthesis.getByRole("region", { name: "Suggested belief" })).toContainText(POSSIBILITY);
    await synthesis.getByRole("button", { name: "Use suggested belief" }).click();
    const belief = synthesis.getByRole("textbox", { name: "Current shared belief" });
    await expect(belief).toHaveValue(POSSIBILITY);
    await belief.fill(DECISION);
    await synthesis.getByRole("radio", { name: "High confidence" }).check();
    await synthesis.getByRole("button", { name: "Resolve challenge" }).click();
    await synthesis.getByRole("button", { name: "Save synthesis" }).press("Enter");

    await expect(page.getByText("Decided", { exact: true })).toBeVisible();
    await expect(synthesis.getByText(DECISION, { exact: true })).toBeVisible();
    await expect(synthesis.getByText("High confidence", { exact: true })).toBeVisible();
    await expect
      .poll(() => page.getByRole("link", { name: "Skip to workspace" }).evaluate((link) => link.getBoundingClientRect().bottom <= 0))
      .toBe(true);
    await expectNoHorizontalOverflow(page);
    await synthesis.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`thinking-decision-${variant.theme}.png`) });

    await synthesis.getByRole("button", { name: "Create Idea Board direction" }).click();
    await expect(page).toHaveURL(/\/app\/opportunities\/ideas#idea-/);
    await expect(page.getByRole("heading", { name: "Idea Board" })).toBeVisible();
    const idea = page.getByRole("article", { name: new RegExp(DECISION, "i") });
    await expect(idea.getByRole("complementary", { name: "Thinking Room source" })).toContainText("From Thinking Room");
    await expect(idea).toContainText(QUESTION);
    await expect(idea).toContainText("High confidence");
    await expectNoHorizontalOverflow(page);
    await idea.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`thinking-idea-origin-${variant.theme}.png`) });

    await idea.getByRole("link", { name: "Open room" }).click();
    await expect(page).toHaveURL(roomUrl);
    await expect(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
}

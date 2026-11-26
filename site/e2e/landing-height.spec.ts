/** The landing page's length budget: new sections must not make the page longer than it was. */
import { expect, test } from "@playwright/test";

const MAX_PAGE_HEIGHT_PX = 19_100;

test("at 1440x900 the landing page is no taller than its budget", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewport");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThanOrEqual(MAX_PAGE_HEIGHT_PX);
});

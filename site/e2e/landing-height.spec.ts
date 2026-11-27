/** The landing page's length budget: new sections must not make the page longer than it was. */
import { expect, test } from "@playwright/test";

/**
 * The cap at 1440x900. Its commit (95937bfb, scaffold phase 2) recorded no
 * source height; the page measured 16,026 px at that commit, so the cap left
 * room for the sections still to come. Measured 18,497 px on 2026-11-26.
 */
const MAX_PAGE_HEIGHT_PX = 19_100;

test("at 1440x900 the landing page is no taller than its budget", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewport");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(height).toBeLessThanOrEqual(MAX_PAGE_HEIGHT_PX);
});

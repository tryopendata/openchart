/**
 * The hero's first screen at phone and tablet sizes: the chart has to be in it.
 * Each test sets its own viewport, so the file runs on the desktop project only.
 */
import { expect, test } from "@playwright/test";

const NARROW = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];
const CHART_IN_VIEW_PX = 200;

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewports");
});

for (const viewport of NARROW) {
  test(`at ${viewport.width}x${viewport.height} at least ${CHART_IN_VIEW_PX}px of the hero chart is in the first screen`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    const chart = page.locator("#desk [data-hero-chart]");
    await expect(chart).toBeVisible();
    await expect(page.locator("#desk astro-island[ssr]")).toHaveCount(0);
    const top = await chart.evaluate((element) => element.getBoundingClientRect().top);
    expect(viewport.height - top).toBeGreaterThanOrEqual(CHART_IN_VIEW_PX);
    await expect(page.locator("#desk .hero-lede:visible")).toHaveCount(1);
    await expect(page.locator("#desk .hero-lede:visible")).toContainText("from a short JSON spec");
    await expect(page.locator("#desk #hero-install")).toBeVisible();
  });
}

test("at 1440x900 the hero keeps the full lede and its heading order", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("#desk .hero-lede:visible")).toHaveCount(1);
  await expect(page.locator("#desk .hero-lede:visible")).toContainText("with motion built in");
  const firstHeading = page.getByRole("heading").first();
  await expect(firstHeading).toHaveJSProperty("tagName", "H1");
});

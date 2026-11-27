/** The scroll story's larger chart and its scroll-filled rail. */
import { expect, type Page, test } from "@playwright/test";

const section = (page: Page) => page.locator("#story");
const railProgress = (page: Page) =>
  section(page)
    .locator(".story-steps")
    .evaluate((element) => Number(getComputedStyle(element).getPropertyValue("--story-progress")));

async function scrollToStep(page: Page, index: number, block: ScrollLogicalPosition) {
  await section(page)
    .locator("[data-story-step]")
    .nth(index)
    .evaluate((element, position) => element.scrollIntoView({ block: position }), block);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

test("at 1440x900 the story chart fills its column", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewport");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  const box = await section(page).locator(".story-stage").boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(760);
  expect(box?.height).toBeGreaterThanOrEqual(560);
});

test("the rail fills from 0 to 1 as the steps scroll past", async ({ page }) => {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect.poll(() => railProgress(page)).toBe(0);
  await scrollToStep(page, 2, "center");
  await expect.poll(() => railProgress(page)).toBeGreaterThan(0.3);
  expect(await railProgress(page)).toBeLessThan(0.8);
  const steps = await section(page).locator("[data-story-step]").count();
  await scrollToStep(page, steps - 1, "start");
  await expect.poll(() => railProgress(page)).toBe(1);
});

test("at 1024x600 the sticky chart stays inside the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewport");
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto("/");
  // Islands above the story change the page's height as they go live, so scroll again each try.
  await expect(async () => {
    await scrollToStep(page, 2, "center");
    const box = await section(page).locator(".story-stage").boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(600);
  }).toPass({ timeout: 10_000 });
});

test("with reduced motion the rail shows full", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await scrollToStep(page, 0, "end");
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await expect.poll(() => railProgress(page)).toBeGreaterThan(0);
  const scale = await section(page)
    .locator(".story-steps")
    .evaluate((element) => getComputedStyle(element, "::before").transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(scale);
});

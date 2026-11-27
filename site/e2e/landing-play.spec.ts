/**
 * The motion section's playback figure: it leads the section, plays when seen,
 * and its controls work. Runs on the desktop and mobile projects.
 */
import { expect, type Page, test } from "@playwright/test";
import { LIVE_UNAVAILABLE_TEXT, NO_SCRIPT_TEXT } from "../src/components/shared/StillNote";
import { sidewaysOverflow } from "./layout";

const section = (page: Page) => page.locator("#motion");
const figure = (page: Page) => section(page).locator("[data-playback-figure]");
const readout = (page: Page) => figure(page).locator('[class$="-readout"]');
/** The line that corrects the lede when the playback stays a still. */
const stillNote = (page: Page) => section(page).locator("[data-still-note]");
const toggle = (page: Page) => figure(page).getByRole("button", { name: /^(Play|Pause)$/ });

test("the playback figure comes before the payroll bench", async ({ page }) => {
  await page.goto("/");
  const order = await section(page).evaluate((element) => {
    const playback = element.querySelector("[data-playback-figure]");
    const bench = element.querySelector(".motion-chart");
    if (!playback || !bench) return "missing";
    return playback.compareDocumentPosition(bench) & Node.DOCUMENT_POSITION_FOLLOWING
      ? "playback-first"
      : "bench-first";
  });
  expect(order).toBe("playback-first");
});

test("playback starts when seen, pauses, and scrubs", async ({ page }) => {
  await page.goto("/");
  const heightBefore = await figure(page).evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  await figure(page).scrollIntoViewIfNeeded();
  await expect(toggle(page)).toHaveAccessibleName("Pause");
  const first = await readout(page).textContent();
  await expect(readout(page)).not.toHaveText(first ?? "", { timeout: 10_000 });
  const heightAfter = await figure(page).evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(Math.abs(heightAfter - heightBefore)).toBeLessThanOrEqual(2);

  await toggle(page).click();
  await expect(toggle(page)).toHaveAccessibleName("Play");
  const held = await readout(page).textContent();
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await expect(readout(page)).toHaveText(held ?? "");

  const scrubber = figure(page).getByRole("slider", { name: "Time" });
  await scrubber.focus();
  await page.keyboard.press("ArrowRight");
  await expect(readout(page)).not.toHaveText(held ?? "");
  const { scroll, past } = await sidewaysOverflow(page);
  expect(scroll).toBeLessThanOrEqual(1);
  expect(past).toBeLessThanOrEqual(1);
});

test("with reduced motion the playback does not start by itself and the controls still work", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await figure(page).scrollIntoViewIfNeeded();
  await expect(toggle(page)).toHaveAccessibleName("Play");
  const scrubber = figure(page).getByRole("slider", { name: "Time" });
  const before = await readout(page).textContent();
  await scrubber.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(readout(page)).not.toHaveText(before ?? "");
});

// The widths each still is laid out for: there its axes are the live chart's.
const STILL_WIDTHS = [390, 640, 1024];

test("the still and the live chart use the same axis ticks", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewports");
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of STILL_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const ticks = (kind: string) => figure(page).locator(`svg${kind}:visible .oc-axis-tick`);
    const stillTicks = await ticks(".demo-static").allTextContents();
    expect(stillTicks.length, `ticks at ${width}px`).toBeGreaterThan(0);
    await figure(page).scrollIntoViewIfNeeded();
    await expect(toggle(page)).toHaveAccessibleName("Play");
    await expect(ticks(":not(.demo-static)"), `ticks at ${width}px`).toHaveText(stillTicks);
  }
});

test("the still names its year and countries and never renders smaller than the live chart", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewports");
  await page.route("**/*.js", (route) => route.abort());
  for (const width of [390, 640, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const still = figure(page).locator("svg.demo-static:visible");
    await expect(still).toHaveCount(1);
    await expect(still).toContainText("2022");
    await expect(still).toContainText("China");
    const tick = still.locator("text.oc-axis-tick").first();
    const scale = await tick.evaluate((element: SVGTextElement) => element.getScreenCTM()?.a ?? 0);
    expect(scale, `still text scale at ${width}px`).toBeGreaterThanOrEqual(0.95);
  }
});

test("when the playback's data does not load, the still stays and a line says so", async ({
  page,
}) => {
  const loadFailed = page.waitForEvent("console", (message) =>
    message.text().includes("playback chart could not be loaded"),
  );
  await page.route(/\/_astro\/playback\.[^/]+\.js$/, (route) => route.abort());
  await page.goto("/");
  await figure(page).scrollIntoViewIfNeeded();
  await loadFailed;
  await expect(stillNote(page)).toBeVisible();
  await expect(stillNote(page)).toHaveText(LIVE_UNAVAILABLE_TEXT);
  await expect(figure(page).locator("svg.demo-static:visible")).toHaveCount(1);
  await expect(toggle(page)).toHaveCount(0);
});

test("once the playback is live the still line stays hidden", async ({ page }) => {
  await page.goto("/");
  await figure(page).scrollIntoViewIfNeeded();
  await expect(toggle(page)).toBeVisible();
  await expect(stillNote(page)).toBeHidden();
});

test("without JavaScript a line under the playback says it is a still", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({ ...testInfo.project.use, javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(stillNote(page)).toBeVisible();
  await expect(stillNote(page)).toHaveText(NO_SCRIPT_TEXT);
  await context.close();
});

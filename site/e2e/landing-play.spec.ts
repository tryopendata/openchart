/**
 * The motion section's playback figure: it leads the section, plays when seen,
 * and its controls work. Runs on the desktop and mobile projects.
 */
import { expect, type Page, test } from "@playwright/test";
import { sidewaysOverflow } from "./layout";

const section = (page: Page) => page.locator("#motion");
const figure = (page: Page) => section(page).locator("[data-playback-figure]");
const readout = (page: Page) => figure(page).locator('[class$="-readout"]');
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
  await page.keyboard.press("ArrowLeft");
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

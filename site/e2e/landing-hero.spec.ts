/**
 * Browser tests for the hero desk's fuel spotlight on a phone, where the fuels
 * scroll sideways on one row. A fuel picked while the picker is off screen must
 * bring its chip into view in the row without moving the page.
 */
import { expect, type Page, test } from "@playwright/test";
import { HERO_SPOTLIGHTS } from "../src/landing/hero";

const PHONE = { width: 390, height: 844 };

const desk = (page: Page) => page.locator("#desk");
const spotlightGroup = (page: Page) => desk(page).getByRole("group", { name: "Spotlight a fuel" });

/** The chip's left and right edges against the row's visible box, in CSS pixels. */
async function chipInRow(page: Page, name: string) {
  return spotlightGroup(page).evaluate((row, label) => {
    const chip = [...row.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === label,
    );
    if (!chip) throw new Error(`No spotlight chip is named "${label}".`);
    const rowBox = row.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    return {
      scrolls: row.scrollWidth > row.clientWidth,
      inView: chipBox.left >= rowBox.left - 1 && chipBox.right <= rowBox.right + 1,
    };
  }, name);
}

test("picking a fuel while the picker is above the viewport scrolls only the chip row", async ({
  page,
}) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  await expect(spotlightGroup(page)).toBeVisible();
  await expect(desk(page).locator("astro-island[ssr]")).toHaveCount(0);

  const last = HERO_SPOTLIGHTS.at(-1) ?? "";
  const lastChip = spotlightGroup(page).getByRole("button", { name: last, exact: true });
  const before = await chipInRow(page, last);
  expect(before.scrolls, "the fuels overflow their row at 390px").toBe(true);
  expect(before.inView, `${last} starts outside the row's visible box`).toBe(false);

  // Park the picker above the viewport, then press the chip without Playwright's scroll-to-click.
  const pickerBottom = await spotlightGroup(page).evaluate(
    (row) => row.getBoundingClientRect().bottom + window.scrollY,
  );
  await page.evaluate((y) => window.scrollTo(0, y), pickerBottom + PHONE.height);
  const scrollY = await page.evaluate(() => window.scrollY);
  await lastChip.dispatchEvent("click");
  await expect(lastChip).toHaveAttribute("aria-pressed", "true");

  await expect.poll(async () => (await chipInRow(page, last)).inView).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
});

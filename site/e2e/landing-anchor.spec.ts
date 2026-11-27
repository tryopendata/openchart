/**
 * A link straight to a landing section lands on it, although the sections above
 * grow as they hydrate, and the page lets go once the reader scrolls.
 */
import { expect, type Page, test } from "@playwright/test";

const sectionTop = (page: Page, id: string) =>
  page.locator(`#${id}`).evaluate((section) => Math.round(section.getBoundingClientRect().top));

for (const id of ["responsive", "vocabulary", "start"]) {
  test(`a link to #${id} lands with the section at the top of the window`, async ({ page }) => {
    await page.goto(`/#${id}`);
    // The header's height and the section's scroll margin, and no more.
    await expect.poll(() => sectionTop(page, id), { timeout: 15_000 }).toBeLessThanOrEqual(120);
    // Still there once everything the scroll passed has loaded and grown.
    await page.waitForLoadState("networkidle");
    await expect.poll(() => sectionTop(page, id)).toBeLessThanOrEqual(120);
    expect(await sectionTop(page, id)).toBeGreaterThanOrEqual(0);
  });
}

test("once the reader scrolls, the page no longer pulls them back to the section", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "A wheel is the desktop reader's scroll.");
  await page.goto("/#responsive");
  await expect
    .poll(() => sectionTop(page, "responsive"), { timeout: 15_000 })
    .toBeLessThanOrEqual(120);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -2400);
  await expect.poll(() => sectionTop(page, "responsive")).toBeGreaterThan(1500);
  // Islands above hydrate now and change the page's height; the reader stays where they went.
  await page.waitForLoadState("networkidle");
  expect(await sectionTop(page, "responsive")).toBeGreaterThan(1500);
});

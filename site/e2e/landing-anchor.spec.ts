/**
 * A link straight to a landing section lands on it, although the sections above
 * grow as they hydrate, and the page lets go once the reader scrolls (with or
 * without an input event). A reload keeps the reader's own position, and a
 * malformed hash is harmless.
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

/** Lands on `/#id` and waits until the section is at the top of the window. */
async function landOn(page: Page, id: string) {
  await page.goto(`/#${id}`);
  await expect.poll(() => sectionTop(page, id), { timeout: 15_000 }).toBeLessThanOrEqual(120);
}

/** Makes the page taller, as an island hydrating to a bigger box does. */
const growPage = (page: Page) =>
  page.evaluate(() => {
    const filler = document.createElement("div");
    filler.style.height = "240px";
    document.body.append(filler);
  });

test("a scroll with no input event, as a scrollbar drag or a screen reader makes, also lets go", async ({
  page,
}) => {
  await landOn(page, "responsive");
  await page.evaluate(() => window.scrollBy({ top: -2400, behavior: "instant" }));
  await expect.poll(() => sectionTop(page, "responsive")).toBeGreaterThan(1500);
  // A height change after that scroll would have put the section back at the top.
  await growPage(page);
  await page.waitForLoadState("networkidle");
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  expect(await sectionTop(page, "responsive")).toBeGreaterThan(1500);
});

test("a reload keeps the reader where they had scrolled, not on the linked section", async ({
  page,
}) => {
  await landOn(page, "motion");
  await page.locator("#publish").evaluate((section) => {
    section.scrollIntoView({ block: "start", behavior: "instant" });
  });
  await page.waitForLoadState("networkidle");
  const before = await sectionTop(page, "publish");

  await page.reload();
  await page.waitForLoadState("networkidle");
  await growPage(page);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  // The browser restores the offset; islands above may settle it by a little, never back to #motion.
  expect(Math.abs((await sectionTop(page, "publish")) - before)).toBeLessThan(400);
  expect(await sectionTop(page, "motion")).toBeLessThan(-500);
});

test("a hash that is not valid percent-encoding loads the page without a script error", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/#%E0%A4");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});

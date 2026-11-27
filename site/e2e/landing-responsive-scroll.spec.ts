/**
 * The responsive frame narrows with the scroll: at 1440x900 with motion on it
 * is full width as the section arrives, narrower mid-way and compact before it
 * leaves, and it widens again on the way back. The reader's first drag or width
 * key on the handle ends that for the page view. With reduced motion, and under
 * 1024px, the scroll never moves it. Positions are set by where the figure's top
 * sits in the viewport, so the tests do not depend on the sections above.
 */
import { expect, type Page, test } from "@playwright/test";

const VIEWPORT = { width: 1440, height: 900 };
const FOLLOW_HINT =
  "The frame follows your scroll until you drag its right edge or use the arrow keys on it.";
const HANDLE_HINT = "Drag the frame's right edge, or focus it and use the arrow keys.";

/** Where the figure's top sits in the viewport, in px from its top, at each stage of the scroll. */
const ARRIVING = 760;
const MIDWAY = 300;
const LEAVING = -80;

const section = (page: Page) => page.locator("#responsive");
const figure = (page: Page) => section(page).locator(".resize-figure");
const slider = (page: Page) => section(page).getByRole("slider", { name: "Chart width" });
const hint = (page: Page) => section(page).locator("[data-resize-hint]");
const breakpoint = (page: Page) => section(page).locator("[data-resize-breakpoint]");
const numberOf = async (page: Page, attribute: string) =>
  Number(await slider(page).getAttribute(attribute));
const widthNow = (page: Page) => numberOf(page, "aria-valuenow");

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own desktop viewport");
});

/** Resolves after the browser has painted twice, so scroll-driven work has run. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** Scrolls so the figure's top is `top` px down the viewport. */
async function placeFigure(page: Page, top: number) {
  await figure(page).evaluate((element, target) => {
    window.scrollBy({ top: element.getBoundingClientRect().top - target, behavior: "instant" });
  }, top);
  await settle(page);
}

/** Opens the page and waits for the island to hydrate with its slider. */
async function openFrame(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await expect(slider(page)).toBeVisible();
}

/** Opens the page with the scroll driving the frame, parked where the section arrives. */
async function openFollowing(page: Page) {
  await openFrame(page);
  await expect(hint(page)).toHaveText(FOLLOW_HINT);
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(await numberOf(page, "aria-valuemax"));
}

/** Scrolls through every stage and checks the width never leaves `width`. */
async function expectScrollLeaves(page: Page, width: number) {
  for (const top of [ARRIVING, MIDWAY, LEAVING, MIDWAY]) {
    await placeFigure(page, top);
    expect(await widthNow(page), `width with the figure at ${top}px`).toBe(width);
  }
}

test("the frame is full as the section arrives, narrower mid-way and compact before it leaves", async ({
  page,
}) => {
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  const full = await numberOf(page, "aria-valuemax");
  const narrowest = await numberOf(page, "aria-valuemin");
  await expect(breakpoint(page)).toHaveText("full");

  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(full);
  const midway = await widthNow(page);
  expect(midway).toBeGreaterThan(narrowest);
  await expect(section(page).locator("[data-resize-width]")).toHaveText(`${midway} pixels wide`);

  await placeFigure(page, LEAVING);
  await expect.poll(() => widthNow(page)).toBe(narrowest);
  await expect(breakpoint(page)).toHaveText("compact");
  const frameWidth = await section(page)
    .locator("[data-resize-frame]")
    .evaluate((element) => element.getBoundingClientRect().width);
  // The frame's 1px border sits outside the chart's box.
  expect(frameWidth).toBe(narrowest + 2);
});

test("scrolling back up widens the frame again", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  const full = await numberOf(page, "aria-valuemax");
  await placeFigure(page, LEAVING);
  await expect(breakpoint(page)).toHaveText("compact");

  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeGreaterThan(await numberOf(page, "aria-valuemin"));
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(full);
  await expect(breakpoint(page)).toHaveText("full");
});

test("the section below does not move while the frame narrows", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  const nextTop = () =>
    section(page).evaluate(
      (element) => (element.nextElementSibling?.getBoundingClientRect().top ?? 0) + window.scrollY,
    );
  const atFull = await nextTop();
  await placeFigure(page, MIDWAY);
  await expect.poll(() => breakpoint(page).textContent()).toMatch(/full|medium/);
  await placeFigure(page, LEAVING);
  await expect(breakpoint(page)).toHaveText("compact");
  // The compact layout adds a note under the plot; the section reserved room for it.
  await expect(section(page).locator("svg text.oc-footnotes")).toBeAttached();
  expect(await nextTop()).toBe(atFull);
});

test("after a drag on the handle the scroll no longer changes the width", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(await numberOf(page, "aria-valuemax"));
  const before = await widthNow(page);

  const box = await slider(page).boundingBox();
  if (!box) throw new Error("The resize handle has no box: it is not rendered visibly.");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 60, y, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => widthNow(page)).toBe(before - 60);
  await expect(hint(page)).toHaveText(HANDLE_HINT);

  await expectScrollLeaves(page, before - 60);
});

test("after a key press on the handle the scroll no longer changes the width", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  const full = await numberOf(page, "aria-valuemax");
  await slider(page).focus();
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(full);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => widthNow(page)).toBe(full - 20);
  await expect(hint(page)).toHaveText(HANDLE_HINT);

  await expectScrollLeaves(page, full - 20);
});

test("with reduced motion the scroll never changes the width", async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openFrame(page);
  await expect(hint(page)).toHaveText(HANDLE_HINT);
  await expectScrollLeaves(page, await numberOf(page, "aria-valuemax"));
  await expect(breakpoint(page)).toHaveText("full");
});

test("under 1024px the scroll never changes the width", async ({ page }) => {
  // Start wide so the scroll link is live, then narrow the window: it lets go and stays off.
  await page.setViewportSize(VIEWPORT);
  await openFollowing(page);
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(await numberOf(page, "aria-valuemax"));

  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(hint(page)).toHaveText(HANDLE_HINT);
  await expect.poll(() => widthNow(page)).toBe(await numberOf(page, "aria-valuemax"));
  await expectScrollLeaves(page, await numberOf(page, "aria-valuemax"));
});

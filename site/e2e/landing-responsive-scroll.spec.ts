/**
 * The responsive frame narrows with the scroll: at 1440x900 with motion on it
 * is full width as the section arrives, narrower mid-way and compact before it
 * leaves, and it widens again on the way back. The reader's first width key or
 * sideways drag on the handle ends that for the page view; a bare click does
 * not. With reduced motion, under 1024px wide and under 700px tall, the scroll
 * never moves it. Positions are set by where the figure's top sits in the
 * viewport, as a share of its height, so the tests do not depend on the
 * sections above.
 */
import { expect, type Page, test } from "@playwright/test";

const WIDE = { width: 1440, height: 900 };
const FOLLOW_HINT =
  "The frame follows your scroll until you drag its right edge or use the arrow keys on it.";
const HANDLE_HINT = "Drag the frame's right edge, or focus it and use the arrow keys.";

/**
 * Where the figure's top sits, as a share of the viewport's height, at each
 * stage. The link runs from 0.70 (full) to 0.12 (narrowest); the frame holds
 * full until 0.61 and is narrowest from 0.21.
 */
const ARRIVING = 0.8;
const MIDWAY = 0.41;
const LEAVING = 0.1;

const section = (page: Page) => page.locator("#responsive");
const figure = (page: Page) => section(page).locator(".resize-figure");
const slider = (page: Page) => section(page).getByRole("slider", { name: "Chart width" });
const hint = (page: Page) => section(page).locator("[data-resize-hint]");
const breakpoint = (page: Page) => section(page).locator("[data-resize-breakpoint]");
const numberOf = async (page: Page, attribute: string) =>
  Number(await slider(page).getAttribute(attribute));
const widthNow = (page: Page) => numberOf(page, "aria-valuenow");
const fullWidth = (page: Page) => numberOf(page, "aria-valuemax");

test.beforeEach(({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own desktop viewport");
});

/** Resolves after the browser has painted twice, so scroll-driven work has run. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** Scrolls so the figure's top is `share` of the viewport's height down from its top. */
async function placeFigure(page: Page, share: number) {
  await figure(page).evaluate((element, at) => {
    const target = window.innerHeight * at;
    window.scrollBy({ top: element.getBoundingClientRect().top - target, behavior: "instant" });
  }, share);
  await settle(page);
}

/** Opens the page and waits for the island to hydrate and every lazy chunk it asked for to arrive. */
async function openFrame(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await expect(slider(page)).toBeVisible();
  await expect(section(page).locator("[data-resize-frame] svg:not(.demo-static)")).toBeAttached();
  await page.waitForLoadState("networkidle");
}

/** Opens the page with the scroll driving the frame, parked where the section arrives. */
async function openFollowing(page: Page) {
  await openFrame(page);
  await expect(hint(page)).toHaveText(FOLLOW_HINT);
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(await fullWidth(page));
}

/** Scrolls through every stage and checks the width never leaves `width`. */
async function expectScrollLeaves(page: Page, width: number) {
  for (const share of [ARRIVING, MIDWAY, LEAVING, MIDWAY]) {
    await placeFigure(page, share);
    expect(await widthNow(page), `width with the figure's top at ${share} of the viewport`).toBe(
      width,
    );
  }
}

/** Widens the window back over the follow query and checks the scroll takes the frame again. */
async function expectFollowsAgainAt(page: Page) {
  await page.setViewportSize(WIDE);
  await expect(hint(page)).toHaveText(FOLLOW_HINT);
  await placeFigure(page, LEAVING);
  await expect(breakpoint(page)).toHaveText("compact");
}

test("the frame is full as the section arrives, narrower mid-way and compact before it leaves", async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  const full = await fullWidth(page);
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
  // The frame's 1px border sits outside the chart's box.
  await expect
    .poll(() =>
      section(page)
        .locator("[data-resize-frame]")
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(narrowest + 2);
  // The scroll's changes are not read out; only the reader's own are.
  await expect(breakpoint(page)).not.toHaveAttribute("aria-live");
});

test("scrolling back up widens the frame again", async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  const full = await fullWidth(page);
  await placeFigure(page, LEAVING);
  await expect(breakpoint(page)).toHaveText("compact");

  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeGreaterThan(await numberOf(page, "aria-valuemin"));
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(full);
  await expect(breakpoint(page)).toHaveText("full");
});

for (const viewport of [WIDE, { width: 1024, height: 700 }]) {
  test(`at ${viewport.width}x${viewport.height} the section below holds still at every width the scroll gives`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openFollowing(page);
    const nextTop = () =>
      section(page).evaluate(
        (element) =>
          (element.nextElementSibling?.getBoundingClientRect().top ?? 0) + window.scrollY,
      );
    const atFull = await nextTop();
    const seen = new Map<number, number>();
    // The frame's height rises and falls as the chart re-lays out, so every step is checked.
    for (let share = ARRIVING; share >= 0.05; share -= 0.015) {
      await placeFigure(page, share);
      seen.set(await widthNow(page), await nextTop());
    }
    await expect(breakpoint(page)).toHaveText("compact");
    expect(seen.size, "widths the sweep passed through").toBeGreaterThan(20);
    for (const [width, top] of seen) expect(top, `next section's top at ${width}px`).toBe(atFull);
  });
}

test("after a drag on the handle the scroll no longer changes the width", async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(await fullWidth(page));
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
  await expect(breakpoint(page)).toHaveAttribute("aria-live", "polite");

  await expectScrollLeaves(page, before - 60);
});

test("a click on the handle that does not move it leaves the scroll in charge", async ({
  page,
}) => {
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(await fullWidth(page));

  const box = await slider(page).boundingBox();
  if (!box) throw new Error("The resize handle has no box: it is not rendered visibly.");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // A wobble under the drag threshold, as a click or a vertical swipe makes.
  await page.mouse.move(box.x + box.width / 2 + 2, box.y + box.height / 2 + 30);
  await page.mouse.up();
  await expect(hint(page)).toHaveText(FOLLOW_HINT);

  await placeFigure(page, LEAVING);
  await expect(breakpoint(page)).toHaveText("compact");
  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(await fullWidth(page));
});

test("after a key press on the handle the scroll no longer changes the width", async ({ page }) => {
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  const full = await fullWidth(page);
  // Focus alone does not take the handle: the scroll still drives the width.
  await slider(page).focus();
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(full);
  await expect(hint(page)).toHaveText(FOLLOW_HINT);

  await placeFigure(page, ARRIVING);
  await expect.poll(() => widthNow(page)).toBe(full);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => widthNow(page)).toBe(full - 20);
  await expect(hint(page)).toHaveText(HANDLE_HINT);

  await expectScrollLeaves(page, full - 20);
});

test("with reduced motion the scroll never changes the width", async ({ browser }) => {
  // A page with motion allowed shows the link loads in this build at all.
  const control = await browser.newPage({ viewport: WIDE });
  await openFollowing(control);
  await control.close();

  const page = await browser.newPage({ viewport: WIDE, reducedMotion: "reduce" });
  await openFrame(page);
  await expect(hint(page)).toHaveText(HANDLE_HINT);
  await expectScrollLeaves(page, await fullWidth(page));
  await expect(breakpoint(page)).toHaveText("full");
  await page.close();
});

test("under 1024px wide the scroll never changes the width, and widening back hands it to the scroll again", async ({
  page,
}) => {
  // Start wide so the link is live, then narrow the window: it lets go and stays off.
  await page.setViewportSize(WIDE);
  await openFollowing(page);
  await placeFigure(page, MIDWAY);
  await expect.poll(() => widthNow(page)).toBeLessThan(await fullWidth(page));

  await page.setViewportSize({ width: 1000, height: 900 });
  await expect(hint(page)).toHaveText(HANDLE_HINT);
  await expect.poll(() => widthNow(page)).toBe(await fullWidth(page));
  await expectScrollLeaves(page, await fullWidth(page));

  await expectFollowsAgainAt(page);
});

test("under 700px tall the scroll never changes the width, and a taller window hands it to the scroll again", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 650 });
  await openFrame(page);
  await expect(hint(page)).toHaveText(HANDLE_HINT);
  await expectScrollLeaves(page, await fullWidth(page));

  // The same page view picks the link up once the window is tall enough, so it was only the height.
  await expectFollowsAgainAt(page);
});

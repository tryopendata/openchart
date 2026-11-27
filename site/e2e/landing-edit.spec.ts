/**
 * The edit section: a chart in the library's edit mode whose one callout the
 * reader can drag or nudge, the spec line the move writes, and Reset. Every
 * other edit (a delete, a double-click add, a title edit) is refused, so the
 * chart stays as authored. The callout also moves once by itself the first time
 * the figure is seen, unless the reader prefers reduced motion.
 *
 * The tests that handle the chart run with reduced motion, so the
 * self-demonstration never moves the callout under the pointer.
 */
import { expect, type Locator, type Page, test } from "@playwright/test";
import { startOffset } from "../src/components/landing/edit/edit-spec";
import { offsetLine } from "../src/components/landing/edit/edit-state";
import { landingCopy } from "../src/landing/copy";

const START_LINE = offsetLine(startOffset);
/** Longer than the self-demonstration (1.6s), so a second run would show inside it. */
const DEMO_WINDOW_MS = 2500;

const section = (page: Page) => page.locator("#edit");
const figure = (page: Page) => section(page).locator("figure");
const liveChart = (page: Page) => section(page).locator("[data-edit-chart] .oc-chart-root svg");
const callout = (page: Page) => liveChart(page).locator(".oc-annotation-text");
/** The callout's text, the part to grab: the group's box also spans its connector line. */
const calloutLabel = (page: Page) => callout(page).locator(".oc-annotation-label");
const readout = (page: Page) => section(page).locator("[data-edit-readout]");
const resetButton = (page: Page) => section(page).getByRole("button", { name: "Reset" });

/** Scrolls the figure to the middle of the screen and waits for the live chart. */
async function goLive(page: Page) {
  await page.goto("/");
  await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(callout(page)).toBeVisible();
  // A font swap re-renders the chart; let it land before handling the callout.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/** The centre of an element on screen. */
async function centreOf(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error("The element has no box on screen.");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Clicks an element without moving between press and release, which selects it in edit mode. */
async function clickCentre(page: Page, locator: Locator) {
  const { x, y } = await centreOf(locator);
  await page.mouse.click(x, y);
}

async function mouseDrag(page: Page, from: { x: number; y: number }, by: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + by.x, from.y + by.y, { steps: 8 });
  await page.mouse.up();
}

/** The mark `recordReadout` puts in its list at the reader's first press. */
const PRESS = "press";

/**
 * Starts recording every value the readout shows, one sample per frame, so a
 * test can see a move that is over before it looks. The reader's first pointer
 * or key press is recorded too, as `PRESS`, in order with the values.
 */
async function recordReadout(page: Page) {
  await page.evaluate((press) => {
    const seen: string[] = [];
    (window as unknown as { readoutValues: string[] }).readoutValues = seen;
    const sample = () => {
      const text = document.querySelector("#edit [data-edit-readout]")?.textContent ?? "";
      if (text && text !== seen.at(-1)) seen.push(text);
      requestAnimationFrame(sample);
    };
    const markPress = () => {
      if (!seen.includes(press)) seen.push(press);
    };
    window.addEventListener("pointerdown", markPress, true);
    window.addEventListener("keydown", markPress, true);
    sample();
  }, PRESS);
}

/** Resolves on the first frame the readout leaves the starting offset, early in the run. */
const moveStarted = (page: Page) =>
  page.waitForFunction(
    (start) => document.querySelector("#edit [data-edit-readout]")?.textContent !== start,
    START_LINE,
    { polling: "raf" },
  );

const readoutValues = (page: Page) =>
  page.evaluate(() => [...(window as unknown as { readoutValues: string[] }).readoutValues]);

/** How many times the readout left the starting offset. */
const runsIn = (values: string[]) =>
  values.filter((value, index) => value !== START_LINE && values[index - 1] === START_LINE).length;

test.describe("handling the chart", () => {
  test.use({ reducedMotion: "reduce" });

  test("#edit follows #desk with one h2", async ({ page }) => {
    await page.goto("/");
    const ids = await page
      .locator("[data-landing-section]")
      .evaluateAll((sections) => sections.map((element) => element.id));
    expect(ids.slice(0, 2)).toEqual(["desk", "edit"]);
    const headings = section(page).locator("h2");
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText(landingCopy.headings.edit);
  });

  test("the chart shows the callout and the readout its starting offset", async ({ page }) => {
    await goLive(page);
    await expect(callout(page)).toContainText("Peak of 8.5%");
    await expect(readout(page)).toHaveText(START_LINE);
  });

  test("dragging the callout with the mouse moves it and changes the readout", async ({ page }) => {
    await goLive(page);
    const before = await calloutLabel(page).boundingBox();
    await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -40, y: 50 });
    await expect(readout(page)).not.toHaveText(START_LINE);
    const after = await calloutLabel(page).boundingBox();
    expect(after?.y).toBeGreaterThan((before?.y ?? 0) + 30);
  });

  test("selecting the callout and pressing an arrow key nudges it", async ({ page }) => {
    await goLive(page);
    const before = await calloutLabel(page).boundingBox();
    await clickCentre(page, calloutLabel(page));
    for (let press = 0; press < 3; press++) await page.keyboard.press("ArrowDown");
    await expect(readout(page)).toHaveText(new RegExp(`"dy": ${startOffset.dy + 3} `));
    const after = await calloutLabel(page).boundingBox();
    expect(after?.y).toBeCloseTo((before?.y ?? 0) + 3, 0);
  });

  test("Reset is off at the start, on after a move, and restores the offset", async ({ page }) => {
    await goLive(page);
    await expect(resetButton(page)).toBeDisabled();
    await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -40, y: 50 });
    await expect(resetButton(page)).toBeEnabled();
    await resetButton(page).click();
    await expect(readout(page)).toHaveText(START_LINE);
    await expect(resetButton(page)).toBeDisabled();
  });

  test("Delete on the selected callout does not remove it", async ({ page }) => {
    await goLive(page);
    await clickCentre(page, calloutLabel(page));
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await expect(callout(page)).toHaveCount(1);
    await expect(callout(page)).toContainText("Peak of 8.5%");
    await expect(readout(page)).toHaveText(START_LINE);
  });

  test("a double-click on the plot adds no annotation", async ({ page }) => {
    await goLive(page);
    const chart = await liveChart(page).boundingBox();
    if (!chart) throw new Error("The live chart has no box.");
    // Low on the left of the plot: under the 2020 dip's level, clear of the line and the labels.
    await page.mouse.dblclick(chart.x + chart.width * 0.3, chart.y + chart.height * 0.55);
    const editor = section(page).locator("textarea");
    await expect(editor).toBeVisible();
    await editor.fill("A new note");
    await editor.press("Enter");
    await expect(editor).toHaveCount(0);
    await expect(callout(page)).toHaveCount(1);
    await expect(liveChart(page)).not.toContainText("A new note");
  });

  test("the title cannot be edited", async ({ page }) => {
    await goLive(page);
    const title = liveChart(page).locator(".oc-title");
    const original = await title.textContent();
    await title.dblclick();
    const editor = section(page).locator("textarea");
    await expect(editor).toBeVisible();
    await editor.fill("Prices are rising again");
    await editor.press("Enter");
    await expect(editor).toHaveCount(0);
    await expect(title).toHaveText(original ?? "");
    await expect(liveChart(page)).not.toContainText("Prices are rising again");
  });

  test("with reduced motion the callout never moves by itself", async ({ page }) => {
    await goLive(page);
    await recordReadout(page);
    // Nothing to wait on: this checks that no run starts within the demonstration's length.
    await page.waitForTimeout(DEMO_WINDOW_MS);
    expect(await readoutValues(page)).toEqual([START_LINE]);
  });

  test("a touch drag moves the callout", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "touch runs on the mobile project");
    await goLive(page);
    const from = await centreOf(calloutLabel(page));
    const client = await page.context().newCDPSession(page);
    const touch = (
      type: "touchStart" | "touchMove" | "touchEnd",
      points: { x: number; y: number }[],
    ) => client.send("Input.dispatchTouchEvent", { type, touchPoints: points });
    await touch("touchStart", [from]);
    for (let step = 1; step <= 8; step++) {
      await touch("touchMove", [{ x: from.x - step * 5, y: from.y + step * 6 }]);
    }
    await touch("touchEnd", []);
    await expect(readout(page)).not.toHaveText(START_LINE);
    await expect(resetButton(page)).toBeEnabled();
  });
});

test.describe("the self-demonstration", () => {
  test.use({ reducedMotion: "no-preference" });

  test("runs once when the figure is first seen and ends on the starting offset", async ({
    page,
  }) => {
    await page.goto("/");
    await recordReadout(page);
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await expect.poll(async () => runsIn(await readoutValues(page))).toBe(1);
    await expect(readout(page)).toHaveText(START_LINE);
    // Scroll away and back: it does not run again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(DEMO_WINDOW_MS);
    const values = await readoutValues(page);
    expect(runsIn(values)).toBe(1);
    expect(values.at(-1)).toBe(START_LINE);
  });

  for (const press of ["pointer", "key"] as const) {
    test(`stops for good at the first ${press} press inside the figure`, async ({ page }) => {
      await page.goto("/");
      await recordReadout(page);
      await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
      await moveStarted(page);
      if (press === "pointer") {
        const at = await centreOf(readout(page));
        await page.mouse.move(at.x, at.y);
        await page.mouse.down();
        await page.mouse.up();
      } else {
        // Focus alone is not a press; the key that follows is.
        await figure(page).locator("figcaption a").focus();
        await page.keyboard.press("Shift");
      }
      // Nothing to wait on: this checks the rest of the run never plays.
      await page.waitForTimeout(DEMO_WINDOW_MS);
      const values = await readoutValues(page);
      const beforePress = values.slice(0, values.indexOf(PRESS));
      expect(beforePress.at(-1), "the press came while the callout was moving").not.toBe(
        START_LINE,
      );
      expect(values.slice(values.indexOf(PRESS) + 1)).toEqual([START_LINE]);
    });
  }
});

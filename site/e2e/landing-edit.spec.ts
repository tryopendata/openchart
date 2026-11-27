/**
 * The edit section: a chart in the library's edit mode whose one callout the
 * reader can drag or nudge, the spec line the move writes, and Reset. Every
 * other edit (a delete, a double-click add, a title edit) is refused, and the
 * gestures that would start one never open an editor, so the chart stays as
 * authored. The callout also moves once by itself the first time the figure is
 * seen, unless the reader prefers reduced motion.
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
/** The library's text editor, which the section never lets open. */
const editor = (page: Page) => section(page).locator("textarea");

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
    let last = "";
    const record = () => {
      const text = document.querySelector("#edit [data-edit-readout]")?.textContent ?? "";
      if (!text || text === last) return;
      last = text;
      seen.push(text);
    };
    const sample = () => {
      record();
      requestAnimationFrame(sample);
    };
    // The value showing at the press goes in before the mark, even if no frame has sampled it yet.
    const markPress = () => {
      if (seen.includes(press)) return;
      record();
      seen.push(press);
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

  test("Reset hands focus to the callout, selected, so the arrow keys carry on", async ({
    page,
  }) => {
    await goLive(page);
    await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -40, y: 50 });
    await resetButton(page).click();
    await expect(readout(page)).toHaveText(START_LINE);
    await expect(liveChart(page)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(readout(page)).toHaveText(new RegExp(`"dy": ${startOffset.dy + 1} `));
  });

  test("a double-click on the plot opens no editor and adds no annotation", async ({ page }) => {
    await goLive(page);
    const chart = await liveChart(page).boundingBox();
    if (!chart) throw new Error("The live chart has no box.");
    // Low on the left of the plot: under the 2020 dip's level, clear of the line and the labels.
    await page.mouse.dblclick(chart.x + chart.width * 0.3, chart.y + chart.height * 0.55);
    await expect(editor(page)).toHaveCount(0);
    await expect(liveChart(page).locator("[data-annotation-index]")).toHaveCount(2);
  });

  test("a double-click on the title opens no editor", async ({ page }) => {
    await goLive(page);
    await liveChart(page).locator(".oc-title").dblclick();
    await expect(editor(page)).toHaveCount(0);
  });

  test("Enter on the selected callout opens no editor", async ({ page }) => {
    await goLive(page);
    await clickCentre(page, calloutLabel(page));
    await page.keyboard.press("Enter");
    await expect(editor(page)).toHaveCount(0);
    await expect(callout(page)).toContainText("Peak of 8.5%");
  });

  test("only the callout shows an edit outline under the pointer", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "hover needs a mouse");
    await goLive(page);
    const outlineOfHovered = () =>
      liveChart(page)
        .locator(".oc-editable-hover")
        .evaluate((element) => getComputedStyle(element).outlineStyle);
    await liveChart(page).locator(".oc-title").hover();
    expect(await outlineOfHovered()).toBe("none");
    await calloutLabel(page).hover();
    expect(await outlineOfHovered()).not.toBe("none");
  });

  test("the keyboard reaches the callout in one Tab stop and leaves on the next", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "a keyboard journey");
    await goLive(page);
    const stage = section(page).locator("[data-edit-chart]");
    // Arriving on the chart from the keyboard selects the callout, inside the site's focus ring.
    await liveChart(page).focus();
    await expect(stage).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("ArrowDown");
    await expect(readout(page)).toHaveText(new RegExp(`"dy": ${startOffset.dy + 1} `));
    await page.keyboard.press("Tab");
    await expect(liveChart(page)).not.toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(liveChart(page)).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(readout(page)).toHaveText(new RegExp(`"dy": ${startOffset.dy + 2} `));
  });

  test("without its edit rules the chart stays static", async ({ page }) => {
    const ruleLoadFailed = page.waitForEvent("console", (message) =>
      message.text().includes("edit rules could not be loaded"),
    );
    await page.route(/\/edit-state\.[\w-]+\.js$/, (route) => route.abort());
    await page.goto("/");
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await ruleLoadFailed;
    // The chart library loads in parallel; give it the chance to (wrongly) mount.
    await page.waitForLoadState("networkidle");
    await expect(section(page).locator("[data-edit-chart] svg.demo-static:visible")).toHaveCount(1);
    await expect(liveChart(page)).toHaveCount(0);
    await expect(resetButton(page)).toBeHidden();
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

test.describe("the spec beside the chart at 1440x900", () => {
  test.use({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
  test.skip(({ isMobile }) => isMobile, "a desktop layout");

  const specBlock = (page: Page) => section(page).locator(".edit-spec");

  test("the readout is on screen whenever the chart is", async ({ page }) => {
    await goLive(page);
    await liveChart(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    for (const box of [await liveChart(page).boundingBox(), await readout(page).boundingBox()]) {
      expect(box).not.toBeNull();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
    }
    const chart = await liveChart(page).boundingBox();
    const line = await readout(page).boundingBox();
    expect(line?.x, "the readout sits right of the chart").toBeGreaterThan(
      (chart?.x ?? 0) + (chart?.width ?? 0),
    );
  });

  test("the spec block keeps its size while the numbers change", async ({ page }) => {
    await goLive(page);
    await expect(specBlock(page)).toContainText('"type": "text"');
    const before = await specBlock(page).boundingBox();
    // Far left and down: dx goes negative and dy reaches three digits.
    await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -260, y: 110 });
    await expect(readout(page)).toHaveText(/"dx": -\d+, "dy": \d{3} \}/);
    const after = await specBlock(page).boundingBox();
    expect(after?.width).toBe(before?.width);
    expect(after?.height).toBe(before?.height);
  });
});

/**
 * How far the spec column's label sits above the chart's top gridline, in px.
 * The column starts level with the plot, so this is the same for the static
 * chart and the live one at every width.
 */
const columnAbovePlot = (page: Page) =>
  section(page).evaluate((element) => {
    const shown = [...element.querySelectorAll("[data-edit-chart] svg")].find(
      (svg) => svg.getBoundingClientRect().width > 0,
    );
    if (!shown) throw new Error("No chart is showing in the edit section.");
    const gridTops = [...shown.querySelectorAll(".oc-gridline")].map(
      (line) => line.getBoundingClientRect().top,
    );
    const label = element.querySelector(".edit-spec-label");
    if (!label || gridTops.length === 0) throw new Error("No spec label or gridlines to compare.");
    return Math.min(...gridTops) - label.getBoundingClientRect().top;
  });

/** How close counts as level: the static drawing rounds its coordinates, the live chart does not. */
const ALIGNED_PX = 3;

test.describe("the spec column beside the plot", () => {
  test.use({ reducedMotion: "reduce" });
  test.skip(({ isMobile }) => isMobile, "a desktop layout");

  for (const width of [1024, 1280, 1440]) {
    test(`starts level with the plot at ${width}px, static and live`, async ({ browser }) => {
      const viewport = { width, height: 900 };
      const staticPage = await (
        await browser.newContext({ viewport, javaScriptEnabled: false })
      ).newPage();
      await staticPage.goto("/");
      const staticGap = await columnAbovePlot(staticPage);
      await staticPage.context().close();

      const livePage = await (await browser.newContext({ viewport })).newPage();
      await goLive(livePage);
      await expect
        .poll(async () => Math.abs((await columnAbovePlot(livePage)) - staticGap))
        .toBeLessThan(ALIGNED_PX);
      await livePage.context().close();
    });
  }

  test("follows the plot when the window narrows", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await goLive(page);
    const gap = await columnAbovePlot(page);
    // At 1100 the live headline wraps to two lines and the plot starts lower than at 1440.
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect
      .poll(async () => Math.abs((await columnAbovePlot(page)) - gap))
      .toBeLessThan(ALIGNED_PX);
  });
});

test("Reset and the how-to wait for the live chart without moving anything when they appear", async ({
  browser,
}, testInfo) => {
  const viewport = testInfo.project.use.viewport ?? { width: 1280, height: 800 };
  const readoutBox = (page: Page) => section(page).locator(".edit-readout").boundingBox();
  const howTo = (page: Page) => section(page).locator(".edit-how-to");

  const staticPage = await (
    await browser.newContext({ viewport, javaScriptEnabled: false })
  ).newPage();
  await staticPage.goto("/");
  await expect(section(staticPage).locator(".edit-reset")).toBeHidden();
  await expect(howTo(staticPage)).toBeHidden();
  const before = await readoutBox(staticPage);
  await staticPage.context().close();

  const livePage = await (
    await browser.newContext({ viewport, reducedMotion: "reduce" })
  ).newPage();
  await goLive(livePage);
  await expect(resetButton(livePage)).toBeVisible();
  await expect(howTo(livePage)).toBeVisible();
  const after = await readoutBox(livePage);
  expect(after?.height).toBe(before?.height);
  await livePage.context().close();
});

test.describe("the spec line on a small phone", () => {
  test.use({ reducedMotion: "reduce" });
  test.skip(({ isMobile }) => isMobile, "sets its own small viewport");

  for (const width of [320, 360]) {
    test(`fits ${width}px, before and after a move to a negative three-digit offset`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await goLive(page);
      const fits = () =>
        section(page).evaluate((element) =>
          [".edit-spec", "[data-edit-readout]"].every((selector) => {
            const box = element.querySelector(selector);
            return box !== null && box.scrollWidth <= box.clientWidth;
          }),
        );
      expect(await fits()).toBe(true);
      await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -240, y: 110 });
      await expect(readout(page)).toHaveText(/"dx": -\d{3}, "dy": \d{3} \}/);
      expect(await fits()).toBe(true);
    });
  }
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
      // The callout stays where the press found it.
      expect(values.slice(values.indexOf(PRESS) + 1)).toEqual([]);
    });
  }

  test("a grab of the callout mid-run drags it on from where it is", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "a mouse drag");
    await page.goto("/");
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    // The run's pause at its far point, far from where the spec puts the callout: still long
    // enough for the press to find the label where it was measured.
    await page.waitForFunction(
      (far) => document.querySelector("#edit [data-edit-readout]")?.textContent === far,
      offsetLine(DEMO_FAR_POINT),
      { polling: "raf" },
    );
    // Read in one step: each frame of the run redraws the chart, so a located element goes stale.
    const from = await section(page).evaluate((element) => {
      const label = element.querySelector(".oc-annotation-text .oc-annotation-label");
      if (!label) throw new Error("The callout's label is not in the chart.");
      const box = label.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const grabbed = offsetIn(await readout(page).textContent());
    await page.mouse.move(from.x - 30, from.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => offsetIn(await readout(page).textContent())).not.toEqual(grabbed);
    const dropped = offsetIn(await readout(page).textContent());
    expect(Math.abs(dropped.dx - (grabbed.dx - 30))).toBeLessThanOrEqual(3);
    expect(Math.abs(dropped.dy - (grabbed.dy + 40))).toBeLessThanOrEqual(3);
  });

  test("a touch that scrolls past the chart leaves the run playing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "touch runs on the mobile project");
    await page.goto("/");
    await recordReadout(page);
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await moveStarted(page);
    const chart = await liveChart(page).boundingBox();
    if (!chart) throw new Error("The live chart has no box.");
    // Low on the left of the plot, clear of the callout: a swipe up that scrolls the page.
    const from = { x: chart.x + chart.width * 0.3, y: chart.y + chart.height * 0.7 };
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let step = 1; step <= 8; step++) {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: from.x, y: from.y - step * 15 }],
      });
    }
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => runsIn(await readoutValues(page))).toBe(1);
    await expect(readout(page)).toHaveText(START_LINE);
    expect(await readoutValues(page), "the run reached its far point").toContain(
      offsetLine(DEMO_FAR_POINT),
    );
  });

  test("turning on reduced motion mid-run puts the callout back and leaves it free", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "a mouse drag");
    await page.goto("/");
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await moveStarted(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(readout(page)).toHaveText(START_LINE);
    await mouseDrag(page, await centreOf(calloutLabel(page)), { x: -40, y: 50 });
    await expect(readout(page)).not.toHaveText(START_LINE);
    await expect(resetButton(page)).toBeEnabled();
  });

  test("the offset line is announced only once the callout stops moving by itself", async ({
    page,
  }) => {
    await page.goto("/");
    await recordReadout(page);
    await figure(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
    await moveStarted(page);
    await expect(readout(page)).toHaveAttribute("aria-live", "off");
    await expect.poll(async () => runsIn(await readoutValues(page))).toBe(1);
    await expect(readout(page)).toHaveText(START_LINE);
    await expect(readout(page)).toHaveAttribute("aria-live", "polite");
  });
});

/** Where the self-demonstration takes the callout before bringing it back (EditDesk's DEMO_OFFSET). */
const DEMO_FAR_POINT = { dx: 150, dy: 84 };

/** The offset a readout line shows. */
function offsetIn(line: string | null): { dx: number; dy: number } {
  const match = /"dx": (-?\d+), "dy": (-?\d+)/.exec(line ?? "");
  if (!match) throw new Error(`The readout shows no offset: ${line}`);
  return { dx: Number(match[1]), dy: Number(match[2]) };
}

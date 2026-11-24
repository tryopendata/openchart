import { expect, type Page, test } from "@playwright/test";
import { catalogPages } from "../tests/catalog-pages";
import { pageViolations } from "./axe";

// The first page of each section stands in for the section.
const pages = Object.entries(catalogPages).map(
  ([section, slugs]) => `/docs/${section}/${slugs[0]}/`,
);

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

for (const path of pages) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${path} in ${scheme} passes axe and mounts its first demo`, async ({ page }) => {
      const errors = collectErrors(page);
      // Under reduced motion nothing animates and every static chart shows, so axe
      // checks each demo finished, not mid-entrance or hidden until it is seen.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      const stage = page.locator("[data-demo-stage]").first();
      await stage.scrollIntoViewIfNeeded();
      await expect(stage).toHaveAttribute("data-demo-live", "");
      expect(await pageViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

const RACE = "/docs/change-over-time/race/";
const RACE_SUFFIXES = ["", "-line", "-table", "-loop", "-fixed"];
const raceDemo = (page: Page, suffix = "") =>
  page.locator(`[data-demo="change-over-time/race${suffix}"]`);

test("the GDP race waits for the viewport, then keeps its playhead across mark swaps", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "light" });
  await page.setViewportSize({ width: page.viewportSize()?.width ?? 1280, height: 350 });
  await page.goto(RACE);
  const demo = raceDemo(page);
  const stage = demo.locator("[data-demo-stage]");
  await stage.evaluate((element) => {
    window.scrollBy({
      top: element.getBoundingClientRect().top - window.innerHeight - 80,
      behavior: "instant",
    });
  });
  const slider = demo.getByRole("slider", { name: "Time" });
  await expect(slider).toHaveValue("0");
  await expect(demo.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  const toggle = page.locator("[data-theme-toggle]");
  // Change the theme without scrolling the pending player into view.
  await toggle.dispatchEvent("click");
  await expect(demo.locator(".oc-race-root.oc-dark")).toBeAttached();
  await expect(slider).toHaveValue("0");
  await stage.scrollIntoViewIfNeeded();
  await expect(demo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect(slider).not.toHaveValue("0");
  await demo.getByRole("button", { name: "Pause", exact: true }).click();
  await slider.fill("18.5");
  await expect(slider).toHaveAttribute("aria-valuetext", "1998");
  await demo.getByRole("button", { name: "Line", exact: true }).click();
  await expect(demo.locator(".oc-race-root .oc-race-line path[data-key]").first()).toBeVisible();
  await expect(slider).toHaveValue("18.5");
  await demo.getByRole("button", { name: "Table", exact: true }).click();
  await expect(demo.locator(".oc-race-table-grid")).toBeVisible();
  await expect(slider).toHaveValue("18.5");
  await demo.getByRole("button", { name: "Bar", exact: true }).click();
  await expect(demo.locator(".oc-race-root .oc-race-rows rect").first()).toBeVisible();
  await expect(slider).toHaveValue("18.5");
  await slider.press("ArrowRight");
  await expect(slider).toHaveValue("19");
  await slider.press("Space");
  await expect(demo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await demo.getByRole("button", { name: "Line", exact: true }).click();
  await expect(demo.locator(".oc-race-root .oc-race-line")).toBeVisible();
  await expect(demo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(19);
  const beforeTheme = Number(await slider.inputValue());
  await toggle.click();
  await expect(demo.locator(".oc-race-root.oc-dark")).toHaveCount(0);
  await expect(demo.locator(".oc-race-root .oc-race-line")).toBeVisible();
  await expect(demo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(beforeTheme);
  expect(errors).toEqual([]);
});

test("the top-five race loops after the final period and the fixed race keeps its scale", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(RACE);
  const loop = raceDemo(page, "-loop");
  await loop.locator("[data-demo-stage]").scrollIntoViewIfNeeded();
  const loopSlider = loop.getByRole("slider", { name: "Time" });
  await expect(loop.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  const holdStarted = await page.evaluate(() => performance.now());
  await loopSlider.fill("44");
  await expect(loopSlider).toHaveAttribute("aria-valuetext", "2024");
  await expect(loop.locator(".oc-race-rows rect:visible")).toHaveCount(5);
  await expect(loopSlider).toHaveAttribute("aria-valuetext", "1980", { timeout: 5_000 });
  expect((await page.evaluate(() => performance.now())) - holdStarted).toBeGreaterThan(1_000);

  const fixed = raceDemo(page, "-fixed");
  await fixed.locator("[data-demo-stage]").scrollIntoViewIfNeeded();
  await fixed.getByRole("button", { name: "Pause", exact: true }).click();
  const slider = fixed.getByRole("slider", { name: "Time" });
  const usBar = fixed.locator('.oc-race-root .oc-race-rows [data-key="United States"] rect');
  await slider.fill("44");
  await expect(slider).toHaveAttribute("aria-valuetext", "2024");
  const finalWidth = Number(await usBar.getAttribute("width"));
  const ticks = fixed.locator(".oc-race-root .oc-race-axis text");
  const final = await ticks.allTextContents();
  expect(final.length).toBeGreaterThan(1);
  await slider.fill("0");
  await expect(slider).toHaveAttribute("aria-valuetext", "1980");
  await expect(ticks).toHaveText(final);
  const firstWidth = Number(await usBar.getAttribute("width"));
  expect(firstWidth / finalWidth).toBeCloseTo(2857 / 28751, 2);
});

test("every standalone race starts on sight with a dark page at load", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference", colorScheme: "dark" });
  await page.goto(RACE);
  for (const suffix of RACE_SUFFIXES) {
    const demo = raceDemo(page, suffix);
    await demo.locator("[data-demo-stage]").scrollIntoViewIfNeeded();
    await expect(demo.locator(".oc-race-root.oc-dark")).toBeVisible();
    await expect(demo.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await expect(demo.getByRole("slider", { name: "Time" })).not.toHaveValue("0");
  }
});

test.describe("the race page without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  for (const colorScheme of ["light", "dark"] as const) {
    test(`shows every final frame in ${colorScheme}`, async ({ page }, testInfo) => {
      if (testInfo.project.name === "mobile")
        await page.setViewportSize({ width: 360, height: 800 });
      await page.emulateMedia({ colorScheme });
      await page.goto(RACE);
      for (const suffix of RACE_SUFFIXES) {
        const demo = raceDemo(page, suffix);
        const frame = demo.getByRole("img", { name: /\(2024\)$/ });
        await expect(frame).toHaveAttribute("data-theme", colorScheme);
        await expect(frame.getByText("2024", { exact: true }).first()).toBeVisible();
        await expect(demo.getByRole("slider", { name: "Time" })).toHaveCount(0);
      }
    });
  }
});

test("all race demos open on the final frame with reduced motion and follow the page theme", async ({
  page,
}, testInfo) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(RACE);
  const roots = page.locator(".oc-race-root");
  for (const suffix of RACE_SUFFIXES) {
    const demo = raceDemo(page, suffix);
    await demo.locator("[data-demo-stage]").scrollIntoViewIfNeeded();
    const slider = demo.getByRole("slider", { name: "Time" });
    await expect(slider).toHaveValue("44");
    await expect(slider).toHaveAttribute("aria-valuetext", "2024");
    await expect(demo.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  }
  const barStage = raceDemo(page).locator("[data-demo-stage]");
  const rowPositions = await barStage.evaluate((stage) => {
    const snapshot = [
      ...stage.querySelectorAll<SVGSVGElement>('svg.demo-static[data-theme="light"]'),
    ].find((svg) => getComputedStyle(svg.parentElement ?? stage).display !== "none");
    if (!snapshot) throw new Error("Expected a light race snapshot at the current size.");
    const top = stage.getBoundingClientRect().top;
    const rows = (rects: Iterable<SVGRectElement>) =>
      [...rects].map((rect) => rect.getBoundingClientRect().top - top);
    snapshot.style.setProperty("display", "block", "important");
    try {
      return {
        snapshot: rows(snapshot.querySelectorAll(".oc-race-rows rect")),
        live: rows(stage.querySelectorAll(".oc-race-root .oc-race-rows rect")),
      };
    } finally {
      snapshot.style.removeProperty("display");
    }
  });
  expect(rowPositions.snapshot).toHaveLength(10);
  expect(rowPositions.live).toHaveLength(10);
  for (const [index, y] of rowPositions.snapshot.entries()) {
    expect(rowPositions.live[index]).toBeCloseTo(y, 1);
  }
  if (testInfo.project.name === "mobile") {
    const table = raceDemo(page, "-table");
    const line = raceDemo(page, "-line").locator(".oc-race-root");
    for (const name of ["United States", "United Kingdom"]) {
      const cell = table.locator("tbody .oc-race-table-name").getByText(name, { exact: true });
      await expect(cell).toBeVisible();
      expect(await cell.evaluate((text) => text.scrollWidth <= text.clientWidth)).toBe(true);
      await expect(
        line.locator(".oc-race-line-labels").getByText(name, { exact: true }),
      ).toBeVisible();
    }
    await expect(table.locator('th[aria-label="Change"]')).toHaveText("↕");
  }
  const values = raceDemo(page, "-table").locator("tbody .oc-race-table-value");
  await expect(values).toHaveCount(10);
  await expect(values.first()).toHaveText("$28.8T");
  await expect
    .poll(() =>
      values.evaluateAll(
        (cells) => cells.filter((cell) => cell.scrollWidth > cell.clientWidth).length,
      ),
    )
    .toBe(0);
  await expect(roots).toHaveCount(5);
  await expect(page.locator(".oc-race-root.oc-dark")).toHaveCount(0);
  const ink = () =>
    roots.evaluateAll((elements) =>
      elements.map((el) => getComputedStyle(el).getPropertyValue("--oc-text")),
    );
  const lightInk = await ink();
  const bar = raceDemo(page);
  const scrubber = bar.getByRole("slider", { name: "Time" });
  await scrubber.fill("18");
  await bar.getByRole("button", { name: "Line", exact: true }).click();
  await page.locator("[data-theme-toggle]").click();
  await expect(page.locator(".oc-race-root.oc-dark")).toHaveCount(5);
  expect((await ink()).every((color, i) => color && color !== lightInk[i])).toBe(true);
  await expect(bar.locator(".oc-race-root .oc-race-line")).toBeVisible();
  await expect(scrubber).toHaveValue("18");
  await expect(bar.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await pageViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("race values match measured figures and fit right through playback", async ({
  page,
}, testInfo) => {
  const width = testInfo.project.name === "mobile" ? 360 : 1280;
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(RACE);
  const demo = raceDemo(page);
  await demo.locator("[data-demo-stage]").scrollIntoViewIfNeeded();
  const slider = demo.getByRole("slider", { name: "Time" });
  await expect(slider).toHaveValue("44");
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  const result = await slider.evaluate((input: HTMLInputElement) => {
    const svg = input.closest(".oc-race-root")?.querySelector("svg.oc-race");
    const canvas = document.createElement("canvas").getContext("2d");
    if (!svg || !canvas) throw new Error("Expected a race SVG and a text measurer.");
    const clip = svg.querySelector(".oc-race-mark clipPath rect");
    if (!clip) throw new Error("Expected the bar clipping rectangle.");
    const edge = Number(clip.getAttribute("x")) + Number(clip.getAttribute("width"));
    let samples = 0;
    let maxWidthDifference = 0;
    let maxOverrun = 0;

    for (let tick = 0; tick <= Number(input.max) * 4; tick++) {
      input.value = String(tick / 4);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      for (const label of svg.querySelectorAll<SVGTextElement>(
        '.oc-race-rows [data-key]:not([display="none"]) text:last-child',
      )) {
        const style = getComputedStyle(label);
        canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const measured = canvas.measureText(label.textContent ?? "").width;
        const { x, width } = label.getBBox();
        maxWidthDifference = Math.max(
          maxWidthDifference,
          Math.abs(label.getComputedTextLength() - measured),
        );
        maxOverrun = Math.max(maxOverrun, x + width - edge);
        samples++;
      }
    }
    return { samples, maxWidthDifference, maxOverrun };
  });
  expect(result.samples).toBeGreaterThan(1500);
  expect(result.maxWidthDifference).toBeLessThan(0.5);
  expect(result.maxOverrun).toBeLessThan(0.1);
});

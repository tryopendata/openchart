/** The publish section: the chart at article width, what a screen reader reads, and the exports. */
import { expect, type Page, type Route, test } from "@playwright/test";

const section = (page: Page) => page.locator("#publish");
const exportGroup = (page: Page) => section(page).getByRole("group", { name: "Export this chart" });
const exportButton = (page: Page, format: string) =>
  exportGroup(page).getByRole("button", { name: format, exact: true });
const status = (page: Page) => section(page).getByRole("status");
const gifImage = (page: Page) => section(page).locator("img[data-publish-gif]");
const backButton = (page: Page) =>
  section(page).getByRole("button", { name: "Back to the live chart" });
const figureHeight = async (page: Page) =>
  (await section(page).locator(".pub-figure").boundingBox())?.height;

/** The chart library's bundle: the lazily loaded chunk every live chart waits on. */
const LIBRARY_CHUNK = /\/_astro\/chunk-[^/]+\.js$/;
/** The GIF exporter's lazily loaded chunk. */
const GIF_CHUNK = /\/_astro\/export-gif\.[^/]+\.js$/;

const DOWNLOAD_STARTED = (extension: string) =>
  new RegExp(
    `^Download started: openchart-wind-solar-coal\\.${extension} \\([\\d.]+ (B|KB|MB)\\)$`,
  );
const GIF_READY =
  /^GIF ready in place of the chart \([\d.]+ (B|KB|MB)\)\. Download it or go back below\.$/;

async function live(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await expect(exportButton(page, "SVG")).toBeEnabled();
}

/** Clicks GIF and waits for the GIF to show in place. */
async function renderGif(page: Page) {
  await exportButton(page, "GIF").click();
  await expect(gifImage(page)).toBeVisible({ timeout: 60_000 });
  await expect(status(page)).toHaveText(GIF_READY);
}

test("the chart sits in an article column with copy around it and the screen reader panel", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "sets its own viewport");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  const chart = await section(page).locator("[data-publish-chart]").boundingBox();
  expect(chart?.width).toBeLessThanOrEqual(680);
  const order = await section(page).evaluate((element) => {
    const chartElement = element.querySelector("[data-publish-chart]");
    const paragraphs = [...element.querySelectorAll("[data-publish-article] > p")];
    if (!chartElement) return [];
    return paragraphs.map((paragraph) =>
      paragraph.compareDocumentPosition(chartElement) & Node.DOCUMENT_POSITION_FOLLOWING
        ? "before"
        : "after",
    );
  });
  expect(order).toContain("before");
  expect(order).toContain("after");
  const panel = section(page).locator("[data-publish-screen-reader]");
  await expect(panel.locator("[data-publish-alt]")).not.toBeEmpty();
  await expect(panel.getByRole("table")).toBeVisible();
});

for (const format of ["SVG", "PNG", "CSV"] as const) {
  test(`${format} downloads a file and reports its size`, async ({ page }) => {
    await live(page);
    const download = page.waitForEvent("download");
    await exportButton(page, format).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    await expect(status(page)).toHaveText(DOWNLOAD_STARTED(format.toLowerCase()));
  });
}

test("GIF renders in place with a download link and does not download by itself", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await live(page);
  let downloads = 0;
  page.on("download", () => {
    downloads += 1;
  });
  await exportButton(page, "GIF").click();
  await expect(status(page)).toHaveText("Rendering GIF…");
  await expect(gifImage(page)).toBeVisible({ timeout: 60_000 });
  await expect(gifImage(page)).toHaveAttribute("src", /^blob:/);
  await expect(gifImage(page)).toHaveAttribute("alt", /^Animated GIF export: Line chart/);
  await expect(status(page)).toHaveText(GIF_READY);
  await expect(section(page).getByRole("link", { name: "Download GIF" })).toHaveAttribute(
    "download",
    /\.gif$/,
  );
  expect(downloads).toBe(0);
  await backButton(page).click();
  await expect(gifImage(page)).toHaveCount(0);
});

test("the export buttons are disabled until the chart is live", async ({ page }) => {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(LIBRARY_CHUNK, async (route: Route) => {
    await released;
    await route.continue();
  });
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  for (const format of ["SVG", "PNG", "CSV", "GIF"]) {
    await expect(exportButton(page, format)).toBeDisabled();
  }
  release();
  await expect(exportButton(page, "SVG")).toBeEnabled();
});

test("a GIF whose encoder chunk does not download reports the failure and leaves the buttons usable", async ({
  page,
}) => {
  await page.route(GIF_CHUNK, (route) => route.abort());
  await live(page);
  await exportButton(page, "GIF").click();
  await expect(status(page)).toHaveText(
    "GIF export failed: the encoder did not download. Reload the page and try again.",
  );
  await expect(gifImage(page)).toHaveCount(0);
  const download = page.waitForEvent("download");
  await exportButton(page, "SVG").click();
  expect((await download).suggestedFilename()).toMatch(/\.svg$/);
  await expect(status(page)).toHaveText(DOWNLOAD_STARTED("svg"));
});

test("Back is disabled while a GIF renders, and no GIF comes back after it", async ({ page }) => {
  test.setTimeout(120_000);
  await live(page);
  await renderGif(page);
  await exportButton(page, "GIF").click();
  await expect(status(page)).toHaveText("Rendering GIF…");
  await expect(backButton(page)).toBeDisabled();
  await expect(status(page)).toHaveText(GIF_READY, { timeout: 60_000 });
  await backButton(page).click();
  await expect(gifImage(page)).toHaveCount(0);
  await expect(status(page)).toHaveText("");
  await expect(gifImage(page)).toHaveCount(0);
});

test("focus returns to the GIF button after Back, and stays on a button pressed from the keyboard", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await live(page);
  await renderGif(page);
  await backButton(page).click();
  await expect(exportButton(page, "GIF")).toBeFocused();

  // PNG rasterizes, so the export runs long enough for a disabled button to drop focus.
  const download = page.waitForEvent("download");
  await exportButton(page, "PNG").focus();
  await page.keyboard.press("Enter");
  await expect(exportButton(page, "PNG")).toBeFocused();
  await download;
  await expect(status(page)).toHaveText(DOWNLOAD_STARTED("png"));
  await expect(exportButton(page, "PNG")).toBeFocused();
});

test("the figure keeps its height before, during and after a GIF", async ({ page }) => {
  test.setTimeout(90_000);
  await live(page);
  const before = await figureHeight(page);
  await renderGif(page);
  expect(await figureHeight(page)).toBe(before);
  await backButton(page).click();
  await expect(gifImage(page)).toHaveCount(0);
  expect(await figureHeight(page)).toBe(before);
});

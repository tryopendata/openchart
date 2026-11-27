/** The publish section: the chart at article width, what a screen reader reads, and the exports. */
import { expect, type Page, test } from "@playwright/test";

const section = (page: Page) => page.locator("#publish");
const exportGroup = (page: Page) => section(page).getByRole("group", { name: "Export this chart" });
const status = (page: Page) => section(page).getByRole("status");

async function live(page: Page) {
  await page.goto("/");
  await section(page).scrollIntoViewIfNeeded();
  await expect(section(page).locator("astro-island[ssr]")).toHaveCount(0);
  await expect(exportGroup(page).getByRole("button", { name: "SVG" })).toBeEnabled();
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
    await exportGroup(page).getByRole("button", { name: format, exact: true }).click();
    expect((await download).suggestedFilename()).toMatch(new RegExp(`\\.${format.toLowerCase()}$`));
    await expect(status(page)).toHaveText(new RegExp(`^${format}, [\\d.]+ (B|KB|MB)$`));
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
  await exportGroup(page).getByRole("button", { name: "GIF", exact: true }).click();
  await expect(status(page)).toHaveText("Rendering GIF…");
  const gif = section(page).locator("img[data-publish-gif]");
  await expect(gif).toBeVisible({ timeout: 60_000 });
  await expect(gif).toHaveAttribute("src", /^blob:/);
  await expect(gif).toHaveAttribute("alt", /.+/);
  await expect(status(page)).toHaveText(/^GIF, [\d.]+ (B|KB|MB)$/);
  await expect(section(page).getByRole("link", { name: "Download GIF" })).toHaveAttribute(
    "download",
    /\.gif$/,
  );
  expect(downloads).toBe(0);
  await section(page).getByRole("button", { name: "Back to the live chart" }).click();
  await expect(gif).toHaveCount(0);
});

test("the export buttons are disabled until the chart is live", async ({ page }) => {
  await page.route("**/*.js", (route) => route.abort());
  await page.goto("/");
  for (const format of ["SVG", "PNG", "CSV", "GIF"]) {
    await expect(
      exportGroup(page).getByRole("button", { name: format, exact: true }),
    ).toBeDisabled();
  }
});

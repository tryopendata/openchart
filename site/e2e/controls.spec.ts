import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

/**
 * Reader controls on live demos in a real browser: state buttons, Replay, the
 * event log, edit mode, downloads and the no-JavaScript fallback, on the
 * controls fixture page and the motion page.
 */
const FIXTURE = "/fixtures/controls/";

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const demo = (page: Page, id: string) => page.locator(`.demo[data-demo="${id}"]`);
const liveChart = (page: Page, id: string) => demo(page, id).locator(".demo-live svg.oc-chart");

/** Scrolls the demo into view and waits for its live chart. */
async function goLive(page: Page, id: string) {
  const stage = demo(page, id).locator("[data-demo-stage]");
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-demo-live", "");
}

for (const motion of ["no-preference", "reduce"] as const) {
  test(`choosing a state moves the chart to it, with motion ${motion} @controls`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto(FIXTURE);
    await goLive(page, "fixtures/states");
    const before = await liveChart(page, "fixtures/states").getAttribute("aria-label");
    const second = demo(page, "fixtures/states").getByRole("button", { name: "2019 to 2021" });
    await second.click();
    await expect(second).toHaveAttribute("aria-pressed", "true");
    await expect(
      demo(page, "fixtures/states").getByRole("button", { name: "2019 to 2024" }),
    ).toHaveAttribute("aria-pressed", "false");
    await expect(liveChart(page, "fixtures/states")).not.toHaveAttribute(
      "aria-label",
      before ?? "",
    );
    expect(errors).toEqual([]);
  });
}

test("the chosen state survives a switch of the site theme @controls", async ({ page }) => {
  await page.goto(FIXTURE);
  await goLive(page, "fixtures/states");
  await demo(page, "fixtures/states").getByRole("button", { name: "2019 to 2021" }).click();
  const chosen = await liveChart(page, "fixtures/states").getAttribute("aria-label");
  const themeBefore = await liveChart(page, "fixtures/states").getAttribute("data-theme");
  await page.locator("[data-theme-toggle]").click();
  await expect(liveChart(page, "fixtures/states")).not.toHaveAttribute(
    "data-theme",
    themeBefore ?? "",
  );
  await expect(liveChart(page, "fixtures/states")).toHaveAttribute("aria-label", chosen ?? "");
  await expect(
    demo(page, "fixtures/states").getByRole("button", { name: "2019 to 2021" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("Replay keeps the stage live with no console error @controls", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/docs/behavior/motion/");
  const replayDemo = page.locator(".demo:has([data-demo-replay])").first();
  const stage = replayDemo.locator("[data-demo-stage]");
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-demo-live", "");
  await replayDemo.getByRole("button", { name: "Replay" }).click();
  await expect(stage).toHaveAttribute("data-demo-live", "");
  await expect(replayDemo.locator(".demo-live")).toHaveCount(1);
  await expect(replayDemo.locator(".demo-live svg.oc-chart")).toBeVisible();
  expect(errors).toEqual([]);
});

test("clicking a bar adds an event log entry naming the click @controls", async ({ page }) => {
  await page.goto(FIXTURE);
  await goLive(page, "fixtures/events");
  const log = demo(page, "fixtures/events").locator("[data-demo-events]");
  await expect(log).toBeVisible();
  await demo(page, "fixtures/events").locator(".demo-live [data-mark-id]").first().click();
  await expect(log.locator("li")).toHaveCount(1);
  await expect(log.locator("li").first()).toHaveText(/^onMarkClick: country \S/);
});

test("in edit mode, Tab to the annotation and ArrowRight logs an edit @controls", async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto(FIXTURE);
  await goLive(page, "fixtures/edit");
  const edit = demo(page, "fixtures/edit");
  await expect(edit.locator(".demo-live .oc-annotation")).toBeVisible();
  const log = edit.locator("[data-demo-events] li");
  // In edit mode the chart keeps focus and Tab moves the selection through its
  // editable elements, each reported through onSelect into the log.
  // Start on the last control of the demo before, so the next Tab enters the chart.
  await demo(page, "fixtures/events").getByRole("button", { name: "Copy" }).focus();
  for (let press = 0; press < 8; press += 1) {
    await page.keyboard.press("Tab");
    const [newest] = await log.allTextContents();
    if (newest === "onSelect: /annotations/0") break;
  }
  await expect(log.first()).toHaveText("onSelect: /annotations/0");
  await page.keyboard.press("ArrowRight");
  await expect(log.filter({ hasText: /^onEdit: / })).toHaveCount(1);
  await expect(edit.locator("[data-demo-controls-status]")).toHaveText("Edit applied.");
  await expect(edit.locator(".demo-live .oc-annotation").first()).toContainText("Peak: 8.5%");
  expect(errors).toEqual([]);
});

test("Download SVG and Download CSV save the live chart's files @controls", async ({ page }) => {
  await page.goto(FIXTURE);
  await goLive(page, "fixtures/export");
  const exportDemo = demo(page, "fixtures/export");

  const svgDownload = page.waitForEvent("download");
  await exportDemo.getByRole("button", { name: "Download SVG" }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toBe("fixtures-export.svg");
  expect(await readFile(await svg.path(), "utf8")).toMatch(/^<svg/);

  const csvDownload = page.waitForEvent("download");
  await exportDemo.getByRole("button", { name: "Download CSV" }).click();
  const csv = await csvDownload;
  expect(csv.suggestedFilename()).toBe("fixtures-export.csv");
  const [header, ...rows] = (await readFile(await csv.path(), "utf8")).trim().split("\n");
  expect(header).toBe("country,population");
  expect(rows).toHaveLength(10);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("no demo control shows, the event log is hidden and the static chart shows @controls", async ({
    page,
  }) => {
    await page.goto(FIXTURE);
    const demos = page.locator(".demo");
    expect(await demos.count()).toBeGreaterThan(0);
    await expect(demos.locator("button:visible")).toHaveCount(0);
    for (const id of ["fixtures/events", "fixtures/edit"]) {
      await expect(demo(page, id).locator("[data-demo-events]")).toBeHidden();
    }
    for (const id of ["fixtures/states", "fixtures/export"]) {
      await expect(demo(page, id).locator("svg.demo-static:visible")).toHaveCount(1);
    }
  });
});

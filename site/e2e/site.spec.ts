import { expect, type Page, test } from "@playwright/test";
import { site } from "../src/config";
import { pageViolations } from "./axe";

const BAR = "/docs/comparison/bar/";
const GUIDE = "/docs/get-started/getting-started/";
const [firstInstall, secondInstall] = site.install;

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const firstStage = (page: Page) => page.locator("[data-demo-stage]").first();

/** Scrolls the first demo into view and waits for its live mount. */
async function liveStage(page: Page) {
  const stage = firstStage(page);
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-demo-live", "");
  return stage;
}

for (const path of ["/", BAR, GUIDE]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${path} in ${scheme} passes axe with no console errors`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));
      expect(await pageViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

test("the theme choice persists from the landing page to the docs", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const toggle = page.locator("[data-theme-toggle]");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto(BAR);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
});

test("install tabs switch commands once hydrated", async ({ page }) => {
  test.skip(!secondInstall, "only one install option");
  await page.goto("/");
  await page.getByRole("tab", { name: secondInstall?.label }).click();
  await expect(page.getByRole("tabpanel")).toContainText(secondInstall?.command ?? "");
});

test.describe("demos", () => {
  test("a demo mounts live in place of its static SVG without moving the page", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto(BAR);
    const stage = await liveStage(page);
    await expect(stage.locator("svg.demo-static").first()).toBeHidden();
    expect(await stage.locator("svg:not(.demo-static)").count()).toBeGreaterThan(0);
    expect((await stage.boundingBox())?.height).toBeCloseTo(400, 0);
    await expect(stage.locator(".oc-animate")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("live demos follow the site theme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BAR);
    const stage = await liveStage(page);
    await expect(stage.locator(".oc-dark")).toHaveCount(0);
    await page.locator("[data-theme-toggle]").click();
    await expect(stage).toHaveAttribute("data-demo-live", "");
    await expect(stage.locator(".oc-dark")).not.toHaveCount(0);
  });

  test("the chosen code tab applies to every demo and survives navigation", async ({ page }) => {
    await page.goto(BAR);
    await page.locator('[data-demo-tab="vue"]').first().click();
    const panels = page.locator('[data-demo-panel="vue"]');
    expect(await panels.count()).toBeGreaterThanOrEqual(3);
    for (const panel of await panels.all()) await expect(panel).toBeVisible();
    await expect(page.locator('[data-demo-panel="spec"]').first()).toBeHidden();
    await page.goto(GUIDE);
    await expect(page.locator('[data-demo-panel="vue"]').first()).toBeVisible();
  });

  test("Copy puts the visible panel's code on the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(BAR);
    const panel = page.locator('[data-demo-panel="spec"]').first();
    await panel.getByRole("button", { name: "Copy" }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toHaveProperty("encoding");
  });

  test("a spec that cannot mount shows the failure message", async ({ page }) => {
    await page.goto("/fixtures/broken-demo/");
    const stage = firstStage(page);
    await expect(stage).toHaveAttribute("data-demo-error", "");
    await expect(stage).toContainText("This chart could not be rendered.");
  });

  test("a table demo, which has no static SVG, mounts live", async ({ page }) => {
    await page.goto("/fixtures/demo/");
    const stage = page.locator('figure[data-demo="fixtures/table"] [data-demo-stage]');
    await expect(stage.locator("svg.demo-static")).toHaveCount(0);
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-demo-live", "");
    // The library renders a grid on wide screens and cards on narrow ones, so
    // check for rendered rows by their text instead of by role.
    await expect(stage).toContainText(/\S/);
    await expect(stage).not.toHaveAttribute("data-demo-error", "");
  });
});

test("the area switcher moves from Visualizations to Guides", async ({ page, isMobile }) => {
  await page.goto(BAR);
  if (isMobile) await page.getByText("Docs menu").click();
  await page
    .getByRole("navigation", { name: "Docs areas" })
    .filter({ visible: true })
    .getByRole("link", { name: "Guides" })
    .click();
  await expect(page).toHaveURL(/\/docs\/get-started\//);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the docs menu opens, a demo shows its static chart and spec, and the first install command shows", async ({
    page,
    isMobile,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(BAR);
    if (isMobile) {
      await page.getByText("Docs menu").click();
      await expect(page.getByRole("navigation", { name: "Docs menu" })).toBeVisible();
    } else {
      await expect(page.getByRole("navigation", { name: "Docs", exact: true })).toBeVisible();
    }
    const stage = firstStage(page);
    await expect(stage.locator('svg.demo-static[data-theme="light"]')).toBeVisible();
    await expect(stage.locator('svg.demo-static[data-theme="dark"]')).toBeHidden();
    await expect(page.locator('[data-demo-panel="spec"]').first()).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("tabpanel")).toContainText(firstInstall?.command ?? "");
  });
});

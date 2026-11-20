import { expect, type Locator, type Page, test } from "@playwright/test";
import { pageViolations } from "./axe";

const BAR = "/docs/comparison/bar/";
const GUIDE = "/docs/get-started/getting-started/";

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

/** Every CSS animation under an element, by play state. */
function animationStates(stage: Locator) {
  return stage.evaluate((element) =>
    element.getAnimations({ subtree: true }).map((animation) => animation.playState),
  );
}

const staticChart = (stage: Locator) => stage.locator('svg.demo-static[data-theme="light"]');

/** Scrolls so the stage sits just below the viewport: close enough to mount, not yet seen. */
async function bringJustBelowViewport(stage: Locator) {
  await stage.evaluate((element) => {
    const below = element.getBoundingClientRect().top - window.innerHeight - 100;
    window.scrollBy({ top: below, behavior: "instant" });
  });
}

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
    // The entrance plays, then the library takes its animation class off.
    await expect(stage.locator(".oc-animate")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the entrance waits until the demo scrolls into view, then plays", async ({ page }) => {
    await page.goto(BAR);
    // A demo still far below shows nothing yet, so its finished chart is never seen before the entrance.
    await expect(staticChart(page.locator("[data-demo-stage]").last())).toHaveCSS(
      "visibility",
      "hidden",
    );
    const stage = page.locator("[data-demo-stage]").nth(1);
    await bringJustBelowViewport(stage);
    await expect(stage).toHaveAttribute("data-demo-live", "");
    // Mounted ahead of the reader with the entrance held, and the static chart out of sight.
    await expect(stage.locator(".oc-animate")).toHaveCount(1);
    const held = await animationStates(stage);
    expect(held.length).toBeGreaterThan(0);
    expect(new Set(held)).toEqual(new Set(["paused"]));
    await stage.scrollIntoViewIfNeeded();
    await expect
      .poll(async () => (await animationStates(stage)).filter((state) => state === "paused"))
      .toEqual([]);
    await expect(stage.locator(".oc-animate")).toHaveCount(0);
  });

  test("under reduced motion a demo shows its finished chart with no animation", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BAR);
    // Nothing will play, so a demo still far below keeps its static chart showing.
    await expect(staticChart(page.locator("[data-demo-stage]").last())).toHaveCSS(
      "visibility",
      "visible",
    );
    const stage = page.locator("[data-demo-stage]").nth(1);
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-demo-live", "");
    expect(await stage.locator("svg:not(.demo-static) rect").count()).toBeGreaterThan(0);
    expect(await animationStates(stage)).toEqual([]);
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

  test("the code starts closed and opens and closes from the keyboard", async ({ page }) => {
    await page.goto(BAR);
    const figure = page.locator("figure[data-demo]").first();
    const toggle = figure.locator("summary");
    const spec = figure.locator('[data-demo-panel="spec"]');
    await expect(toggle).toHaveText("Show code", { useInnerText: true });
    await expect(spec).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(spec).toBeVisible();
    await expect(toggle).toHaveText("Hide code", { useInnerText: true });
    await page.keyboard.press("Space");
    await expect(spec).toBeHidden();
    await expect(toggle).toHaveText("Show code", { useInnerText: true });
  });

  test("the chosen code tab and open code apply to every demo and survive navigation", async ({
    page,
  }) => {
    await page.goto(BAR);
    const figure = page.locator("figure[data-demo]").first();
    await figure.locator("summary").click();
    await figure.locator('[data-demo-tab="vue"]').click();
    await expect(figure.locator('[data-demo-panel="vue"]')).toBeVisible();
    await expect(figure.locator('[data-demo-panel="spec"]')).toBeHidden();
    const codes = page.locator("[data-demo-code]");
    expect(await codes.count()).toBeGreaterThanOrEqual(3);
    for (const code of await codes.all())
      await expect(code).toHaveAttribute("data-demo-choice", "vue");
    await page.goto(GUIDE);
    await expect(page.locator('[data-demo-panel="vue"]').first()).toBeVisible();
  });

  test("Copy copies the spec while the code stays closed, and says so", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(BAR);
    const figure = page.locator("figure[data-demo]").first();
    const copy = figure.locator("button[data-demo-copy]");
    await expect(copy).toHaveAccessibleName("Copy");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    await expect(figure.getByRole("status")).toHaveText("Copied the Spec code.");
    await expect(figure.locator("details[data-demo-code]")).not.toHaveAttribute("open");
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

  test("the docs menu opens, and a demo shows its static chart and opens its spec", async ({
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
    const figure = page.locator("figure[data-demo]").first();
    await expect(figure.getByRole("button", { name: "Copy" })).toHaveCount(0);
    await figure.locator("summary").click();
    await expect(figure.locator('[data-demo-panel="spec"]')).toBeVisible();
  });
});

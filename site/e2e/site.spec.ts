import { expect, type Locator, type Page, test } from "@playwright/test";
import { pageViolations } from "./axe";
import { sidewaysOverflow } from "./layout";

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

// The landing page has its own axe pass after a full scroll, in landing.spec.ts.
for (const path of [BAR, GUIDE]) {
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

/** The light static chart's visibility, read once. */
const staticVisibility = (stage: Locator) =>
  staticChart(stage).evaluate((svg) => getComputedStyle(svg).visibility);

/** Scrolls so the stage sits just below the viewport: close enough to mount, not yet seen. */
async function bringJustBelowViewport(stage: Locator) {
  await stage.evaluate((element) => {
    const below = element.getBoundingClientRect().top - window.innerHeight - 100;
    window.scrollBy({ top: below, behavior: "instant" });
  });
}

const firstDemo = (page: Page) => page.locator(".demo[data-demo]").first();

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
    expect(await staticVisibility(page.locator("[data-demo-stage]").last())).toBe("hidden");
    const stage = page.locator("[data-demo-stage]").nth(1);
    await bringJustBelowViewport(stage);
    await expect(stage).toHaveAttribute("data-demo-live", "");
    // Mounted ahead of the reader with the entrance held.
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
    expect(await staticVisibility(page.locator("[data-demo-stage]").last())).toBe("visible");
    const stage = page.locator("[data-demo-stage]").nth(1);
    await stage.scrollIntoViewIfNeeded();
    await expect(stage).toHaveAttribute("data-demo-live", "");
    expect(await stage.locator("svg:not(.demo-static) rect").count()).toBeGreaterThan(0);
    expect(await animationStates(stage)).toEqual([]);
  });

  test("when the chart library can't load, the static charts come back at once", async ({
    page,
  }) => {
    await page.route(/demo-mount[^/]*\.js$/, (route) => route.abort());
    const errors = collectErrors(page);
    await page.goto(BAR);
    const stage = page.locator("[data-demo-stage]").first();
    // Well inside the head gate's own fallback, which waits four seconds.
    await expect(stage).toHaveAttribute("data-demo-error", "", { timeout: 2000 });
    await expect(staticChart(stage)).toBeVisible({ timeout: 2000 });
    expect(await staticVisibility(stage)).toBe("visible");
    expect(errors.some((error) => error.includes("could not be rendered"))).toBe(true);
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
    const demo = firstDemo(page);
    const toggle = demo.getByRole("button", { name: "Code", exact: true });
    const spec = demo.locator('[data-demo-panel="spec"]');
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(spec).toBeHidden();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(spec).toBeVisible();
    // Focus moves from Code to Copy, then into the code: the order the row reads.
    await page.keyboard.press("Tab");
    await expect(demo.locator("button[data-demo-copy]")).toBeFocused();
    // A long data array scrolls inside its own region instead of pushing the page down.
    const pre = spec.locator("pre");
    expect((await pre.boundingBox())?.height).toBeLessThanOrEqual(28 * 16 + 1);
    await expect(pre).toHaveAttribute("tabindex", "0");
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(spec).toBeHidden();
  });

  test("open code is restored on the next page, in place before it paints", async ({ page }) => {
    await page.goto(BAR);
    await firstDemo(page).getByRole("button", { name: "Code", exact: true }).click();
    await page.goto(GUIDE);
    const demo = firstDemo(page);
    await expect(demo.locator('[data-demo-panel="spec"]')).toBeVisible();
    await expect(demo.getByRole("button", { name: "Code", exact: true })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    const opening = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) =>
            (animation.effect as KeyframeEffect | null)?.target?.closest("[data-demo-code]"),
          ).length,
    );
    expect(opening).toBe(0);
  });

  test("the chosen code tab applies to every demo and survives navigation", async ({ page }) => {
    await page.goto(BAR);
    const demo = firstDemo(page);
    await demo.getByRole("button", { name: "Code", exact: true }).click();
    await demo.locator('[data-demo-tab="vue"]').click();
    await expect(demo.locator('[data-demo-panel="vue"]')).toBeVisible();
    await expect(demo.locator('[data-demo-panel="spec"]')).toBeHidden();
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
    const demo = firstDemo(page);
    const copy = demo.locator("button[data-demo-copy]");
    await expect(copy).toHaveAccessibleName("Copy");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    await expect(demo.getByRole("status")).toHaveText("Copied the Spec code.");
    await expect(demo.getByRole("button", { name: "Code", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(JSON.parse(copied)).toHaveProperty("encoding");
  });

  test("a prose code block copies through the same button", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(GUIDE);
    const frame = page.locator(".code-frame:not(.demo .code-frame)").first();
    const copy = frame.locator("button.copy-button");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    await expect(frame.getByRole("status")).toHaveText(/^Copied /);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(await frame.locator("code").textContent());
  });

  test("a spec that cannot mount shows the failure message", async ({ page }) => {
    await page.goto("/fixtures/broken-demo/");
    const stage = firstStage(page);
    await expect(stage).toHaveAttribute("data-demo-error", "");
    await expect(stage).toContainText("This chart could not be rendered.");
  });

  test("a table demo, which has no static SVG, mounts live", async ({ page }) => {
    await page.goto("/fixtures/demo/");
    const stage = page.locator('[data-demo="fixtures/table"] [data-demo-stage]');
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

// The header holds four links, search and the theme toggle; on a phone it drops
// GitHub (under 640px) and the wordmark text (under 480px) to fit.
for (const width of [360, 390]) {
  test(`at ${width}px the header fits and no page scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ["/", "/docs/", "/examples/", "/blog/"]) {
      await page.goto(path);
      const header = page.locator("body > header");
      const nav = header.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Blog" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "GitHub" })).toBeHidden();
      await expect(header.getByRole("link", { name: "OpenChart home" })).toBeVisible();
      // `scrollbar-gutter: stable` reserves the bar's space, so the document's
      // scrollWidth can be smaller than its clientWidth (negative here, on Linux).
      // Anything at or below zero means nothing sticks out sideways.
      const { scroll, past } = await sidewaysOverflow(page);
      const headerRow = await page.evaluate(() => {
        const row = document.querySelector("body > header > div");
        return row ? row.scrollWidth - row.clientWidth : 0;
      });
      expect(scroll, path).toBeLessThanOrEqual(0);
      expect(past, path).toBeLessThanOrEqual(0);
      expect(headerRow, path).toBeLessThanOrEqual(0);
    }
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the docs menu opens, and a demo shows its static chart and its spec", async ({
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
    // No dead controls, and the code is simply there to read.
    const demo = page.locator(".demo[data-demo]").first();
    await expect(demo.getByRole("button")).toHaveCount(0);
    await expect(demo.locator('[data-demo-panel="spec"]')).toBeVisible();
  });
});

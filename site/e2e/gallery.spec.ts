/**
 * Browser tests for the examples gallery, run on the desktop and mobile
 * projects: the wall at /examples/ (filter, tiles going live, motion, small
 * screens, no JavaScript) and an entry page (Copy). They find things by role
 * and name, and by the hooks in the contract comments of
 * src/components/gallery/GalleryTile.astro and GalleryFilter.astro.
 */
import { expect, type Page, test } from "@playwright/test";
import { pageViolations } from "./axe";

const WALL = "/examples/";
const tiles = (page: Page) => page.locator("[data-gallery-tile]");
const filterButton = (page: Page, name: string) =>
  page.getByRole("group", { name: "Show one kind of graphic" }).getByRole("button", {
    name,
    exact: true,
  });

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Resolves after the browser has painted twice, so scroll-driven work has run. */
async function settle(page: Page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/** Scrolls from top to bottom a step at a time, so every tile is seen, revealed and mounted once. */
async function scrollThrough(page: Page) {
  for (let step = 0; step < 200; step += 1) {
    const { y, end, height } = await page.evaluate(() => ({
      y: window.scrollY,
      end: document.documentElement.scrollHeight - window.innerHeight,
      height: window.innerHeight,
    }));
    if (y >= end - 1) break;
    await page.evaluate((top) => window.scrollTo(0, top), y + height * 0.6);
    await settle(page);
  }
}

/** The first entry page the wall links to, and the demo it shows. */
async function firstEntry(page: Page) {
  await page.goto(WALL);
  const link = tiles(page).first().locator(".gallery-headline a");
  return (await link.getAttribute("href")) ?? "";
}

for (const scheme of ["light", "dark"] as const) {
  test(`the wall and an entry page in ${scheme} pass axe after a full scroll, with no console errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    const entry = await firstEntry(page);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));
    await scrollThrough(page);
    expect(await pageViolations(page)).toEqual([]);

    await page.goto(entry);
    await scrollThrough(page);
    expect(await pageViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("choosing Maps leaves only the maps, presses the button and writes the hash; a reload restores it", async ({
  page,
}) => {
  await page.goto(WALL);
  const total = await tiles(page).count();
  const maps = filterButton(page, "Maps");
  await maps.click();
  await expect(maps).toHaveAttribute("aria-pressed", "true");
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/#kind=maps$/);
  const visibleKinds = () =>
    tiles(page)
      .filter({ visible: true })
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-kind")));
  await expect.poll(async () => [...new Set(await visibleKinds())]).toEqual(["maps"]);
  const shown = (await visibleKinds()).length;
  expect(shown).toBe(await page.locator('[data-gallery-tile][data-kind="maps"]').count());
  await expect(page.locator("[data-gallery-status]")).toHaveText(`Showing ${shown} maps.`);

  await page.reload();
  await expect(filterButton(page, "Maps")).toHaveAttribute("aria-pressed", "true");
  expect([...new Set(await visibleKinds())]).toEqual(["maps"]);
  expect(shown).toBeLessThan(total);
});

test("a tile goes live once it is scrolled into view, without changing its height", async ({
  page,
}) => {
  await page.goto(WALL);
  // A tile below the fold with a static chart, so the swap from static to live is what is measured.
  const tile = tiles(page)
    .filter({ has: page.locator("svg.demo-static") })
    .nth(4);
  const stage = tile.locator("[data-demo-stage]");
  await expect(stage).not.toHaveAttribute("data-demo-live", "");
  const before = (await stage.boundingBox())?.height;
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-demo-live", "");
  await expect(stage.locator(".demo-live svg").first()).toBeAttached();
  expect(before).toBeGreaterThan(0);
  expect((await stage.boundingBox())?.height).toBe(before);
});

test("with reduced motion the filter applies at once and nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(WALL);
  await filterButton(page, "Tables").click();
  const state = await page.evaluate(() => ({
    kinds: [...document.querySelectorAll<HTMLElement>("[data-gallery-tile]")]
      .filter((tile) => !tile.hidden)
      .map((tile) => tile.dataset.kind),
    animations: document.getAnimations().length,
  }));
  expect([...new Set(state.kinds)]).toEqual(["tables"]);
  expect(state.animations).toBe(0);
  await scrollThrough(page);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("a tile opens its entry page, where Copy copies the demo's spec", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(WALL);
  const tile = tiles(page).nth(1);
  const href = (await tile.locator(".gallery-headline a").getAttribute("href")) ?? "";
  await tile.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const demo = page.locator(".gallery-entry .demo[data-demo]");
  await expect(demo).toHaveCount(1);
  const embedded = JSON.parse(
    (await demo.locator("script[data-demo-spec]").textContent()) ?? "{}",
  ) as { mark?: unknown; type?: unknown };
  const copy = demo.locator("button[data-demo-copy]");
  await copy.click();
  await expect(copy).toHaveText("Copied");
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText())) as {
    mark?: unknown;
    type?: unknown;
  };
  expect(copied.mark ?? copied.type).toEqual(embedded.mark ?? embedded.type);
  expect(copied.mark ?? copied.type).toBeTruthy();
});

for (const width of [360, 390]) {
  test(`at ${width}px neither the wall nor an entry page scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const entry = await firstEntry(page);
    for (const path of [WALL, entry]) {
      await page.goto(path);
      await scrollThrough(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("every tile shows its static chart, or a table its first rows, and no filter button shows", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(WALL);
    await expect(page.locator("[data-gallery]").getByRole("button")).toHaveCount(0);
    const count = await tiles(page).count();
    expect(count).toBeGreaterThanOrEqual(24);
    for (const tile of await tiles(page).all()) {
      const stage = tile.locator("[data-demo-stage]");
      const svg = stage.locator('svg.demo-static[data-theme="light"]');
      const fallback = stage.locator(".tile-table, [data-demo-placeholder]").first();
      if ((await svg.count()) > 0) await expect(svg).toBeVisible();
      else await expect(fallback).toBeVisible();
    }
    // Only charts the library cannot draw without a browser (the sankey) and tables fall back.
    expect(
      await page.locator("[data-gallery-tile] svg.demo-static").count(),
    ).toBeGreaterThanOrEqual(2 * (count - 3));
  });
});

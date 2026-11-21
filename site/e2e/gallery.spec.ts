/**
 * Browser tests for the examples gallery, run on the desktop and mobile
 * projects: the wall at /examples/ (filter, history, arrangement, tiles going
 * live and falling back, motion, small screens, no JavaScript) and an entry
 * page (Copy). They find things by role and name, and by the hooks in the
 * contract comments of src/components/gallery/GalleryTile.astro and
 * GalleryFilter.astro.
 */
import { expect, type Page, test } from "@playwright/test";
import { inflationReference } from "../src/demos/gallery/composition";
import { pageViolations } from "./axe";

const WALL = "/examples/";
const tiles = (page: Page) => page.locator("[data-gallery-tile]");
const filterButton = (page: Page, kind: string) =>
  page
    .getByRole("group", { name: "Show one kind of graphic" })
    .getByRole("button", { name: new RegExp(`^${kind} \\d+ graphics?$`) });
const visibleKinds = (page: Page) =>
  tiles(page)
    .filter({ visible: true })
    .evaluateAll((nodes) => [...new Set(nodes.map((node) => node.getAttribute("data-kind")))]);

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

/** The second tile's entry page: the first is the lead, a sankey. */
async function anEntry(page: Page) {
  await page.goto(WALL);
  return (await tiles(page).nth(1).locator(".gallery-headline a").getAttribute("href")) ?? "";
}

for (const scheme of ["light", "dark"] as const) {
  test(`the wall and an entry page in ${scheme} pass axe after a full scroll, with no console errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    const entry = await anEntry(page);
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
  await expect(page).toHaveURL(/\/examples\/#kind=maps$/);
  await expect.poll(() => visibleKinds(page)).toEqual(["maps"]);
  const shown = await page.locator('[data-gallery-tile][data-kind="maps"]').count();
  expect(shown).toBeLessThan(total);
  await expect(page.locator("[data-gallery-status]")).toHaveText(`Showing ${shown} maps.`);

  await page.reload();
  await expect(filterButton(page, "Maps")).toHaveAttribute("aria-pressed", "true");
  expect(await visibleKinds(page)).toEqual(["maps"]);
});

test("Back and Forward step through the choices, All is the bare URL, and an edited hash is followed", async ({
  page,
}) => {
  await page.goto(WALL);
  await filterButton(page, "Maps").click();
  await filterButton(page, "Tables").click();
  await expect.poll(() => visibleKinds(page)).toEqual(["tables"]);
  await page.goBack();
  await expect(page).toHaveURL(/#kind=maps$/);
  await expect.poll(() => visibleKinds(page)).toEqual(["maps"]);
  await page.goBack();
  await expect(page).toHaveURL(/\/examples\/$/);
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
  await page.goForward();
  await expect.poll(() => visibleKinds(page)).toEqual(["maps"]);

  await filterButton(page, "All").click();
  await expect(page).toHaveURL(/\/examples\/$/);
  await page.evaluate(() => {
    window.location.hash = "#kind=composition";
  });
  await expect.poll(() => visibleKinds(page)).toEqual(["composition"]);
  await page.evaluate(() => {
    window.location.hash = "#kind=nonsense";
  });
  await expect(page).toHaveURL(/#kind=composition$/);
  expect(await visibleKinds(page)).toEqual(["composition"]);
});

test("a filter that keeps a feature lays it out like any other tile, in order from the first column", async ({
  page,
}) => {
  // The arranged wall starts at 1100px, so both projects run this at a desktop width.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(WALL);
  await filterButton(page, "Composition").click();
  await expect.poll(() => visibleKinds(page)).toEqual(["composition"]);
  // Once the refile settles: the shown tiles sit side by side from the wall's left edge,
  // in entry order, each the same width and shape, the feature included.
  const layout = () =>
    page.evaluate(() => {
      const wall = document.querySelector(".gallery-grid")?.getBoundingClientRect();
      const shown = [...document.querySelectorAll<HTMLElement>("[data-gallery-tile]")].filter(
        (tile) => !tile.hidden,
      );
      return shown.map((tile) => {
        const box = tile.getBoundingClientRect();
        const stage = tile.querySelector("[data-demo-stage]")?.getBoundingClientRect();
        return {
          shape: tile.dataset.shape,
          left: Math.round(box.left - (wall?.left ?? 0)),
          width: Math.round(box.width),
          stage: Math.round(stage?.height ?? 0),
        };
      });
    });
  await expect.poll(async () => (await layout())[0]?.left).toBe(0);
  const tilesShown = await layout();
  expect(tilesShown.map((tile) => tile.shape)).toContain("feature");
  expect(new Set(tilesShown.map((tile) => tile.width)).size).toBe(1);
  expect(new Set(tilesShown.map((tile) => tile.stage)).size).toBe(1);
  expect(tilesShown[1]?.left).toBeGreaterThan(0);
  expect(tilesShown[1]?.left).toBeLessThan((tilesShown[0]?.width ?? 0) + 64);
});

test("the filter row holds its height before it appears, so the wall never moves", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(WALL);
  const gridTop = () =>
    page.locator(".gallery-grid").evaluate((grid) => grid.getBoundingClientRect().top);
  const ready = await gridTop();
  await page
    .locator("[data-gallery-filter]")
    .evaluate((row) => (row as HTMLElement).removeAttribute("data-ready"));
  expect(await page.locator("[data-gallery-filter]").isVisible()).toBe(false);
  expect(await gridTop()).toBe(ready);
});

test("the last tile goes live once it is scrolled into view, without changing its height", async ({
  page,
}) => {
  await page.goto(WALL);
  const stage = tiles(page).last().locator("[data-demo-stage]");
  await expect(stage).not.toHaveAttribute("data-demo-live", "");
  const before = (await stage.boundingBox())?.height;
  await stage.scrollIntoViewIfNeeded();
  await expect(stage).toHaveAttribute("data-demo-live", "");
  await expect(stage.locator(".demo-live svg").first()).toBeAttached();
  expect(before).toBeGreaterThan(0);
  expect((await stage.boundingBox())?.height).toBe(before);
});

test("after a scroll to the bottom and back, every tile in view shows a chart, live or static", async ({
  page,
}) => {
  await page.goto(WALL);
  await scrollThrough(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  const blank = await tiles(page).evaluateAll((nodes) =>
    nodes
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .filter((node) => {
        const stage = node.querySelector("[data-demo-stage]");
        if (!stage || stage.hasAttribute("data-demo-live")) return false;
        const shown = [...stage.querySelectorAll(".demo-static, .tile-table")].some((element) =>
          element.checkVisibility({ visibilityProperty: true }),
        );
        return !shown;
      })
      .map((node) => node.getAttribute("data-demo")),
  );
  expect(blank).toEqual([]);
});

test("with reduced motion the filter applies at once and nothing animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(WALL);
  await filterButton(page, "Tables").click();
  const state = await page.evaluate(() => ({
    kinds: [
      ...new Set(
        [...document.querySelectorAll<HTMLElement>("[data-gallery-tile]")]
          .filter((tile) => !tile.hidden)
          .map((tile) => tile.dataset.kind),
      ),
    ],
    animations: document.getAnimations().length,
  }));
  expect(state).toEqual({ kinds: ["tables"], animations: 0 });
  await scrollThrough(page);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test("after a refile, clicking a tile's chart opens its entry page", async ({ page }) => {
  await page.goto(WALL);
  await filterButton(page, "Maps").click();
  await filterButton(page, "All").click();
  await expect(filterButton(page, "All")).toHaveAttribute("aria-pressed", "true");
  const tile = tiles(page).nth(2);
  const href = (await tile.locator(".gallery-headline a").getAttribute("href")) ?? "";
  await tile.scrollIntoViewIfNeeded();
  await expect
    .poll(() => tile.evaluate((node) => node.getAnimations({ subtree: true }).length))
    .toBe(0);
  const box = await tile.locator("[data-demo-stage]").boundingBox();
  if (!box) throw new Error("The tile's chart has no box.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

test("an entry page's Copy puts the demo's full spec on the clipboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/examples/inflation-against-2-percent/");
  const demo = page.locator(`.gallery-entry .demo[data-demo="${inflationReference.id}"]`);
  await expect(demo).toHaveCount(1);
  const copy = demo.locator("button[data-demo-copy]");
  await copy.click();
  await expect(copy).toHaveText("Copied");
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied).toEqual(JSON.parse(JSON.stringify(inflationReference.spec)));
});

for (const width of [360, 390]) {
  test(`at ${width}px neither the wall nor an entry page scrolls sideways`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const entry = await anEntry(page);
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

  test("every tile shows its static chart or its fallback table, and no filter button shows", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(WALL);
    await expect(page.locator("[data-gallery]").getByRole("button")).toHaveCount(0);
    const all = await tiles(page).all();
    expect(all.length).toBeGreaterThanOrEqual(24);
    let withImages = 0;
    for (const tile of all) {
      await tile.scrollIntoViewIfNeeded();
      const stage = tile.locator("[data-demo-stage]");
      const images = stage.locator('img.demo-static[data-theme="light"]');
      if ((await images.count()) > 0) {
        withImages += 1;
        await expect(images.filter({ visible: true })).toHaveCount(1);
        await expect
          .poll(() =>
            images
              .filter({ visible: true })
              .evaluate((img) => (img as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
      } else {
        await expect(stage.locator(".tile-table")).toBeVisible();
      }
    }
    // Every tile has images except tables and sankeys, which the library draws only live.
    const fallbacks = await tiles(page).locator(".tile-table").count();
    expect(withImages).toBe(all.length - fallbacks);
  });
});

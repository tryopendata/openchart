/**
 * The hero chart at the top of every blog post: wide on a desktop, edge to edge
 * on a phone, painted from the static SVG before any script runs, and never
 * shifting the page or blanking and redrawing once the live chart mounts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

/** Every published post that names a lead chart, from the content folder (drafts never build). */
const SLUGS = readdirSync("src/content/blog")
  .filter((file) => /\.mdx?$/.test(file))
  .filter((file) => {
    const source = readFileSync(join("src/content/blog", file), "utf8");
    return !/^draft:\s*true\s*$/m.test(source) && /^lead:\s*\S+/m.test(source);
  })
  .map((file) => `/blog/${file.replace(/\.mdx?$/, "")}/`);
const POST = "/blog/when-to-use-a-log-scale/";
const MAX_CLS = 0.1;

test("the posts with a lead are found", () => {
  expect(SLUGS.length).toBeGreaterThan(0);
});

test.describe("on a wide screen", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const path of SLUGS) {
    test(`${path} leads with a wide hero centred on the text`, async ({ page }) => {
      await page.goto(path);
      const hero = page.locator("[data-blog-hero]");
      await expect(hero).toHaveCount(1);
      const heroBox = await hero.boundingBox();
      const textBox = await page.locator("article .docs-prose > p").first().boundingBox();
      expect(heroBox?.width ?? 0).toBeGreaterThan(960);
      const centre = (box: typeof heroBox) => (box ? box.x + box.width / 2 : 0);
      expect(Math.abs(centre(heroBox) - centre(textBox))).toBeLessThanOrEqual(2);
      // The hero is in the first screen.
      expect(heroBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(900);
    });
  }
});

test("on a phone the hero runs edge to edge", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(POST);
  const stage = await page.locator("[data-blog-hero] [data-demo-stage]").boundingBox();
  expect(stage?.x ?? -1).toBeCloseTo(0, 0);
  expect(stage?.width ?? 0).toBeCloseTo(390, 0);
});

test("loading a post shifts nothing and never blanks the hero", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const record = window as unknown as { __cls: number; __heroBlank: boolean };
    record.__cls = 0;
    record.__heroBlank = false;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) record.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    // Sample every frame: the hero's stage must always show a chart (a static or a live SVG).
    const watch = () => {
      const stage = document.querySelector("[data-blog-hero] [data-demo-stage]");
      if (stage) {
        const visible = [...stage.querySelectorAll("svg")].some((svg) => {
          const box = svg.getBoundingClientRect();
          const style = getComputedStyle(svg);
          return box.width > 0 && style.visibility !== "hidden" && style.display !== "none";
        });
        if (!visible) record.__heroBlank = true;
      }
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
  await page.goto(POST);
  await expect(page.locator("[data-blog-hero] [data-demo-stage]")).toHaveAttribute(
    "data-demo-live",
    "",
  );
  // Let the live chart finish any entrance before reading the totals.
  await page.waitForFunction(() => !document.querySelector("[data-blog-hero] .oc-animate"));
  const { cls, blank } = await page.evaluate(() => {
    const record = window as unknown as { __cls: number; __heroBlank: boolean };
    return { cls: record.__cls, blank: record.__heroBlank };
  });
  expect(cls).toBeLessThan(MAX_CLS);
  expect(blank).toBe(false);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the hero's static chart shows", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(POST);
    await expect(
      page.locator('[data-blog-hero] [data-demo-stage] svg.demo-static[data-theme="light"]'),
    ).toBeVisible();
  });
});

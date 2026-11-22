/**
 * No chart scrolls inside its figure. The library can draw a chart taller than
 * the height a demo gives it (facet rows on a phone, callouts folded into
 * notes), so every live chart on the blog and the catalog pages is checked at a
 * phone and a desktop width: its host has nothing to scroll and its SVG ends
 * inside the stage. Charts are drawn under reduced motion, so the check reads
 * finished charts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { catalogPages } from "../tests/catalog-pages";

const POSTS = readdirSync("src/content/blog")
  .filter((file) => /\.mdx?$/.test(file))
  .filter(
    (file) => !/^draft:\s*true\s*$/m.test(readFileSync(join("src/content/blog", file), "utf8")),
  )
  .map((file) => `/blog/${file.replace(/\.mdx?$/, "")}/`);

const CATALOG = Object.entries(catalogPages).flatMap(([section, slugs]) =>
  slugs.map((slug) => `/docs/${section}/${slug}/`),
);

const WIDTHS = [390, 1280];

async function mountEveryDemo(page: Page) {
  const stages = page.locator("[data-demo-stage]");
  const count = await stages.count();
  for (let i = 0; i < count; i++) {
    await stages.nth(i).scrollIntoViewIfNeeded();
    await expect(stages.nth(i)).toHaveAttribute("data-demo-live", "");
  }
}

/** Each live chart that scrolls inside its stage or runs past its bottom, by demo id. */
async function overflowingCharts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    for (const stage of document.querySelectorAll<HTMLElement>("[data-demo-stage]")) {
      const live = stage.querySelector<HTMLElement>(".demo-live");
      if (!live) continue;
      const id = stage.closest<HTMLElement>("[data-demo]")?.dataset.demo ?? "?";
      if (live.scrollHeight > live.clientHeight + 1) {
        problems.push(`${id}: scrolls (${live.scrollHeight}px in ${live.clientHeight}px)`);
      }
      const drawn = live.querySelector(":scope > svg, :scope > div > svg");
      if (drawn) {
        const overrun = drawn.getBoundingClientRect().bottom - stage.getBoundingClientRect().bottom;
        if (overrun > 1) problems.push(`${id}: runs ${Math.round(overrun)}px past its stage`);
      }
    }
    return problems;
  });
}

for (const path of [...POSTS, ...CATALOG]) {
  test(`${path} draws every chart inside its stage`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(path);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await mountEveryDemo(page);
      await expect.poll(() => overflowingCharts(page), { message: `at ${width}px` }).toEqual([]);
    }
  });
}

/**
 * Every blog chart read on a phone: drawn live at 360, 390, 412 and 430px
 * (phones reach both the compact and the medium breakpoint), each chart's
 * title fits in three lines, no text sticks out of its stage, and no two labels
 * (annotations, endpoint labels, sankey labels) sit on top of each other. Charts
 * are drawn under reduced motion, so the check reads finished charts.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const POSTS = readdirSync("src/content/blog")
  .filter((file) => /\.mdx?$/.test(file))
  .filter(
    (file) => !/^draft:\s*true\s*$/m.test(readFileSync(join("src/content/blog", file), "utf8")),
  )
  .map((file) => `/blog/${file.replace(/\.mdx?$/, "")}/`);

const MAX_TITLE_LINES = 3;
/** Labels may touch; they overlap when they share more than this many px in both directions. */
const OVERLAP_TOLERANCE = 1;
const LABELS = ".oc-annotation-label, .oc-endpoint-label, .oc-sankey-label";

async function mountEveryDemo(page: Page) {
  const stages = page.locator("[data-demo-stage]");
  const count = await stages.count();
  for (let i = 0; i < count; i++) {
    await stages.nth(i).scrollIntoViewIfNeeded();
    await expect(stages.nth(i)).toHaveAttribute("data-demo-live", "");
  }
}

/** What a phone reader would trip over in each live chart, by demo id. */
async function legibilityProblems(page: Page): Promise<string[]> {
  return page.evaluate(
    ({ maxTitleLines, tolerance, labels }) => {
      const problems: string[] = [];
      for (const figure of document.querySelectorAll<HTMLElement>("article .demo[data-demo]")) {
        const id = figure.dataset.demo ?? "?";
        const stage = figure.querySelector("[data-demo-stage]");
        const svg = stage?.querySelector(".demo-live svg");
        if (!stage || !svg) continue;
        const bounds = stage.getBoundingClientRect();

        const titleLines = svg.querySelectorAll(".oc-title tspan").length;
        if (titleLines > maxTitleLines) problems.push(`${id}: title runs to ${titleLines} lines`);

        for (const text of svg.querySelectorAll("text")) {
          const box = text.getBoundingClientRect();
          if (box.width === 0) continue;
          if (box.left < bounds.left - 1 || box.right > bounds.right + 1) {
            problems.push(`${id}: "${text.textContent?.slice(0, 30)}" is cut off at the edge`);
          }
        }

        const boxes = [...svg.querySelectorAll(labels)]
          .filter((label) => getComputedStyle(label).opacity !== "0")
          .map((label) => ({
            text: label.textContent?.slice(0, 30),
            box: label.getBoundingClientRect(),
          }))
          .filter(({ box }) => box.width > 0);
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]?.box;
            const b = boxes[j]?.box;
            if (!a || !b) continue;
            const across = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const down = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (across > tolerance && down > tolerance) {
              problems.push(`${id}: "${boxes[i]?.text}" overlaps "${boxes[j]?.text}"`);
            }
          }
        }
      }
      return problems;
    },
    { maxTitleLines: MAX_TITLE_LINES, tolerance: OVERLAP_TOLERANCE, labels: LABELS },
  );
}

for (const width of [360, 390, 412, 430]) {
  test.describe(`blog charts at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });
    for (const path of POSTS) {
      test(path, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.goto(path);
        await mountEveryDemo(page);
        expect(await legibilityProblems(page)).toEqual([]);
      });
    }
  });
}

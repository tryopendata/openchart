import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pageViolations } from "./axe";
import { sidewaysOverflow } from "./layout";

const POST = "/blog/how-to-chart-a-temperature-anomaly/";
const TAG = "/blog/tags/climate/";
const BLOG_PAGES = ["/blog/", POST, TAG];

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Scrolls every demo stage on the page into view and waits for each to go live. */
async function mountEveryDemo(page: Page) {
  const stages = page.locator("[data-demo-stage]");
  const count = await stages.count();
  for (let i = 0; i < count; i++) {
    await stages.nth(i).scrollIntoViewIfNeeded();
    await expect(stages.nth(i)).toHaveAttribute("data-demo-live", "");
  }
  return count;
}

for (const path of BLOG_PAGES) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${path} in ${scheme} passes axe with no console errors`, async ({ page }) => {
      const errors = collectErrors(page);
      // Under reduced motion every chart is drawn in full, so axe checks finished charts.
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto(path);
      await mountEveryDemo(page);
      expect(await pageViolations(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  }

  test(`${path} marks Blog as the current section in the header`, async ({ page }) => {
    await page.goto(path);
    const nav = page.locator("body > header").getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Blog" })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });
}

test("the sample post's charts go live as they are reached", async ({ page }) => {
  await page.goto(POST);
  const figures = page.locator("article .docs-prose .demo[data-demo]");
  await expect(figures).toHaveCount(2);
  // The hero, in view on load, goes live; the last body chart waits until it is reached.
  await expect(page.locator("[data-blog-hero] [data-demo-stage]")).toHaveAttribute(
    "data-demo-live",
    "",
  );
  const stages = page.locator("article .docs-prose [data-demo-stage]");
  await expect(stages.last()).not.toHaveAttribute("data-demo-live", "");
  expect(await mountEveryDemo(page)).toBe(3);
});

/** Every published post's path, from the content folder (drafts never build). */
const POSTS = readdirSync("src/content/blog")
  .filter((file) => /\.mdx?$/.test(file))
  .filter(
    (file) => !/^draft:\s*true\s*$/m.test(readFileSync(join("src/content/blog", file), "utf8")),
  )
  .map((file) => `/blog/${file.replace(/\.mdx?$/, "")}/`);

/** The prose column's paragraphs and the figures' boxes, as laid out now. */
async function columnBoxes(page: Page) {
  return page.evaluate(() => {
    const box = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, width: rect.width, centre: rect.left + rect.width / 2 };
    };
    const prose = document.querySelector("article .docs-prose");
    return {
      paragraphs: [...(prose?.querySelectorAll(":scope > p") ?? [])].map(box),
      figures: [...(prose?.querySelectorAll(":scope > .demo") ?? [])]
        // A demo with its own width keeps it on the blog, so it is exempt from the breakout.
        .filter(
          (figure) =>
            !figure
              .querySelector("[data-demo-stage]")
              ?.getAttribute("style")
              ?.includes("--demo-width"),
        )
        .map(box),
      stages: [...(prose?.querySelectorAll(":scope > .demo [data-demo-stage]") ?? [])].map(box),
      viewport: document.documentElement.clientWidth,
    };
  });
}

test.describe("on a wide screen the text keeps a reading measure and figures break out", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const path of POSTS) {
    test(path, async ({ page }) => {
      await page.goto(path);
      const { paragraphs, figures } = await columnBoxes(page);
      expect(paragraphs.length).toBeGreaterThan(0);
      expect(figures.length).toBeGreaterThan(0);
      const textCentre = paragraphs[0]?.centre ?? 0;
      for (const paragraph of paragraphs) expect(paragraph.width).toBeLessThanOrEqual(720);
      for (const figure of figures) {
        expect(figure.width).toBeGreaterThan(960);
        expect(figure.width).toBeLessThanOrEqual(1024);
        expect(Math.abs(figure.centre - textCentre)).toBeLessThanOrEqual(2);
      }
    });
  }
});

test("on a tablet figures fill the page inside its gutters, at least as wide as the text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 800, height: 1000 });
  await page.goto(POST);
  const { paragraphs, figures, viewport } = await columnBoxes(page);
  const textWidth = Math.max(...paragraphs.map((paragraph) => paragraph.width));
  expect(figures.length).toBeGreaterThan(0);
  for (const figure of figures) {
    // The page gutter is 20 to 32px a side at this width; the figure neither bleeds nor breaks out.
    expect(figure.left).toBeGreaterThanOrEqual(16);
    expect(figure.left).toBeLessThanOrEqual(40);
    expect(Math.abs(figure.centre - viewport / 2)).toBeLessThanOrEqual(2);
    expect(figure.width).toBeGreaterThanOrEqual(textWidth - 1);
  }
});

for (const width of [360, 390]) {
  test(`at ${width}px the byline shows its date and reading time, and no blog page scrolls sideways`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(POST);
    const byline = page.locator("[data-byline]");
    await expect(byline.locator("time")).toBeVisible();
    await expect(byline.getByText(/^\d+ min read$/)).toBeVisible();
    for (const path of BLOG_PAGES) {
      await page.goto(path);
      await mountEveryDemo(page);
      const { scroll, past } = await sidewaysOverflow(page);
      expect(scroll, path).toBeLessThanOrEqual(0);
      expect(past, path).toBeLessThanOrEqual(0);
    }
  });

  test(`at ${width}px every post's charts run edge to edge with no sideways scroll`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of POSTS) {
      await page.goto(path);
      const { stages, viewport } = await columnBoxes(page);
      expect(stages.length, path).toBeGreaterThan(0);
      for (const stage of stages) {
        expect(stage.left, path).toBeCloseTo(0, 0);
        expect(stage.width, path).toBeCloseTo(viewport, 0);
      }
      const { scroll, past } = await sidewaysOverflow(page);
      expect(scroll, path).toBeLessThanOrEqual(0);
      expect(past, path).toBeLessThanOrEqual(0);
    }
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the sample post shows every static chart and all of its text", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(POST);
    const statics = page.locator(
      'article .docs-prose .demo [data-demo-stage] svg.demo-static[data-theme="light"]',
    );
    await expect(statics).toHaveCount(2);
    for (const svg of await statics.all()) await expect(svg).toBeVisible();
    const article = page.locator("article");
    await expect(article.locator("h1")).toBeVisible();
    for (const paragraph of await article.locator(".docs-prose > p, .docs-prose > h2").all()) {
      await expect(paragraph).toBeVisible();
    }
    await expect(article.locator(".docs-prose > p").last()).toContainText("getting started guide");
    await expect(article.getByRole("heading", { name: "Related docs" })).toBeVisible();
  });

  test("the index shows each post's lead chart as a static specimen", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/blog/");
    const lead = page.locator('.blog-lead img.demo-static[data-theme="light"]').first();
    await expect(lead).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How to chart a temperature anomaly" }),
    ).toBeVisible();
  });
});

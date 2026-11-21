import { expect, type Page, test } from "@playwright/test";
import { pageViolations } from "./axe";

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

test("the sample post's charts go live as they are reached, each in the article column", async ({
  page,
}) => {
  await page.goto(POST);
  const figures = page.locator("article .docs-prose .demo[data-demo]");
  await expect(figures).toHaveCount(3);
  expect(await mountEveryDemo(page)).toBe(3);
  const column = await page.locator("article .docs-prose").boundingBox();
  for (const box of await Promise.all(
    (await figures.all()).map((figure) => figure.boundingBox()),
  )) {
    expect(box?.width).toBeCloseTo(column?.width ?? 0, 0);
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
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
    }
  });
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the sample post shows every static chart and all of its text", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(POST);
    const statics = page.locator(
      'article .demo [data-demo-stage] svg.demo-static[data-theme="light"]',
    );
    await expect(statics).toHaveCount(3);
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
    const lead = page.locator('.blog-lead svg.demo-static[data-theme="light"]').first();
    await expect(lead).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "How to chart a temperature anomaly" }),
    ).toBeVisible();
  });
});

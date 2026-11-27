/**
 * The page's entrance: the headline's words rise in sequence without ever being
 * hidden, and each section's rule draws in from the left as it arrives.
 */
import { expect, type Page, test } from "@playwright/test";
import { landingCopy } from "../src/landing/copy";

const headline = (page: Page) => page.getByRole("heading", { level: 1 });
const words = (page: Page) => headline(page).locator(".hero-word");
const WORD_COUNT = landingCopy.headline.split(" ").length;

test("the headline reads the same to a screen reader, one span per word", async ({ page }) => {
  await page.goto("/");
  await expect(headline(page)).toHaveAccessibleName(landingCopy.headline);
  await expect(headline(page)).toHaveText(landingCopy.headline);
  await expect(words(page)).toHaveCount(WORD_COUNT);
});

test("every word is painted from the first frame and the headline's box never changes", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "commit" });
  await headline(page).waitFor();
  const first = await headline(page).evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    hidden: [...element.querySelectorAll<HTMLElement>(".hero-word")].filter((word) => {
      const style = getComputedStyle(word);
      return style.opacity !== "1" || style.visibility !== "visible" || style.display === "none";
    }).length,
  }));
  expect(first.hidden).toBe(0);
  // The headline's own animations only: the rules' scroll-driven ones never finish.
  await headline(page).evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((a) => a.finished)),
  );
  await page.evaluate(() => document.fonts.ready);
  const settled = await headline(page).evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    moved: [...element.querySelectorAll<HTMLElement>(".hero-word")].filter(
      (word) => getComputedStyle(word).transform !== "none",
    ).length,
  }));
  expect(settled.moved).toBe(0);
  expect(Math.abs(settled.height - first.height)).toBeLessThanOrEqual(1);
});

test("the words rise one after another", async ({ page }) => {
  await page.goto("/");
  const delays = await words(page).evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).animationDelay)),
  );
  expect(delays).toHaveLength(WORD_COUNT);
  for (let index = 1; index < delays.length; index++) {
    expect(delays[index]).toBeGreaterThan(delays[index - 1] ?? 0);
  }
});

test("with reduced motion no word animates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animated = await words(page).evaluateAll(
    (elements) =>
      elements.filter((element) => getComputedStyle(element).animationName !== "none").length,
  );
  expect(animated).toBe(0);
});

/** The share of a section's rule that is drawn (not clipped away), 0 to 1. */
async function ruleDrawn(page: Page, id: string): Promise<number> {
  return page.locator(`#${id} .landing-rule`).evaluate((rule) => {
    const clip = getComputedStyle(rule).clipPath;
    if (clip === "none") return 1;
    const right = /^inset\(\S+ (\S+)%/.exec(clip);
    if (!right) throw new Error(`Unexpected clip-path on the rule: ${clip}`);
    return 1 - Number.parseFloat(right[1]) / 100;
  });
}

const RULED = ["edit", "story", "motion", "publish", "start"];

test("each section's rule is drawn in full once the section is in view", async ({ page }) => {
  await page.goto("/");
  for (const id of RULED) {
    await page
      .locator(`#${id} .landing-rule`)
      .evaluate((rule) => rule.scrollIntoView({ block: "center", behavior: "instant" }));
    await expect.poll(() => ruleDrawn(page, id), { message: id }).toBeGreaterThan(0.98);
  }
});

test("with reduced motion a rule is full the moment it enters", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const id of RULED) {
    await page
      .locator(`#${id} .landing-rule`)
      .evaluate((rule) => rule.scrollIntoView({ block: "end", behavior: "instant" }));
    expect(await ruleDrawn(page, id), id).toBeGreaterThan(0.98);
  }
});

test("without JavaScript the rules are full and the headline shows", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/");
  await expect(headline(page)).toHaveText(landingCopy.headline);
  expect(await ruleDrawn(page, "start")).toBeGreaterThan(0.98);
  await context.close();
});

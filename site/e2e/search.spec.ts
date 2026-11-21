import { existsSync, readdirSync, readFileSync } from "node:fs";
import { expect, type Locator, type Page, type Request, test } from "@playwright/test";
import { galleryEntries } from "../src/lib/gallery";
import { SEARCH_AREAS, SEARCH_UNAVAILABLE } from "../src/lib/search-index";
import { pageViolations } from "./axe";

const BAR = "/docs/comparison/bar/";
const DATA_TABLE = "/docs/tables/data-table/";

const trigger = (page: Page) => page.locator("[data-search-trigger]");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Search the site" });
const input = (page: Page) => page.getByRole("combobox", { name: "Search the site" });
const status = (page: Page) => dialog(page).getByRole("status");
const options = (page: Page) => dialog(page).getByRole("option");
const group = (page: Page, name: string) => dialog(page).getByRole("group", { name, exact: true });

/** The toggle chord for the platform the page reports: Meta+K on Apple platforms, Ctrl+K elsewhere. */
async function toggleChord(page: Page): Promise<string> {
  const apple = await page.evaluate(() => {
    const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
    return /mac|iphone|ipad|ipod/i.test(data?.platform || navigator.platform);
  });
  return apple ? "Meta+K" : "Control+K";
}

/** Loads a page and waits until the search trigger is wired. */
async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await expect(trigger(page)).toHaveAttribute("data-search-ready", "");
}

/** Waits until the results on screen are the ones for `query`. */
async function resultsFor(page: Page, query: string) {
  await expect(status(page)).toHaveText(new RegExp(`^\\d+ results? for “${query}”$`));
}

/** Opens search from the trigger and types a query, waiting for its results. */
async function searchFor(page: Page, query: string) {
  await trigger(page).click();
  await expect(input(page)).toBeFocused();
  await input(page).fill(query);
  await resultsFor(page, query);
}

function collectConsole(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
    if (message.type() === "warning") warnings.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return { errors, warnings };
}

/**
 * The built gallery entry page whose own demo spec is a sankey, if the gallery
 * has one. Only the entry's article is read: the tiles under it embed other
 * entries' specs, the lead sankey among them.
 */
function sankeyExamplePath(): string | undefined {
  const examples = new URL("../dist/examples/", import.meta.url);
  if (!existsSync(examples)) return undefined;
  const slug = readdirSync(examples).find((entry) => {
    const file = new URL(`${entry}/index.html`, examples);
    if (!existsSync(file)) return false;
    const article = /<article\b[^>]*data-gallery-entry[\s\S]*?<\/article>/.exec(
      readFileSync(file, "utf8"),
    )?.[0];
    return /"type":\s*"sankey"/.test(article ?? "");
  });
  return slug ? `/examples/${slug}/` : undefined;
}

test.describe("opening and closing", () => {
  test("the toggle chord opens the dialog with focus in the input, and closes it again", async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    const chord = await toggleChord(page);
    await page.keyboard.press(chord);
    await expect(dialog(page)).toBeVisible();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press(chord);
    await expect(dialog(page)).toBeHidden();
  });

  test('"/" opens the dialog, and typing "/" in its input stays in the input', async ({ page }) => {
    await gotoReady(page, BAR);
    await page.keyboard.press("/");
    await expect(input(page)).toBeFocused();
    await page.keyboard.type("a/b");
    await expect(input(page)).toHaveValue("a/b");
    await expect(dialog(page)).toBeVisible();
  });

  test('"/" typed in a table demo\'s search box does not open search', async ({ page }) => {
    await gotoReady(page, DATA_TABLE);
    const demo = page.locator('.demo[data-demo="tables/basic"]');
    await demo.scrollIntoViewIfNeeded();
    const tableSearch = demo.getByRole("searchbox", { name: "Search table" });
    await tableSearch.click();
    await page.keyboard.type("/");
    await expect(tableSearch).toHaveValue("/");
    await expect(dialog(page)).toBeHidden();
  });

  test("Escape closes the dialog and focus returns to the trigger", async ({ page }) => {
    await gotoReady(page, BAR);
    await trigger(page).click();
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
  });

  test("Escape returns focus to the article link that had it when search opened", async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    const link = page.getByRole("main").getByRole("link").first();
    await link.focus();
    await page.keyboard.press("/");
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(link).toBeFocused();
  });

  test("text typed before the index arrives is searched once it does", async ({ page }) => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/pagefind/pagefind.js", async (route) => {
      await held;
      await route.continue();
    });
    await gotoReady(page, BAR);
    await page.keyboard.press("/");
    await page.keyboard.type("sankey");
    await expect(dialog(page).getByText("Searching…")).toBeVisible();
    release();
    await resultsFor(page, "sankey");
    await expect(dialog(page).getByText("Searching…")).toBeHidden();
  });

  test("closing mid-search and reopening shows the results for what is in the input", async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    await page.keyboard.press("/");
    await page.keyboard.type("sankey");
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await page.keyboard.press("/");
    await expect(input(page)).toHaveValue("sankey");
    await resultsFor(page, "sankey");
    await expect(group(page, "Visualizations")).toBeVisible();
  });
});

test.describe("results", () => {
  test('"sankey" lists its groups in area order, with the sankey page under Visualizations', async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    await searchFor(page, "sankey");
    // Each group's name is the visible heading it is labelled by.
    const names = await dialog(page)
      .getByRole("group")
      .evaluateAll((groups) =>
        groups.map(
          (element) =>
            document.getElementById(element.getAttribute("aria-labelledby") ?? "")?.textContent,
        ),
      );
    expect(names.length).toBeGreaterThan(1);
    expect(names).toEqual(SEARCH_AREAS.filter((area) => names.includes(area)));
    const sankey = group(page, "Visualizations").getByRole("option", {
      name: "Sankey",
      exact: true,
    });
    await expect(sankey).toHaveAttribute("href", /^\/docs\/flow\/sankey\/(#.*)?$/);
  });

  test('Enter on "sankey" goes to the best match, the sankey page, not the first group\'s first result', async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    await searchFor(page, "sankey");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/docs/flow/sankey/");
  });

  test("Enter pressed while a newer query loads follows that query's best result", async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    await searchFor(page, "bar chart");
    await input(page).fill("sankey");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.pathname === "/docs/flow/sankey/");
  });

  test('typing "san" then "sankey" leaves no result from "san" on screen', async ({ page }) => {
    await gotoReady(page, BAR);
    await trigger(page).click();
    await input(page).pressSequentially("san");
    await resultsFor(page, "san");
    await input(page).pressSequentially("key");
    await resultsFor(page, "sankey");
    for (const text of await options(page).allTextContents()) {
      if (/^Show all \d+$/.test(text)) continue;
      expect(text).toMatch(/sankey/i);
    }
  });

  test("a gallery entry's title finds its page under Examples", async ({ page }) => {
    const entry = galleryEntries[0];
    expect(entry, "the gallery has an entry").toBeDefined();
    await gotoReady(page, BAR);
    await searchFor(page, entry?.title ?? "");
    const option = group(page, "Examples").getByRole("option", { name: entry?.title });
    await expect(option).toHaveAttribute("href", new RegExp(`^/examples/${entry?.slug}/`));
  });

  test('"sankey" lists the sankey gallery entry under Examples', async ({ page }) => {
    const example = sankeyExamplePath();
    expect(example, "a gallery entry in dist/examples/ has a sankey demo spec").toBeTruthy();
    await gotoReady(page, BAR);
    await searchFor(page, "sankey");
    const hrefs = await group(page, "Examples")
      .getByRole("option")
      .evaluateAll((all) => all.map((option) => option.getAttribute("href")));
    expect(hrefs).toEqual(expect.arrayContaining([expect.stringMatching(`^${example}`)]));
  });

  test("ArrowDown moves the active result and Enter goes to it", async ({ page }) => {
    await gotoReady(page, BAR);
    await searchFor(page, "sankey");
    const field = input(page);
    const first = await field.getAttribute("aria-activedescendant");
    expect(first).toBeTruthy();
    await page.keyboard.press("ArrowDown");
    await expect(field).not.toHaveAttribute("aria-activedescendant", first ?? "");
    const activeId = (await field.getAttribute("aria-activedescendant")) ?? "";
    const active = page.locator(`[id="${activeId}"]`);
    await expect(active).toHaveAttribute("aria-selected", "true");
    const href = (await active.getAttribute("href")) ?? "";
    expect(href).toMatch(/^\//);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => `${url.pathname}${url.hash}` === href);
  });

  test("Show all adds the rest of a group's results and highlights the first new one", async ({
    page,
  }) => {
    await gotoReady(page, BAR);
    await searchFor(page, "sankey");
    const reference = group(page, "Reference");
    const more = reference.getByRole("option", { name: /^Show all \d+$/ });
    const total = Number((await more.textContent())?.match(/\d+/)?.[0]);
    const shownBefore = await reference.getByRole("option").count();
    expect(shownBefore - 1).toBeLessThan(total);
    await more.click();
    await expect(reference.getByRole("option")).toHaveCount(total);
    const firstNew = reference.getByRole("option").nth(shownBefore - 1);
    await expect(firstNew).toHaveAttribute("aria-selected", "true");
    await expect(input(page)).toHaveAttribute(
      "aria-activedescendant",
      (await firstNew.getAttribute("id")) ?? "",
    );
    await expect(input(page)).toBeFocused();
  });

  test("a query with no matches says so", async ({ page }) => {
    await gotoReady(page, BAR);
    await trigger(page).click();
    await input(page).fill("wombat");
    await expect(dialog(page).getByText("No results for “wombat”")).toBeVisible();
    await expect(status(page)).toHaveText("No results for “wombat”");
  });

  test("when pagefind.js cannot load, the dialog says so and the console says why, once", async ({
    page,
  }) => {
    const { errors, warnings } = collectConsole(page);
    await page.route("**/pagefind/pagefind.js", (route) => route.fulfill({ status: 404 }));
    await gotoReady(page, BAR);
    await trigger(page).click();
    await expect(dialog(page).getByText(SEARCH_UNAVAILABLE)).toBeVisible();
    expect(warnings.filter((warning) => warning.includes("/pagefind/pagefind.js"))).toHaveLength(1);
    expect(errors.filter((error) => !error.includes("404"))).toEqual([]);
  });
});

test.describe("loading and layout", () => {
  test("no search code or index loads before the trigger is hovered, and hovering preloads both", async ({
    page,
  }) => {
    const requests: string[] = [];
    const isSearchCode = (request: Request) => /\/pagefind\/|search-dialog/.test(request.url());
    page.on("request", (request) => {
      if (isSearchCode(request)) requests.push(request.url());
    });
    await gotoReady(page, BAR);
    await page.waitForLoadState("networkidle");
    expect(requests).toEqual([]);
    const dialogChunk = page.waitForRequest(/search-dialog/);
    const index = page.waitForRequest(/\/pagefind\/pagefind\.js$/);
    await trigger(page).hover();
    await dialogChunk;
    await index;
  });

  for (const path of [BAR, "/", "/blog/"]) {
    test(`nothing shifts on ${path} across load, open, typing and close`, async ({ page }) => {
      await gotoReady(page, path);
      // Fonts settle before the baseline, so a later font swap is not mistaken
      // for the dialog moving the page. This is what the page looks like at rest.
      await page.evaluate(() => document.fonts.ready);
      const snapshot = () =>
        page.evaluate(() => {
          const box = document.querySelector("body > header")?.getBoundingClientRect();
          return {
            viewport: document.documentElement.clientWidth,
            scrollY: window.scrollY,
            header: box ? [box.x, box.y, box.width] : null,
          };
        });
      const before = await snapshot();
      await page.keyboard.press(await toggleChord(page));
      await expect(input(page)).toBeFocused();
      const open = await snapshot();
      await input(page).pressSequentially("sankey");
      await resultsFor(page, "sankey");
      await input(page).pressSequentially(" spec");
      await resultsFor(page, "sankey spec");
      const typed = await snapshot();
      await page.keyboard.press("Escape");
      await expect(dialog(page)).toBeHidden();
      const after = await snapshot();
      // The dialog is an overlay: the page under it keeps its layout, the
      // viewport keeps its width (no scrollbar appearing or leaving), and the
      // reader keeps their place. The header is the anchor rather than the
      // article text, because the landing hero animates on its own schedule.
      for (const [label, state] of [
        ["open", open],
        ["typing", typed],
        ["closed", after],
      ] as const) {
        expect(state.viewport, label).toBe(before.viewport);
        expect(state.scrollY, label).toBe(before.scrollY);
        expect(state.header, label).toEqual(before.header);
      }
    });
  }

  test("the header links keep their boxes when the trigger is wired and shown", async ({
    browser,
  }, testInfo) => {
    const boxes = async (javaScriptEnabled: boolean) => {
      const context = await browser.newContext({ ...testInfo.project.use, javaScriptEnabled });
      try {
        const page = await context.newPage();
        await page.goto(BAR);
        if (javaScriptEnabled) {
          await expect(trigger(page)).toHaveAttribute("data-search-ready", "");
        }
        await page.evaluate(() => document.fonts.ready);
        const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
        const all: Locator[] = await links.all();
        return await Promise.all([...all, trigger(page)].map((link) => link.boundingBox()));
      } finally {
        await context.close();
      }
    };
    expect(await boxes(true)).toEqual(await boxes(false));
  });
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe passes with the dialog open and showing results, in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await gotoReady(page, BAR);
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));
    await searchFor(page, "sankey");
    await expect(group(page, "Visualizations")).toBeVisible();
    expect(await pageViolations(page)).toEqual([]);
  });
}

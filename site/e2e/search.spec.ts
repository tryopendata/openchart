import { expect, type Locator, type Page, type Request, test } from "@playwright/test";
import { galleryEntries } from "../src/lib/gallery";
import { SEARCH_AREAS, SEARCH_UNAVAILABLE } from "../src/lib/search-index";
import { pageViolations } from "./axe";

const BAR = "/docs/comparison/bar/";
const DATA_TABLE = "/docs/tables/data-table/";

const trigger = (page: Page) => page.locator("[data-search-trigger]");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Search the site" });
const input = (page: Page) => page.getByRole("combobox", { name: "Search the site" });
const group = (page: Page, name: string) => dialog(page).getByRole("group", { name, exact: true });

/** The toggle chord for the platform the page reports: Meta+K on Apple platforms, Ctrl+K elsewhere. */
async function toggleChord(page: Page): Promise<string> {
  const apple = await page.evaluate(() => /mac|iphone|ipad|ipod/i.test(navigator.platform));
  return apple ? "Meta+K" : "Control+K";
}

/** Loads a page and waits until the search trigger is wired. */
async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await expect(trigger(page)).toHaveAttribute("data-search-ready", "");
}

/** Opens search from the trigger and types a query, waiting for its results. */
async function searchFor(page: Page, query: string) {
  await trigger(page).click();
  await expect(input(page)).toBeFocused();
  await input(page).fill(query);
  await expect(input(page)).toHaveAttribute("aria-expanded", "true");
}

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
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
    await page.keyboard.press(await toggleChord(page));
    await expect(input(page)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
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

  test("a gallery entry's title finds its page under Examples", async ({ page }) => {
    const entry = galleryEntries[0];
    expect(entry, "the gallery has an entry").toBeDefined();
    await gotoReady(page, BAR);
    await searchFor(page, entry?.title ?? "");
    const option = group(page, "Examples").getByRole("option", { name: entry?.title });
    await expect(option).toHaveAttribute("href", new RegExp(`^/examples/${entry?.slug}/`));
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

  test("a query with no matches says so", async ({ page }) => {
    await gotoReady(page, BAR);
    await trigger(page).click();
    await input(page).fill("wombat");
    await expect(dialog(page).getByText("No results for “wombat”")).toBeVisible();
    await expect(dialog(page).getByRole("status")).toHaveText("No results for “wombat”");
  });

  test("when pagefind.js cannot load, the dialog says search runs on the built site", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.route("**/pagefind/pagefind.js", (route) => route.fulfill({ status: 404 }));
    await gotoReady(page, BAR);
    await trigger(page).click();
    await expect(dialog(page).getByText(SEARCH_UNAVAILABLE)).toBeVisible();
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

  test("nothing shifts across load, open, typing and close", async ({ page }) => {
    await page.addInitScript(() => {
      const shifts: { value: number; sources: string[] }[] = [];
      const record = (entries: PerformanceEntryList) => {
        for (const entry of entries as (PerformanceEntry & {
          value: number;
          sources?: { node?: Node | null }[];
        })[]) {
          const sources = (entry.sources ?? []).map((source) =>
            source.node instanceof Element
              ? source.node.outerHTML.slice(0, 80)
              : String(source.node),
          );
          shifts.push({ value: entry.value, sources });
        }
      };
      const observer = new PerformanceObserver((list) => record(list.getEntries()));
      observer.observe({ type: "layout-shift", buffered: true });
      const readShifts = () => {
        record(observer.takeRecords());
        return shifts;
      };
      Object.assign(window, { readShifts });
    });
    // The blog index: docs pages already shift on load when site.ts reveals "Copy
    // page" beside "View as Markdown", and the landing hero shifts on a phone;
    // search has no part in either.
    await gotoReady(page, "/blog/");
    await page.keyboard.press(await toggleChord(page));
    await input(page).pressSequentially("sankey");
    await expect(group(page, "Visualizations")).toBeVisible();
    await input(page).pressSequentially(" spec");
    await expect(dialog(page).getByRole("status")).toHaveText(/^\d+ results?$/);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    const shifts = await page.evaluate(() =>
      (window as unknown as { readShifts: () => unknown[] }).readShifts(),
    );
    expect(shifts).toEqual([]);
  });

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

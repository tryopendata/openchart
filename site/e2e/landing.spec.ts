/**
 * Browser tests for the landing page, run on the desktop and mobile projects.
 * They find things by role and name, and by the `data-*` hooks each section
 * stub's contract comment defines (src/components/landing/). Timers that drive
 * the hero and the agent session run on Playwright's clock, so no test sleeps.
 */
import { validateSpec } from "@opendata-ai/openchart-engine";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { agentSession } from "../src/landing/agents";
import { pageViolations } from "./axe";

const BAR = "/docs/comparison/bar/";
const PRESETS = ["essay", "wire", "broadsheet", "terminal"] as const;
const COMPACT_BELOW_PX = 400;

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

async function scrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  await settle(page);
}

/** Scrolls from top to bottom a step at a time, so every lazy island hydrates, then waits for them. */
async function scrollThrough(page: Page) {
  for (let step = 0; step < 400; step += 1) {
    const { y, end, height } = await page.evaluate(() => ({
      y: window.scrollY,
      end: document.documentElement.scrollHeight - window.innerHeight,
      height: window.innerHeight,
    }));
    if (y >= end - 1) break;
    await scrollTo(page, y + height * 0.6);
  }
  await expect(page.locator("astro-island[ssr]")).toHaveCount(0);
}

/** Brings a section into view and waits until its islands (it must have one) have hydrated. */
async function hydrated(section: Locator) {
  await section.scrollIntoViewIfNeeded();
  await expect(section.locator("astro-island").first()).toBeAttached();
  await expect(section.locator("astro-island[ssr]")).toHaveCount(0);
  return section;
}

for (const scheme of ["light", "dark"] as const) {
  test(`the landing page in ${scheme} passes axe after a full scroll, with no console errors`, async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${scheme}\\b`));
    await scrollThrough(page);
    expect(await pageViolations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test.describe("hero desk", () => {
  const desk = (page: Page) => page.locator("#desk");
  const steps = (page: Page) =>
    desk(page).getByRole("list", { name: "Spec steps" }).getByRole("button");
  const pane = (page: Page) => desk(page).locator("[data-hero-spec]");
  const currentStep = (page: Page) =>
    steps(page).evaluateAll((buttons) =>
      buttons.findIndex((button) => button.getAttribute("aria-current") === "step"),
    );

  /** The chart's accessible description and mark count: either changes when the chart does. */
  const chartSignature = (page: Page) =>
    desk(page)
      .locator("[data-hero-chart]")
      .evaluate((host) => {
        const svg = host.querySelector("svg");
        const description = [
          svg?.getAttribute("aria-label"),
          svg?.getAttribute("aria-description"),
          svg?.querySelector("title")?.textContent,
          svg?.querySelector("desc")?.textContent,
        ].join("|");
        return `${description}|${host.querySelectorAll('[class*="oc-mark"]').length}`;
      });

  /** Narrow screens collapse the pane to the changed lines; open it to read the whole spec. */
  async function openFullSpec(page: Page) {
    const toggle = desk(page).getByRole("button", { name: "Show full spec" });
    if (await toggle.isVisible()) await toggle.click();
  }

  async function selectStep(page: Page, index: number) {
    await steps(page).nth(index).click();
    await expect(steps(page).nth(index)).toHaveAttribute("aria-current", "step");
    await openFullSpec(page);
  }

  const addedLines = async (page: Page) =>
    (await pane(page).locator("[data-spec-added]").allTextContents()).map((line) => line.trim());

  test("clicking a step shows the spec through that step and updates the chart; the last shows it all", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(desk(page));
    await expect(steps(page)).toHaveCount(5);

    const added: string[][] = [];
    for (let index = 0; index < 5; index += 1) {
      await selectStep(page, index);
      const lines = await addedLines(page);
      expect(lines.length, `step ${index + 1} marks the lines it adds`).toBeGreaterThan(0);
      added.push(lines);
    }
    const full = (await pane(page).textContent()) ?? "";
    expect(added.flat().filter((line) => !full.includes(line))).toEqual([]);

    await selectStep(page, 0);
    const first = await chartSignature(page);
    await selectStep(page, 1);
    await expect.poll(() => chartSignature(page)).not.toBe(first);
    const throughTwo = (await pane(page).textContent()) ?? "";
    expect(
      [...(added[0] ?? []), ...(added[1] ?? [])].filter((l) => !throughTwo.includes(l)),
    ).toEqual([]);
    expect((added[4] ?? []).filter((line) => throughTwo.includes(line))).toEqual([]);
  });

  test("the sequence advances on its own until Pause stops it", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await hydrated(desk(page));
    const start = await currentStep(page);
    await page.clock.runFor(3_500);
    await expect.poll(() => currentStep(page)).not.toBe(start);

    await desk(page).getByRole("button", { name: "Pause" }).click();
    await expect(desk(page).getByRole("button", { name: "Play" })).toBeVisible();
    const paused = await currentStep(page);
    await page.clock.runFor(10_000);
    expect(await currentStep(page)).toBe(paused);
  });
});

test.describe("with reduced motion", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the hero rests on the final step and never advances", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    const steps = page
      .locator("#desk")
      .getByRole("list", { name: "Spec steps" })
      .getByRole("button");
    await expect(steps).toHaveCount(5);
    await expect(steps.last()).toHaveAttribute("aria-current", "step");
    await hydrated(page.locator("#desk"));
    await page.clock.runFor(10_000);
    await expect(steps.last()).toHaveAttribute("aria-current", "step");
  });

  test("no section is pinned and the page is as tall as its sections", async ({ page }) => {
    await page.goto("/");
    await scrollThrough(page);
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    const layout = await page.evaluate(() => {
      const main = document.querySelector("main");
      const sections = [...document.querySelectorAll<HTMLElement>("[data-landing-section]")];
      return {
        count: sections.length,
        direct: sections.every((section) => section.parentElement === main),
        sum: sections.reduce((total, section) => total + section.getBoundingClientRect().height, 0),
        main: main?.getBoundingClientRect().height ?? 0,
        fixed: [...(main?.querySelectorAll("*") ?? [])].filter(
          (element) => getComputedStyle(element).position === "fixed",
        ).length,
      };
    });
    expect(layout.count).toBe(10);
    expect(layout.direct).toBe(true);
    expect(layout.fixed).toBe(0);
    expect(Math.abs(layout.main - layout.sum)).toBeLessThanOrEqual(layout.count);
  });
});

test("the vocabulary wall filters to one intent, and every tile left links to a docs page", async ({
  page,
}) => {
  await page.goto("/");
  const wall = await hydrated(page.locator("#vocabulary"));
  const tiles = wall.locator("[data-vocabulary-tile]");
  const total = await tiles.count();
  expect(total).toBeGreaterThan(0);

  const distribution = wall.getByRole("button", { name: "Distribution", exact: true });
  await distribution.click();
  await expect(distribution).toHaveAttribute("aria-pressed", "true");
  const visible = tiles.filter({ visible: true });
  const hrefs = () =>
    visible.evaluateAll((nodes) =>
      nodes.map((tile) => tile.querySelector("a[href]")?.getAttribute("href") ?? ""),
    );
  await expect
    .poll(async () => (await hrefs()).filter((href) => !href.startsWith("/docs/distribution/")))
    .toEqual([]);
  const shown = await hrefs();
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.length).toBeLessThan(total);
  for (const href of shown) {
    expect((await page.request.get(href)).status(), href).toBe(200);
  }
});

test("the preset scrub moves through essay, wire, broadsheet and terminal, then lets go", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const section = await hydrated(page.locator("#styles"));
  const name = section.locator("[data-preset-name]");
  const presetShown = async () => {
    const text = ((await name.textContent()) ?? "").toLowerCase();
    return PRESETS.find((preset) => text.includes(preset)) ?? "";
  };

  if (isMobile) {
    // Under 900px wide there is no pin: the presets are buttons.
    for (const preset of PRESETS) {
      await section.getByRole("button", { name: new RegExp(`^${preset}$`, "i") }).click();
      await expect.poll(presetShown).toBe(preset);
    }
    await expect(page.locator(".pin-spacer")).toHaveCount(0);
    return;
  }

  const { top, height } = await page.evaluate(() => ({
    top: (document.getElementById("styles")?.getBoundingClientRect().top ?? 0) + window.scrollY,
    height: window.innerHeight,
  }));
  const nameY = async () => (await name.boundingBox())?.y ?? Number.NaN;

  const seen: string[] = [];
  for (let y = top - height; y <= top + 4 * height; y += height / 10) {
    await scrollTo(page, y);
    const preset = await presetShown();
    if (preset && seen.at(-1) !== preset) seen.push(preset);
  }
  expect(seen).toEqual([...PRESETS]);

  await scrollTo(page, top + height * 0.5);
  const pinnedAt = await nameY();
  await scrollTo(page, top + height * 0.75);
  expect(Math.abs((await nameY()) - pinnedAt), "pinned while scrubbing").toBeLessThan(2);

  await scrollTo(page, top + height * 4);
  const releasedAt = await nameY();
  await scrollTo(page, top + height * 4.25);
  expect(releasedAt - (await nameY()), "scrolls away after the last preset").toBeGreaterThan(
    height * 0.2,
  );
});

test.describe("scroll story", () => {
  const section = (page: Page) => page.locator("#story");
  const steps = (page: Page) => section(page).locator("[data-story-step]");
  /** The live story chart's markup: it changes whenever the story moves the chart. */
  const chartMarkup = (page: Page) =>
    section(page)
      .locator("[data-story-chart] .story-host svg")
      .first()
      .evaluate((svg) => svg.outerHTML);

  /**
   * Scrolls so the step's top sits just past the story's trigger line, as a
   * reader's scroll would. Instant, not the page's smooth scrolling, which is
   * still moving when the frames settle on a loaded machine.
   */
  async function scrollStepToTrigger(page: Page, index: number) {
    await steps(page)
      .nth(index)
      .evaluate((step) => {
        const trigger = innerHeight * (innerWidth >= 1024 ? 0.5 : 0.78);
        scrollBy({ top: step.getBoundingClientRect().top - trigger + 24, behavior: "instant" });
      });
    await settle(page);
  }

  /**
   * Scrolls the step past the trigger until it is current, measuring again on
   * each try, so content above the story that settles late (fonts, islands
   * hydrating) cannot leave the step short of the line.
   */
  async function makeCurrent(page: Page, index: number) {
    await expect(async () => {
      await scrollStepToTrigger(page, index);
      await expect(steps(page).nth(index)).toHaveAttribute("aria-current", "step", {
        timeout: 1000,
      });
    }).toPass();
  }

  test("scrolling makes each paragraph current in turn and each change moves the chart", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(section(page));
    const count = await steps(page).count();
    expect(count).toBe(5);

    await makeCurrent(page, 0);
    let previous = await chartMarkup(page);
    for (let index = 1; index < count; index += 1) {
      await makeCurrent(page, index);
      await expect(section(page).locator('[aria-current="step"]')).toHaveCount(1);
      await expect
        .poll(() => chartMarkup(page), `step ${index + 1} changes the chart`)
        .not.toBe(previous);
      previous = await chartMarkup(page);
    }
  });
});

test.describe("motion bench", () => {
  const section = (page: Page) => page.locator("#motion");
  const nextButton = (page: Page) =>
    section(page).getByRole("button", { name: /^(Next month|Back to June)$/ });
  const months = (page: Page) => section(page).locator("[data-motion-months]");
  const excerpt = (page: Page) => section(page).locator("[data-motion-excerpt]");
  /** The live chart's marks: the count follows the number of months shown. */
  const markCount = (page: Page) =>
    section(page).locator('.motion-chart svg:not(.demo-static) [class*="oc-mark"]').count();

  async function stepThroughTheYear(page: Page) {
    await hydrated(section(page));
    await expect(
      section(page).locator(".motion-chart svg:not(.demo-static)").first(),
    ).toBeVisible();
    const opening = await markCount(page);
    // The spec is the second story: collapsed until the reader opens it.
    await expect(excerpt(page)).toBeHidden();
    await section(page).getByText("View the spec").click();
    await expect(excerpt(page)).toBeVisible();
    await nextButton(page).click();
    await expect(months(page)).toHaveText("Showing January to July");
    await expect(excerpt(page)).toContainText('"data": [ … 7 rows ]');
    await expect.poll(() => markCount(page)).toBeGreaterThan(opening);
    for (let press = 0; press < 5; press += 1) await nextButton(page).click();
    await expect(months(page)).toHaveText("Showing January to December");
    await expect(nextButton(page)).toHaveText("Back to June");
    await nextButton(page).click();
    await expect(months(page)).toHaveText("Showing January to June");
    await expect(excerpt(page)).toContainText('"data": [ … 6 rows ]');
    await expect.poll(() => markCount(page)).toBe(opening);
  }

  test("Next month runs to December and back, and choosing off rewrites the animation field", async ({
    page,
  }) => {
    await page.goto("/");
    await stepThroughTheYear(page);

    const replay = section(page).getByRole("button", { name: "Replay entrance" });
    await expect(replay).toBeEnabled();
    await section(page).getByRole("radio", { name: "off" }).check();
    await expect(excerpt(page)).toContainText('"animation": false');
    await expect(excerpt(page).locator("[data-changed]")).toHaveText(/"animation": false/);
    await expect(replay).toBeDisabled();
    await expect(section(page).getByText("Replay is off while animation is false.")).toBeVisible();
  });

  test("with reduced motion the controls still change the chart, and replay says why it is off", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await stepThroughTheYear(page);
    await expect(section(page).getByRole("button", { name: "Replay entrance" })).toBeDisabled();
    await expect(
      section(page).getByText("Replay is off: your system asks for reduced motion."),
    ).toBeVisible();
  });
});

test.describe("resize frame", () => {
  const section = (page: Page) => page.locator("#responsive");
  const slider = (page: Page) => section(page).getByRole("slider", { name: "Chart width" });
  const valueNow = async (page: Page) => Number(await slider(page).getAttribute("aria-valuenow"));
  /** The library's live chart, not the build-time static SVG it replaces. */
  const liveChart = (page: Page) =>
    section(page).locator("[data-resize-frame] svg:not(.demo-static)").first();
  /**
   * Only the compact layout writes this: it keeps one callout on the line and
   * moves the other (the 2020 low) to a numbered note under the plot.
   */
  const compactNote = (page: Page) => liveChart(page).locator("text.oc-footnotes");

  /** At a starting width of 400px or more the live chart shows both callouts inline. */
  async function expectNotCompactYet(page: Page, start: number) {
    await expect(liveChart(page)).toBeVisible();
    if (start >= COMPACT_BELOW_PX) await expect(compactNote(page)).toHaveCount(0);
  }

  async function expectCompact(page: Page) {
    await expect.poll(() => valueNow(page)).toBeLessThan(COMPACT_BELOW_PX);
    await expect(section(page).locator("[data-resize-breakpoint]")).toHaveText(/^\s*compact\s*$/i);
    await expect(compactNote(page)).toContainText("Low: 0.3% in spring 2020");
    await expect(liveChart(page).locator(".oc-annotation-footnote-number")).toHaveCount(1);
  }

  test("dragging the handle below 400px switches the chart to its compact layout", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(section(page));
    const start = await valueNow(page);
    await expectNotCompactYet(page, start);
    const target = Math.min(360, start - 40);
    const box = await slider(page).boundingBox();
    if (!box) throw new Error("The resize handle has no box: it is not rendered visibly.");
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - (start - target), y, { steps: 12 });
    await page.mouse.up();
    await expectCompact(page);
  });

  test("arrow keys move the handle 20px at a time and reach the compact layout", async ({
    page,
  }) => {
    await page.goto("/");
    await hydrated(section(page));
    const min = Number(await slider(page).getAttribute("aria-valuemin"));
    const start = await valueNow(page);
    await expectNotCompactYet(page, start);
    await slider(page).focus();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => valueNow(page)).toBe(Math.max(min, start - 20));
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => valueNow(page)).toBe(start);
    for (let press = 0; press < 100 && (await valueNow(page)) >= COMPACT_BELOW_PX; press += 1) {
      await page.keyboard.press("ArrowLeft");
    }
    await expectCompact(page);
  });
});

test("the agent session plays to a chart and shows the validator's error at the failing step", async ({
  page,
}) => {
  const [firstError] = validateSpec(agentSession.firstSpec).errors;
  expect(firstError?.message, "agentSession.firstSpec fails validateSpec").toBeTruthy();
  expect(validateSpec(agentSession.fixedSpec).valid, "agentSession.fixedSpec passes").toBe(true);

  await page.clock.install();
  await page.goto("/");
  const agents = await hydrated(page.locator("#agents"));
  await agents.getByRole("button", { name: "Play" }).click();
  await page.clock.runFor(60_000);
  await expect(agents.getByText(firstError?.message ?? "", { exact: false })).toBeVisible();
  // The transcript is condensed: the spec as written waits behind a collapsed disclosure.
  await expect(agents.getByText("Show the spec")).toBeVisible();
  await expect(agents.getByRole("region", { name: /as written$/ })).toBeHidden();
  await expect(agents.locator("[data-agent-chart] svg").first()).toBeVisible();
  // The session ends on the live chart, not the static stand-in, and says so.
  await expect(
    agents.locator(".agent-chart-live svg:not(.demo-static)").first(),
    "the live chart mounted",
  ).toBeAttached();
  await expect(
    agents.getByRole("status").filter({ hasText: "The session has finished" }),
  ).toHaveCount(1);
});

test("the hero and closing install commands switch package managers independently", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.locator("#desk");
  const closing = page.locator("#closing");
  const managers = (section: Locator) => section.getByRole("tablist", { name: "Package manager" });

  await closing.scrollIntoViewIfNeeded();
  await managers(closing).getByRole("tab", { name: "bun" }).click();
  await expect(closing.getByRole("tabpanel")).toContainText("bun add @opendata-ai/openchart-react");
  await expect(
    hero.getByRole("tabpanel").filter({ hasText: "@opendata-ai/openchart-react" }),
  ).toContainText("npm install @opendata-ai/openchart-react");

  await hero.scrollIntoViewIfNeeded();
  await managers(hero).getByRole("tab", { name: "pnpm" }).click();
  await expect(
    hero.getByRole("tabpanel").filter({ hasText: "@opendata-ai/openchart-react" }),
  ).toContainText("pnpm add @opendata-ai/openchart-react");
  await expect(closing.getByRole("tabpanel")).toContainText("bun add @opendata-ai/openchart-react");
});

test("framework tabs switch the install and usage code and share the choice with docs demos", async ({
  page,
}) => {
  await page.goto("/");
  let frameworks = await hydrated(page.locator("#frameworks"));
  const panelText = async () =>
    ((await frameworks.getByRole("tabpanel").textContent()) ?? "").replace(/npm install \S+/, "");

  await frameworks.getByRole("tab", { name: "React", exact: true }).click();
  await expect(frameworks.getByRole("tabpanel")).toContainText(
    "npm install @opendata-ai/openchart-react",
  );
  const reactUsage = await panelText();
  // The code is the second story: its panel is capped near 16rem and scrolls inside.
  const codeHeight = await frameworks
    .getByRole("tabpanel")
    .locator("pre")
    .evaluate((pre) => pre.getBoundingClientRect().height);
  expect(codeHeight).toBeLessThanOrEqual(16 * 16 + 1);
  const vue = frameworks.getByRole("tab", { name: "Vue", exact: true });
  await vue.click();
  await expect(vue).toHaveAttribute("aria-selected", "true");
  await expect(frameworks.getByRole("tabpanel")).toContainText(
    "npm install @opendata-ai/openchart-vue",
  );
  expect(await panelText()).not.toBe(reactUsage);

  await page.goto(BAR);
  // Docs demos keep their code closed until asked; open the first figure's code.
  const demo = page.locator("[data-demo]").first();
  await demo.locator("[data-demo-toggle]").click();
  await expect(demo.locator('[data-demo-panel="vue"]')).toBeVisible();
  await demo.locator('[data-demo-tab="svelte"]').click();
  await page.goto("/");
  frameworks = await hydrated(page.locator("#frameworks"));
  await expect(frameworks.getByRole("tab", { name: "Svelte", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(frameworks.getByRole("tabpanel")).toContainText(
    "npm install @opendata-ai/openchart-svelte",
  );
});

test("at 390px wide nothing scrolls horizontally", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await scrollThrough(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

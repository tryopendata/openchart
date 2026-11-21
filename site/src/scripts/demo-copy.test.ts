// @vitest-environment node
/**
 * The demo Copy buttons, wired on a page that holds real demo figures. The
 * figures are highlighted in Node (Shiki needs Node's fetch), then loaded into a
 * happy-dom page whose clipboard stands in for the browser's. The code stays
 * closed throughout: Copy works without showing it.
 */
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureBar } from "../demos/fixtures/bar";
import { basicChoropleth, divergingChoropleth } from "../demos/maps/choropleth";
import type { DemoDef } from "../demos/types";
import { demoFigureHtml } from "../lib/demo/figure";
import { FRAMEWORK_STORAGE_KEY } from "../lib/demo/framework-choice";
import { frameworkSnippets } from "../lib/demo/snippets";
import { setupDemoCopyButtons } from "./demo-copy";
import { setupFrameworkChoice } from "./framework-choice";

function figureFor(demo: DemoDef, options: { static: boolean; pageShared?: Set<string> }) {
  const { id, spec, title, source } = demo;
  return demoFigureHtml({
    id,
    spec,
    title,
    source,
    height: 320,
    entrance: false,
    tabs: true,
    ...options,
  });
}

const barPage = figureFor(fixtureBar, { static: true });
/**
 * Two maps on one page, so their atlas is written once, in a shared block. They
 * skip their static SVGs: nothing here reads them, and they are slow to draw.
 */
const mapsShared = new Set<string>();
const mapPage = Promise.all(
  [basicChoropleth, divergingChoropleth].map((demo) =>
    figureFor(demo, { static: false, pageShared: mapsShared }),
  ),
).then((figures) => figures.join(""));

async function pageWithFigure(html: Promise<string> = barPage, storedChoice?: string) {
  const window = new Window({ url: "https://openchart.example/docs/" });
  window.document.body.innerHTML = await html;
  if (storedChoice) window.localStorage.setItem(FRAMEWORK_STORAGE_KEY, storedChoice);
  vi.stubGlobal("localStorage", window.localStorage);
  vi.stubGlobal("navigator", window.navigator);
  // framework-choice.ts checks click targets against the global Element, which Node lacks.
  vi.stubGlobal("Element", window.Element);
  const doc = window.document as unknown as Document;
  setupFrameworkChoice(doc);
  setupDemoCopyButtons(doc);
  return window;
}

function copyButton(window: Window, figure: string) {
  const button = window.document.querySelector(`${figure} [data-demo-copy]`);
  if (!button) throw new Error(`No Copy button in ${figure}`);
  return button as unknown as HTMLButtonElement;
}

const statusOf = (window: Window, figure: string) =>
  window.document.querySelector(`${figure} [data-demo-copy-status]`)?.textContent;

/** Picks a code tab the way a reader does, which applies to every figure on the page. */
function chooseTab(window: Window, tab: string, figure = "[data-demo]") {
  const link = window.document.querySelector(`${figure} [data-demo-tab="${tab}"]`);
  if (!link) throw new Error(`No ${tab} tab in ${figure}`);
  (link as unknown as HTMLElement).click();
}

/** Presses Copy with the given tab chosen (Spec when none is given). */
async function clickCopy(window: Window, tab?: string, figure = "[data-demo]") {
  if (tab) chooseTab(window, tab, figure);
  const button = copyButton(window, figure);
  const status = window.document.querySelector(`${figure} [data-demo-copy-status]`);
  button.click();
  await vi.waitFor(() => expect(status?.textContent).not.toBe(""));
  return button;
}

const figureOf = (demo: DemoDef) => `[data-demo="${demo.id}"]`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demo Copy buttons", () => {
  it("is one per figure, revealed once the script runs, while the code stays closed", async () => {
    const window = await pageWithFigure();
    const buttons = [...window.document.querySelectorAll("[data-demo-copy]")];
    expect(buttons.map((button) => (button as unknown as HTMLButtonElement).hidden)).toEqual([
      false,
    ]);
    expect(window.document.querySelector("[data-demo-code]")?.hasAttribute("data-demo-open")).toBe(
      false,
    );
  });

  it("copies the spec by default, as the JSON the Spec panel shows, and announces it", async () => {
    const window = await pageWithFigure();
    expect((await clickCopy(window)).textContent).toBe("Copied");
    expect(JSON.parse(await window.navigator.clipboard.readText())).toEqual(fixtureBar.spec);
    expect(statusOf(window, "[data-demo]")).toBe("Copied the Spec code.");
  });

  it("copies the chosen framework's complete code, data rows included", async () => {
    const window = await pageWithFigure();
    await clickCopy(window, "vue");
    expect(await window.navigator.clipboard.readText()).toBe(
      frameworkSnippets(fixtureBar.spec).vue,
    );
    expect(statusOf(window, "[data-demo]")).toBe("Copied the Vue code.");
  });

  it("returns to Copy and clears the announcement after a moment", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const window = await pageWithFigure();
      const button = await clickCopy(window);
      vi.advanceTimersByTime(2000);
      expect(button.textContent).toBe("Copy");
      expect(statusOf(window, "[data-demo]")).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("copies the framework the reader chose on an earlier page, without a tab being pressed", async () => {
    const window = await pageWithFigure(barPage, "react");
    await clickCopy(window);
    expect(await window.navigator.clipboard.readText()).toBe(
      frameworkSnippets(fixtureBar.spec).react,
    );
    expect(statusOf(window, "[data-demo]")).toBe("Copied the React code.");
  });

  it("announces a repeated copy again", async () => {
    const window = await pageWithFigure();
    await clickCopy(window);
    expect(statusOf(window, "[data-demo]")).toBe("Copied the Spec code.");
    // The region empties at the press and fills again, so a screen reader hears the same words twice.
    copyButton(window, "[data-demo]").click();
    expect(statusOf(window, "[data-demo]")).toBe("");
    await vi.waitFor(() => expect(statusOf(window, "[data-demo]")).toBe("Copied the Spec code."));
  });

  it("opens the code and selects it when the clipboard refuses", async () => {
    const window = await pageWithFigure();
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("Not allowed"));
    expect((await clickCopy(window)).textContent).toBe("Copy failed");
    expect(statusOf(window, "[data-demo]")).toBe(
      "Copy failed. The code is selected; copy it with your keyboard.",
    );
    expect(window.document.querySelector("[data-demo-code]")?.getAttribute("data-demo-open")).toBe(
      "true",
    );
    const shown = window.document.querySelector('[data-demo-panel="spec"] pre')?.textContent;
    expect(window.getSelection()?.toString()).toBe(shown);
  });

  it("points to the Spec tab when a refused framework panel shows abbreviated code", async () => {
    const window = await pageWithFigure();
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("Not allowed"));
    await clickCopy(window, "react");
    expect(statusOf(window, "[data-demo]")).toBe(
      "Copy failed. The code shown is abbreviated; the Spec tab shows the complete spec.",
    );
  });

  it("copies a map's complete spec and code, filling the folded atlas from the shared block", async () => {
    const window = await pageWithFigure(mapPage);
    expect(window.document.querySelectorAll("script[data-demo-shared]").length).toBeGreaterThan(0);
    for (const demo of [basicChoropleth, divergingChoropleth]) {
      const figure = figureOf(demo);
      const shownSpec = window.document.querySelector(`${figure} [data-demo-panel="spec"] pre`);
      expect(shownSpec?.textContent, demo.id).toMatch(
        /\/\* TopoJSON, \d+ arcs; Copy includes it \*\//,
      );
      await clickCopy(window, "spec", figure);
      expect(JSON.parse(await window.navigator.clipboard.readText()), demo.id).toEqual(demo.spec);
      await clickCopy(window, "svelte", figure);
      expect(await window.navigator.clipboard.readText(), demo.id).toBe(
        frameworkSnippets(demo.spec).svelte,
      );
    }
  });

  it("says Copy failed and logs the demo when a shared value block is missing", async () => {
    const window = await pageWithFigure(mapPage);
    for (const block of window.document.querySelectorAll("script[data-demo-shared]")) {
      block.remove();
    }
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await clickCopy(window, "react", figureOf(basicChoropleth))).textContent).toBe(
      "Copy failed",
    );
    expect(logged).toHaveBeenCalledWith(
      `Demo "${basicChoropleth.id}" could not assemble its code to copy.`,
      expect.objectContaining({ message: expect.stringMatching(/no shared value block/) }),
    );
  });
});

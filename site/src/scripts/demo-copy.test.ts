// @vitest-environment node
/**
 * The demo Copy buttons, wired on a page that holds real demo figures. The
 * figures are highlighted in Node (Shiki needs Node's fetch), then loaded into a
 * happy-dom page whose clipboard stands in for the browser's.
 */
import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureBar } from "../demos/fixtures/bar";
import { basicChoropleth, divergingChoropleth } from "../demos/maps/choropleth";
import type { DemoDef } from "../demos/types";
import { demoFigureHtml } from "../lib/demo/figure";
import { frameworkSnippets } from "../lib/demo/snippets";
import { setupDemoCopyButtons } from "./demo-copy";

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

async function pageWithFigure(html: Promise<string> = barPage) {
  const window = new Window();
  window.document.body.innerHTML = await html;
  vi.stubGlobal("navigator", window.navigator);
  setupDemoCopyButtons(window.document as unknown as Document);
  return window;
}

function copyButton(window: Window, panel: string, figure: string) {
  const button = window.document.querySelector(
    `${figure} [data-demo-panel="${panel}"] [data-demo-copy]`,
  );
  if (!button) throw new Error(`No Copy button in the ${panel} panel of ${figure}`);
  return button as unknown as HTMLButtonElement;
}

async function clickCopy(window: Window, panel: string, figure = "figure") {
  const button = copyButton(window, panel, figure);
  button.click();
  await vi.waitFor(() => expect(button.textContent).not.toBe("Copy"));
  return button;
}

const figureOf = (demo: DemoDef) => `figure[data-demo="${demo.id}"]`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("demo Copy buttons", () => {
  it("are revealed once the script runs", async () => {
    const window = await pageWithFigure();
    const buttons = [...window.document.querySelectorAll("[data-demo-copy]")];
    expect(buttons.map((button) => (button as unknown as HTMLButtonElement).hidden)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("copy the Spec panel as the JSON it shows", async () => {
    const window = await pageWithFigure();
    expect((await clickCopy(window, "spec")).textContent).toBe("Copied");
    expect(JSON.parse(await window.navigator.clipboard.readText())).toEqual(fixtureBar.spec);
  });

  it("copy a framework panel's complete code, data rows included", async () => {
    const window = await pageWithFigure();
    await clickCopy(window, "vue");
    expect(await window.navigator.clipboard.readText()).toBe(
      frameworkSnippets(fixtureBar.spec).vue,
    );
  });

  it("say Copy failed when the clipboard refuses", async () => {
    const window = await pageWithFigure();
    vi.spyOn(window.navigator.clipboard, "writeText").mockRejectedValue(new Error("Not allowed"));
    expect((await clickCopy(window, "react")).textContent).toBe("Copy failed");
  });

  it("copy a map's complete spec and code, filling the folded atlas from the shared block", async () => {
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

  it("say Copy failed and log the demo when a shared value block is missing", async () => {
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

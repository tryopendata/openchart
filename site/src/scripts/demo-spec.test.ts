// @vitest-environment node
/** Reading a figure's spec back from a built page, shared values included. */
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { basicChoropleth, divergingChoropleth } from "../demos/maps/choropleth";
import type { DemoDef } from "../demos/types";
import { demoFigureHtml } from "../lib/demo/figure";
import { DemoSpecError, readFigureSpec } from "./demo-spec";

async function mapPage() {
  const pageShared = new Set<string>();
  const figures = await Promise.all(
    [basicChoropleth, divergingChoropleth].map(({ id, spec, title, source }: DemoDef) =>
      demoFigureHtml({
        id,
        spec,
        title,
        source,
        height: 320,
        entrance: false,
        tabs: false,
        static: false,
        pageShared,
      }),
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = figures.join("");
  return window.document as unknown as Document;
}

const figure = (doc: Document, demo: DemoDef) => {
  const element = doc.querySelector(`figure[data-demo="${demo.id}"]`);
  if (!element) throw new Error(`No figure for ${demo.id}`);
  return element;
};

describe("readFigureSpec", () => {
  it("gives each figure its complete spec, filled from the page's shared blocks", async () => {
    const doc = await mapPage();
    expect(doc.querySelectorAll("script[data-demo-shared]").length).toBeGreaterThan(0);
    expect(readFigureSpec(figure(doc, basicChoropleth))).toEqual(basicChoropleth.spec);
    expect(readFigureSpec(figure(doc, divergingChoropleth))).toEqual(divergingChoropleth.spec);
  });

  it("throws, naming the hash, when a shared block is missing from the page", async () => {
    const doc = await mapPage();
    const block = doc.querySelector("script[data-demo-shared]");
    const hash = block?.getAttribute("data-demo-shared") ?? "";
    block?.remove();
    expect(() => readFigureSpec(figure(doc, basicChoropleth))).toThrow(
      new DemoSpecError(`The page has no shared value block ${hash} for this demo's spec.`),
    );
  });
});

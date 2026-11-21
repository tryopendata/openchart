/**
 * A tile's build-time markup, read back the way the page's demo script reads
 * it: the stage it mounts into and the spec `readFigureSpec` returns, with
 * shared values written once per page, at the size the page asks for. Charts
 * show their static files as images; a table or sankey shows a fallback table,
 * a network the placeholder line. Also the fallback tables themselves.
 */
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { readFigureSpec } from "../../../scripts/demo-spec";
import { SANKEY_FLOWS, sankeyFallbackHtml } from "./tile-fallback";
import { type TileOptions, tableFallbackHtml, tileChartHtml } from "./tile-markup";
import { tileSpec } from "./tile-spec";

/**
 * happy-dom drops everything after a `<style>` inside an inline SVG, and map
 * SVGs carry one; nothing here reads styles, so they go before parsing.
 */
const withoutStyles = (html: string) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");

/** A wall's layout: 240 by 180. */
const WALL: TileOptions = { size: { width: 240, height: 180 } };

/** Puts tiles on a page as Vocabulary.astro does, sharing one record of written values. */
function page(demos: string[], options = WALL) {
  const shared = new Set<string>();
  document.body.innerHTML = demos
    .map(
      (demo) =>
        `<li data-demo="wall-${demo}">${withoutStyles(tileChartHtml(demo, shared, options))}</li>`,
    )
    .join("");
  const element = (demo: string) => document.querySelector(`[data-demo="wall-${demo}"]`) as Element;
  return { element };
}

const sources = (element: Element) =>
  [...element.querySelectorAll("img.demo-static")].map((img) => [
    img.getAttribute("data-theme"),
    img.getAttribute("src"),
  ]);

describe("a tile's markup", () => {
  it("holds a demo stage, its static chart as lazy images in both themes, and the spec the demo script reads back whole", () => {
    const { element } = page(["comparison/column-basic"]);
    const stage = element("comparison/column-basic").querySelector("[data-demo-stage]");
    expect(stage?.classList.contains("tile-stage")).toBe(true);
    expect(stage?.getAttribute("style")).toBe("--tile-ratio: 240 / 180");
    expect(sources(element("comparison/column-basic"))).toEqual([
      ["light", "/tiles/comparison--column-basic-240x180-light.svg"],
      ["dark", "/tiles/comparison--column-basic-240x180-dark.svg"],
    ]);
    const img = stage?.querySelector("img");
    expect([
      img?.getAttribute("loading"),
      img?.getAttribute("alt"),
      img?.getAttribute("width"),
    ]).toEqual(["lazy", "", "240"]);
    expect(readFigureSpec(element("comparison/column-basic"))).toEqual(
      tileSpec(getDemo("comparison/column-basic").spec),
    );
  });

  it("draws a second, narrow layout in its own wrapper when the page asks for one", () => {
    const { element } = page(["comparison/column-basic"], {
      size: { width: 900, height: 300 },
      narrow: { width: 440, height: 292 },
    });
    const tile = element("comparison/column-basic");
    expect(tile.querySelector("[data-demo-stage]")?.getAttribute("style")).toBe(
      "--tile-ratio: 900 / 300; --tile-ratio-narrow: 440 / 292",
    );
    const variants = [...tile.querySelectorAll("[data-tile-variant]")].map((variant) => [
      variant.getAttribute("data-tile-variant"),
      [...variant.querySelectorAll("img")].map((img) => img.getAttribute("src")),
    ]);
    expect(variants).toEqual([
      [
        "main",
        [
          "/tiles/comparison--column-basic-900x300-light.svg",
          "/tiles/comparison--column-basic-900x300-dark.svg",
        ],
      ],
      [
        "narrow",
        [
          "/tiles/comparison--column-basic-440x292-light.svg",
          "/tiles/comparison--column-basic-440x292-dark.svg",
        ],
      ],
    ]);
  });

  it("names a specimen that keeps its key in its file, apart from the plain one", () => {
    const { element } = page(["the-spec/transforms-fold"], { ...WALL, spec: { keepKey: true } });
    expect(sources(element("the-spec/transforms-fold"))[0]?.[1]).toBe(
      "/tiles/the-spec--transforms-fold-240x180-key-light.svg",
    );
  });

  it("moves a map's atlas into a shared block, written once however many charts on the page use it", () => {
    const maps = ["maps/choropleth-basic", "maps/symbol-basic"];
    const shared = new Set<string>();
    const html = (demo: string, id: string) =>
      `<li data-demo="${id}">${withoutStyles(tileChartHtml(demo, shared, WALL))}</li>`;
    // The second choropleth stands for another chart on the page drawing the same atlas.
    document.body.innerHTML = [
      html("maps/choropleth-basic", "a"),
      html("maps/symbol-basic", "b"),
      html("maps/choropleth-basic", "c"),
    ].join("");
    // One block per atlas: the choropleth's and the symbol map's basemap differ, the third adds none.
    expect(document.querySelectorAll("script[data-demo-shared]")).toHaveLength(2);
    for (const [id, demo] of [
      ["a", maps[0]],
      ["b", maps[1]],
      ["c", maps[0]],
    ] as const) {
      const element = document.querySelector(`[data-demo="${id}"]`) as Element;
      expect(readFigureSpec(element)).toEqual(tileSpec(getDemo(demo ?? "").spec));
    }
  });

  it("gives a sankey its largest flows and a table its first rows, each captioned by the placeholder line", () => {
    const { element } = page(["flow/sankey-basic", "tables/basic"]);
    const sankey = element("flow/sankey-basic").querySelector("table.tile-table");
    expect(sankey?.querySelectorAll("tbody tr")).toHaveLength(SANKEY_FLOWS);
    expect(sankey?.querySelector("tbody tr")?.textContent).toBe("PetroleumTransportation24.97");
    expect(sankey?.nextElementSibling?.textContent).toBe(
      `${getDemo("flow/sankey-basic").title}. This chart is drawn in the browser.`,
    );
    const table = element("tables/basic").querySelector("table.tile-table");
    expect([...(table?.querySelectorAll("th") ?? [])].map((cell) => cell.textContent)).toEqual([
      "Country",
      "Population",
    ]);
    expect(table?.querySelectorAll("tbody tr")).toHaveLength(5);
    expect(table?.querySelector("tbody tr")?.textContent).toBe("India1,438,069,596");
    expect(element("tables/basic").querySelector("img")).toBeNull();
  });

  it("gives a network only the placeholder line, since it has neither a static chart nor rows", () => {
    const { element } = page(["flow/graph-clusters"]);
    const stage = element("flow/graph-clusters").querySelector("[data-demo-stage]");
    expect(stage?.querySelector("img, table")).toBeNull();
    expect(stage?.querySelector("[data-demo-placeholder]")?.textContent).toBe(
      `${getDemo("flow/graph-clusters").title}. This chart is drawn in the browser.`,
    );
  });

  it("names the tile in the error when its demo does not exist", () => {
    expect(() => tileChartHtml("comparison/no-such-demo", new Set(), WALL)).toThrow(
      /Tile "comparison\/no-such-demo".*No demo has the id/,
    );
  });
});

describe("a sankey tile's fallback", () => {
  it("lists flows largest first in the value channel's format, and nothing for another spec", () => {
    const spec = {
      type: "sankey",
      data: [
        { from: "A", to: "B", qty: 1.234 },
        { from: "A", to: "C", qty: 9.5 },
      ],
      encoding: {
        source: { field: "from" },
        target: { field: "to" },
        value: { field: "qty", format: ".1f" },
      },
    } as never;
    document.body.innerHTML = sankeyFallbackHtml(spec);
    expect([...document.querySelectorAll("tbody tr")].map((row) => row.textContent)).toEqual([
      "AC9.5",
      "AB1.2",
    ]);
    expect(sankeyFallbackHtml(getDemo("comparison/column-basic").spec)).toBe("");
  });
});

describe("a table tile's fallback", () => {
  it("formats numbers by the column format and right-aligns them", () => {
    const spec = {
      type: "table",
      data: [{ ticker: "AAPL", price: 1189.844 }],
      columns: [
        { key: "ticker", label: "Ticker" },
        { key: "price", label: "Price", format: "$,.2f", align: "right" },
      ],
    } as never;
    document.body.innerHTML = tableFallbackHtml(spec);
    expect(document.querySelector("tbody td.tile-table-number")?.textContent).toBe("$1,189.84");
  });

  it("leaves out a column that holds series, which a sparkline draws", () => {
    document.body.innerHTML = tableFallbackHtml(tileSpec(getDemo("tables/sparkline-columns").spec));
    expect([...document.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual([
      "Ticker",
    ]);
  });

  it("escapes cell text", () => {
    const spec = {
      type: "table",
      data: [{ name: "<b>A&B</b>" }],
      columns: [{ key: "name", label: "Name" }],
    } as never;
    expect(tableFallbackHtml(spec)).toContain("&lt;b&gt;A&amp;B&lt;/b&gt;");
  });
});

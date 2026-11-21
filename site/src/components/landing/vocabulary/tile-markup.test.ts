/**
 * A wall tile's build-time markup, read back the way the page's demo script
 * reads it: the stage it mounts into and the spec `readFigureSpec` returns,
 * with shared values written once per page. Also the slimming of the static
 * SVGs and the table fallback a reader without JavaScript sees.
 */
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { readFigureSpec } from "../../../scripts/demo-spec";
import { slimSvg, tableFallbackHtml, tileChartHtml } from "./tile-markup";
import { tileSpec } from "./tile-spec";

/**
 * happy-dom drops everything after a `<style>` inside an inline SVG, and map
 * SVGs carry one; nothing here reads styles, so they go before parsing.
 */
const withoutStyles = (html: string) => html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "");

const tile = (demo: string, intent = demo.split("/")[0] ?? "") => ({
  demo,
  intent: intent as never,
  label: demo,
  href: `/docs/${demo}/`,
});

/** Puts tiles on a page as Vocabulary.astro does, sharing one record of written values. */
function page(demos: string[]) {
  const shared = new Set<string>();
  document.body.innerHTML = demos
    .map(
      (demo) =>
        `<li data-demo="wall-${demo}">${withoutStyles(tileChartHtml(tile(demo), shared))}</li>`,
    )
    .join("");
  const element = (demo: string) => document.querySelector(`[data-demo="wall-${demo}"]`) as Element;
  return { element };
}

describe("a tile's markup", () => {
  it("holds a demo stage and the tile spec the demo script reads back whole", () => {
    const { element } = page(["comparison/column-basic"]);
    const stage = element("comparison/column-basic").querySelector("[data-demo-stage]");
    expect(stage?.classList.contains("wall-stage")).toBe(true);
    expect(stage?.querySelectorAll("svg.demo-static")).toHaveLength(2);
    expect(readFigureSpec(element("comparison/column-basic"))).toEqual(
      tileSpec(getDemo("comparison/column-basic").spec),
    );
  });

  it("moves a map's atlas into a shared block, written once however many charts on the page use it", () => {
    const maps = ["maps/choropleth-basic", "maps/symbol-basic"];
    const shared = new Set<string>();
    const html = (demo: string, id: string) =>
      `<li data-demo="${id}">${withoutStyles(tileChartHtml(tile(demo), shared))}</li>`;
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

  it("gives a sankey the placeholder line naming the chart, and a table its first rows", () => {
    const { element } = page(["flow/sankey-basic", "tables/basic"]);
    const placeholder = element("flow/sankey-basic").querySelector("[data-demo-placeholder]");
    expect(placeholder?.textContent).toBe(
      `${getDemo("flow/sankey-basic").title}. This chart is drawn in the browser.`,
    );
    const table = element("tables/basic").querySelector("table.wall-table");
    expect([...(table?.querySelectorAll("th") ?? [])].map((cell) => cell.textContent)).toEqual([
      "Country",
      "Population",
    ]);
    expect([...(table?.querySelectorAll("tbody tr") ?? [])].map((row) => row.textContent)).toEqual([
      "India1,438,069,596",
      "China1,410,710,000",
    ]);
    // The table keeps the placeholder line every stage without a static SVG carries, as its caption.
    expect(table?.nextElementSibling?.matches("p[data-demo-placeholder]")).toBe(true);
    expect(table?.nextElementSibling?.textContent).toBe(
      `${getDemo("tables/basic").title}. This chart is drawn in the browser.`,
    );
  });

  it("names the tile in the error when its demo does not exist", () => {
    expect(() => tileChartHtml(tile("comparison/no-such-demo"), new Set())).toThrow(
      /tile "comparison\/no-such-demo".*No demo has the id/,
    );
  });
});

describe("slimming a tile's SVG", () => {
  it("keeps data-theme, the placeholder hook and referenced ids, and drops the rest", () => {
    const svg =
      '<svg class="demo-static" data-theme="dark" data-mark-count="3" aria-labelledby="t"><title id="t">x</title>' +
      '<clipPath id="clip"></clipPath><g id="loose" data-key="a" clip-path="url(#clip)" data-flag></g></svg>' +
      '<p data-demo-placeholder class="demo-placeholder">x</p>';
    expect(slimSvg(svg)).toBe(
      '<svg class="demo-static" data-theme="dark" aria-labelledby="t"><title id="t">x</title>' +
        '<clipPath id="clip"></clipPath><g clip-path="url(#clip)"></g></svg>' +
        '<p data-demo-placeholder class="demo-placeholder">x</p>',
    );
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
    expect(document.querySelector("tbody td.wall-table-number")?.textContent).toBe("$1,189.84");
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

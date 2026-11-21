/**
 * The files static tiles are shown from: their names, which tell every size,
 * specimen and theme apart, and their content, a self-contained SVG laid out at
 * the request's size, or nothing for a chart drawn only in the browser.
 */
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { tileFileName, tileFileSvg, tileFileUrl, uniqueRequests } from "./tile-files";

const waffle = { demo: "gallery/electricity-waffle", size: { width: 438, height: 438 } };

describe("a tile file", () => {
  it("is named by demo, size, specimen and theme", () => {
    expect(tileFileName(waffle, "light")).toBe("gallery--electricity-waffle-438x438-light");
    expect(tileFileUrl({ ...waffle, spec: { keepKey: true } }, "dark")).toBe(
      "/tiles/gallery--electricity-waffle-438x438-key-dark.svg",
    );
    expect(tileFileName({ ...waffle, spec: { table: { rows: 6, columns: 3 } } }, "light")).toBe(
      "gallery--electricity-waffle-438x438-t6x3-light",
    );
  });

  it("is a standalone SVG at the request's size, with a waffle's cells merged into paths", () => {
    const svg = tileFileSvg(waffle, "dark") ?? "";
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('viewBox="0 0 438 438"');
    expect(svg).not.toMatch(/\sdata-(?!theme)[\w-]+=/);
    // 100 cells in six colors draw as a handful of paths, not 100 rects.
    expect((svg.match(/<rect\b/g) ?? []).length).toBeLessThan(10);
  });

  it("leaves the demo's own spec as authored, which the entry page's Copy gives the reader", () => {
    const layered = { demo: "gallery/inflation-reference", size: { width: 438, height: 292 } };
    const before = JSON.stringify(getDemo(layered.demo).spec);
    tileFileSvg(layered, "light");
    expect(JSON.stringify(getDemo(layered.demo).spec)).toBe(before);
  });

  it("is not written for a chart without a static renderer", () => {
    expect(tileFileSvg({ demo: "flow/sankey-basic", size: waffle.size }, "light")).toBeNull();
    expect(tileFileSvg({ demo: "tables/basic", size: waffle.size }, "light")).toBeNull();
  });

  it("is written once however many tiles ask for it", () => {
    expect(
      uniqueRequests([waffle, { ...waffle }, { ...waffle, size: { width: 1, height: 1 } }]),
    ).toHaveLength(2);
  });
});

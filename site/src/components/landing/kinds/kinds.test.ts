/**
 * The kinds grid's tiles point at demos that exist and docs pages that exist,
 * cite a named source, cover the five kinds the section promises, and have
 * exactly one dominant tile.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { kindsTiles } from "./kinds";

/** The .mdx file behind a docs URL; vitest runs from site/. */
const docsFile = (href: string) =>
  join("src/content/docs", `${href.replace(/^\/docs\//, "").replace(/\/$/, "")}.mdx`);

describe("the kinds tiles", () => {
  it.each(kindsTiles.map((tile) => [tile.demo, tile] as const))(
    "%s exists, links to a docs page and cites a named source",
    (_, tile) => {
      const demo = getDemo(tile.demo);
      expect(existsSync(docsFile(tile.href)), tile.href).toBe(true);
      // A newsroom cites a named source; "Illustrative data" does not belong on this page.
      expect(demo.source.label).not.toMatch(/illustrative/i);
    },
  );

  it("show a map, a table, a sankey, a tile map and a bar list, with one dominant tile", () => {
    const types = kindsTiles.map((tile) => (getDemo(tile.demo).spec as { type?: string }).type);
    expect(types.sort()).toEqual(["barlist", "map", "sankey", "table", "tilemap"]);
    expect(kindsTiles.filter((tile) => tile.place === "dominant")).toHaveLength(1);
    expect(kindsTiles[0]?.place).toBe("dominant");
  });

  it("fill every row at two and three columns, so no row ends on an empty cell", () => {
    // Cells each place takes: [at two columns, at three columns]. The dominant
    // tile's 2x2 at three columns is four cells.
    const cells = { dominant: [2, 4], side: [1, 1], bottom: [2, 1], "bottom-wide": [2, 2] } as const;
    const total = (columns: 0 | 1) =>
      kindsTiles.reduce((sum, tile) => sum + cells[tile.place][columns], 0);
    expect(total(0) % 2).toBe(0);
    expect(total(1) % 3).toBe(0);
  });
});

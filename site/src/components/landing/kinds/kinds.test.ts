/**
 * The kinds grid's tiles point at demos that exist and docs pages that exist,
 * cover the five kinds the section promises, and have exactly one dominant tile.
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
    "%s exists and links to a docs page",
    (_, tile) => {
      expect(() => getDemo(tile.demo)).not.toThrow();
      expect(existsSync(docsFile(tile.href)), tile.href).toBe(true);
    },
  );

  it("show a map, a table, a sankey, a tile map and a bar list, with one dominant tile", () => {
    const types = kindsTiles.map((tile) => (getDemo(tile.demo).spec as { type?: string }).type);
    expect(types.sort()).toEqual(["barlist", "map", "sankey", "table", "tilemap"]);
    expect(kindsTiles.filter((tile) => tile.size === "dominant")).toHaveLength(1);
    expect(kindsTiles[0]?.size).toBe("dominant");
  });
});

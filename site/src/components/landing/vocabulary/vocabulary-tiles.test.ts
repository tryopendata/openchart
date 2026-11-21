/**
 * The wall's tile list against the real demos and the docs page list: every
 * tile draws a registered, valid demo and links to a page the catalog builds,
 * and the wall covers every Visualizations section. Also the wall's wrappers
 * over the shared tile modules: its size, its hash key and its error context.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { catalogPageIds } from "../../../../tests/catalog-pages";
import { getDemo } from "../../../demos/registry";
import { type VocabularyTile, vocabularyTiles } from "../../../landing/vocabulary";
import { validateDemo } from "../../../lib/demo/validate";
import { tileChartHtml } from "./tile-markup";
import { tileScale } from "./tile-scale";
import { tileSpec } from "./tile-spec";
import { parseWallHash, WALL_INTENTS, wallHash } from "./wall-filter";

const pageIdOf = (href: string) => /^\/docs\/([a-z0-9-]+\/[a-z0-9-]+)\/$/.exec(href)?.[1];

describe("the vocabulary wall's tiles", () => {
  it("number about two dozen, each demo once", () => {
    expect(vocabularyTiles.length).toBeGreaterThanOrEqual(20);
    expect(vocabularyTiles.length).toBeLessThanOrEqual(28);
    const demos = vocabularyTiles.map((tile) => tile.demo);
    expect(demos.filter((demo, index) => demos.indexOf(demo) !== index)).toEqual([]);
  });

  it.each(vocabularyTiles.map((tile) => [tile.demo, tile] as const))(
    "%s is a registered demo with a valid spec",
    (id) => {
      expect(() => validateDemo(id, getDemo(id).spec)).not.toThrow();
    },
  );

  it.each(vocabularyTiles.map((tile) => [tile.href, tile] as const))(
    "%s is a built docs page in the tile's own section",
    (href, tile) => {
      const id = pageIdOf(href);
      expect(id, `${href} looks like /docs/<section>/<slug>/`).toBeDefined();
      expect(catalogPageIds).toContain(id);
      expect(id?.startsWith(`${tile.intent}/`)).toBe(true);
      expect(existsSync(resolve("src/content/docs", `${id}.mdx`))).toBe(true);
    },
  );

  it("covers every Visualizations section, grouped in sidebar order", () => {
    const runs = vocabularyTiles
      .map((tile) => tile.intent)
      .filter((intent, index, all) => all[index - 1] !== intent);
    expect(runs).toEqual(WALL_INTENTS.map((intent) => intent.id));
  });

  it("gives every tile a label", () => {
    expect(vocabularyTiles.filter((tile) => tile.label.trim() === "")).toEqual([]);
  });

  it.each(vocabularyTiles.map((tile) => [tile.demo] as const))(
    "%s still validates as a tile, with the tiles' tight padding and clear background",
    (id) => {
      const tile = tileSpec(getDemo(id).spec);
      expect(validateSpec(tile).errors).toEqual([]);
      expect((tile as unknown as Record<string, unknown>).theme).toMatchObject({
        spacing: { padding: 4, chromeToChart: 0 },
        colors: { background: "transparent" },
      });
    },
  );
});

describe("the wall's tile wrappers", () => {
  it("lay each chart out at 240 by 180", () => {
    const html = tileChartHtml(vocabularyTiles[0] as VocabularyTile, new Set());
    expect(html).toContain('viewBox="0 0 240 180"');
    expect(tileScale(180)).toBeCloseTo(0.75);
  });

  it("name the wall's tile list in the error when a tile's demo does not exist", () => {
    const tile = { ...(vocabularyTiles[0] as VocabularyTile), demo: "comparison/no-such-demo" };
    expect(() => tileChartHtml(tile, new Set())).toThrow(
      /src\/landing\/vocabulary\.ts: Tile "comparison\/no-such-demo".*No demo has the id/,
    );
  });

  it("keep the filter in #vocabulary=, over the nine Visualizations sections in sidebar order", () => {
    expect(wallHash("maps")).toBe("#vocabulary=maps");
    expect(parseWallHash("#vocabulary=maps")).toBe("maps");
    expect(parseWallHash("#kind=maps")).toBeNull();
    expect(WALL_INTENTS.map((intent) => intent.label)).toEqual([
      "Comparison",
      "Change over time",
      "Part to whole",
      "Distribution",
      "Correlation",
      "Flow and networks",
      "Maps",
      "Tables",
      "Composition",
    ]);
  });
});

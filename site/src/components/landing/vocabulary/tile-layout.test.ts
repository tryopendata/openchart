/**
 * How a tile's chart is drawn: the demo's spec set as a specimen (marks kept,
 * everything that cannot survive at tile size dropped), laid out at the tile
 * size and scaled to the cell.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { vocabularyTiles } from "../../../landing/vocabulary";
import { tileScale } from "./tile-scale";
import { TILE_SVG_SIZE, TILE_TABLE, tileSpec } from "./tile-spec";

type Json = Record<string, unknown>;
const json = (spec: VizSpec) => spec as unknown as Json;
const channel = (spec: VizSpec, name: string) =>
  (json(spec).encoding as Record<string, Json | undefined>)[name];

describe("a tile's spec", () => {
  it.each(vocabularyTiles.map((tile) => [tile.demo] as const))("for %s still validates", (id) => {
    expect(validateSpec(tileSpec(getDemo(id).spec)).errors).toEqual([]);
  });

  it("keeps the data and marks and drops chrome, annotations, labels, axis titles and legends", () => {
    const demo = getDemo("change-over-time/line-basic").spec;
    expect(json(demo).annotations).toBeDefined();
    const tile = tileSpec(demo);
    expect(json(tile).data).toBe(json(demo).data);
    expect(json(tile).mark).toEqual(json(demo).mark);
    expect(json(tile)).not.toHaveProperty("chrome");
    expect(json(tile)).not.toHaveProperty("annotations");
    expect(json(tile)).toMatchObject({
      labels: false,
      endpointLabels: false,
      legend: { show: false },
    });
    for (const axis of ["x", "y"]) {
      const config = (channel(tile, axis)?.axis ?? {}) as Json;
      expect(config).toMatchObject({ title: "" });
      expect(config.tickCount).toBeLessThanOrEqual(3);
    }
  });

  it("hides a color legend and strips each layer of a layered chart", () => {
    const tile = json(tileSpec(getDemo("composition/layer-dual-axis").spec));
    const layers = tile.layer as Json[];
    expect(layers.length).toBeGreaterThan(1);
    for (const layer of layers) {
      expect(layer).not.toHaveProperty("chrome");
      expect(layer).toMatchObject({ labels: false });
    }
    const colored = json(tileSpec(getDemo("correlation/scatter-color").spec));
    expect((colored.encoding as Record<string, Json>).color).toMatchObject({ legend: null });
  });

  it("cuts a table to its first rows and columns", () => {
    const tile = json(tileSpec(getDemo("tables/basic").spec));
    expect(tile.data).toHaveLength(TILE_TABLE.rows);
    expect(tile.columns).toHaveLength(TILE_TABLE.columns);
    expect(tile).not.toHaveProperty("search");
    expect(tile).not.toHaveProperty("pagination");
  });

  it("gives every tile the same tight padding, over any theme the demo sets", () => {
    for (const tile of vocabularyTiles) {
      expect(json(tileSpec(getDemo(tile.demo).spec)).theme, tile.demo).toMatchObject({
        spacing: { padding: 4, chromeToChart: 0 },
      });
    }
  });
});

describe("a live tile's scale", () => {
  it("fits the tile layout width to the cell, down and up", () => {
    expect(tileScale(TILE_SVG_SIZE.width)).toBe(1);
    expect(tileScale(180)).toBeCloseTo(0.75);
    expect(tileScale(300)).toBeCloseTo(1.25);
  });
});

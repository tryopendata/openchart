/**
 * How a tile's chart is drawn: the demo's spec set as a specimen (marks kept,
 * everything that cannot survive at tile size dropped, the key kept when a
 * page asks for it).
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { validateSpec } from "@opendata-ai/openchart-engine";
import { describe, expect, it } from "vitest";
import { getDemo } from "../../../demos/registry";
import { TILE_TABLE, tileSpec } from "./tile-spec";

type Json = Record<string, unknown>;
const json = (spec: VizSpec) => spec as unknown as Json;
const channel = (spec: VizSpec, name: string) =>
  (json(spec).encoding as Record<string, Json | undefined>)[name];

/** One demo of each kind of spec a tile handles: chart, layer, table, network, sankey, map and bar list. */
const SPECIMENS = [
  "comparison/column-basic",
  "change-over-time/line-basic",
  "composition/layer-dual-axis",
  "correlation/scatter-color",
  "tables/sparkline-columns",
  "flow/graph-clusters",
  "flow/sankey-budget",
  "maps/choropleth-basic",
  "comparison/barlist-basic",
];

describe("a tile's spec", () => {
  it.each(SPECIMENS)("for %s still validates", (id) => {
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

  it("keeps a table's first column and the columns that draw, before plain values", () => {
    const tile = json(tileSpec(getDemo("tables/sparkline-columns").spec));
    expect((tile.columns as Json[]).map((column) => column.key)).toEqual(["ticker", "trend"]);
    expect(tile).toMatchObject({ mobileLayout: "scroll", density: "condensed" });
  });

  it("drops a network's legend and node labels, and keeps a sankey's labels on the tile", () => {
    const graph = json(tileSpec(getDemo("flow/graph-clusters").spec));
    expect(graph.legend).toBe(false);
    expect(graph.encoding).not.toHaveProperty("nodeLabel");
    expect(graph.encoding).toHaveProperty("nodeColor");
    const sankey = json(tileSpec(getDemo("flow/sankey-budget").spec));
    expect(sankey).toMatchObject({ nodeLabelAlign: "right", legend: { show: false } });
    // Room on every side for the last column's names and values.
    expect(sankey.theme).toMatchObject({ spacing: { padding: 28 } });
  });

  it("gives every tile but a sankey the same tight padding and a clear background, over any theme the demo sets", () => {
    for (const id of SPECIMENS.filter((specimen) => !specimen.startsWith("flow/sankey"))) {
      expect(json(tileSpec(getDemo(id).spec)).theme, id).toMatchObject({
        spacing: { padding: 4, chromeToChart: 0 },
        colors: { background: "transparent" },
      });
    }
  });
});

describe("a tile that keeps its key", () => {
  it("keeps a chart's legend and endpoint labels and a map's legend, where color carries the finding", () => {
    const lines = json(tileSpec(getDemo("the-spec/transforms-fold").spec, { keepKey: true }));
    expect(lines.endpointLabels).toEqual(
      json(getDemo("the-spec/transforms-fold").spec).endpointLabels,
    );
    expect(lines).not.toHaveProperty("legend");
    expect((lines.encoding as Record<string, Json>).color).not.toHaveProperty("legend");
    const map = json(tileSpec(getDemo("maps/choropleth-basic").spec, { keepKey: true }));
    expect(map).not.toHaveProperty("legend");
    // Everything else a tile drops still goes.
    expect(lines).not.toHaveProperty("chrome");
    expect(lines.labels).toBe(false);
  });

  it("cuts a table to the rows and columns the page asks for", () => {
    const tile = json(tileSpec(getDemo("tables/basic").spec, { table: { rows: 6, columns: 3 } }));
    expect(tile.data).toHaveLength(6);
    expect(tile.columns).toHaveLength(3);
  });
});

import type { VizSpec } from "@opendata-ai/openchart-core";
import { demoSpec } from "../../demos/registry";
import { MAX_NOTES, specNotes } from "./spec-notes";

describe("an entry's spec notes", () => {
  it("name a donut's mark options and its channels, not its paint", () => {
    expect(specNotes(demoSpec("gallery/electricity-donut"))).toEqual([
      { field: "mark", values: ['"arc"', "innerRadius: 64", "centerLabel"] },
      { field: "encoding", values: ["theta", "color"] },
    ]);
  });

  it("add the transforms and annotations that shape a chart", () => {
    expect(specNotes(demoSpec("the-spec/transforms-fold"))).toContainEqual({
      field: "transform",
      values: ["fold"],
    });
    expect(specNotes(demoSpec("change-over-time/line-basic"))).toContainEqual({
      field: "annotations",
      values: ['"text"', '"refline"'],
    });
  });

  it("list a layered chart's marks", () => {
    expect(specNotes(demoSpec("gallery/inflation-reference"))[0]).toEqual({
      field: "layer",
      values: ['"line"', '"rule"'],
    });
  });

  it("read a table's drawn cells and its sort", () => {
    expect(specNotes(demoSpec("gallery/country-table"))).toEqual([
      { field: "type", values: ['"table"'] },
      { field: "columns", values: ["lifeExpectancy.heatmap", "gdpPerCapita.bar"] },
      { field: "sort", values: ['column: "lifeExpectancy"', 'direction: "desc"'] },
    ]);
  });

  it("read a tile map's settings", () => {
    expect(specNotes(demoSpec("maps/tile-basic"))).toEqual([
      { field: "type", values: ['"tilemap"'] },
      { field: "palette", values: ['palette: "blue"'] },
      { field: "valueFormat", values: ['valueFormat: ".1f"'] },
    ]);
  });

  it("stop at four", () => {
    const busy = {
      mark: { type: "line", point: true },
      data: [],
      encoding: { x: { field: "a" } },
      transform: [{ fold: ["a", "b"] }],
      annotations: [{ type: "text" }],
      columns: [{ key: "a", bar: {} }],
    } as unknown as VizSpec;
    expect(specNotes(busy)).toHaveLength(MAX_NOTES);
  });
});

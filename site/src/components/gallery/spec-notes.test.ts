import type { VizSpec } from "@opendata-ai/openchart-core";
import { demoSpec } from "../../demos/registry";
import { MAX_NOTES, specNotes } from "./spec-notes";

describe("an entry's spec notes", () => {
  it("print a mark's options under their paths and each channel with the field it reads", () => {
    expect(specNotes(demoSpec("gallery/energy-sources-donut"))).toEqual([
      {
        field: "mark",
        values: [
          'type: "arc"',
          "innerRadius: 64",
          'centerLabel.text: "74%"',
          'centerLabel.subtitle: "oil and gas"',
        ],
      },
      { field: "encoding", values: ["theta: quads", "color: source"] },
    ]);
  });

  it("print a mark given by name as the name alone", () => {
    expect(specNotes(demoSpec("gallery/electricity-waffle"))[0]).toEqual({
      field: "mark",
      values: ['"waffle"'],
    });
  });

  it("say what each transform reads and where each annotation is anchored", () => {
    expect(specNotes(demoSpec("the-spec/transforms-fold"))).toContainEqual({
      field: "transform",
      values: ['fold: "high", "low"'],
    });
    expect(specNotes(demoSpec("change-over-time/line-basic"))).toContainEqual({
      field: "annotations",
      values: ["text at x 2022-07-01, y 8.5", "refline at y 2"],
    });
  });

  it("list a layered chart's marks in order", () => {
    expect(specNotes(demoSpec("gallery/inflation-reference"))[0]).toEqual({
      field: "layer",
      values: ['[0]: "line"', '[1]: "rule"'],
    });
  });

  it("give a table's drawn cells and its sort under their real paths, without a type note", () => {
    expect(specNotes(demoSpec("gallery/country-table"))).toEqual([
      { field: "columns[1].heatmap", values: ['palette: "blue"'] },
      { field: "columns[2].bar", values: ['color: "#0e7490"'] },
      { field: "sort.column", values: ['"lifeExpectancy"'] },
      { field: "sort.direction", values: ['"desc"'] },
    ]);
  });

  it("give a map's projection and a tile map's settings as values alone", () => {
    expect(specNotes(demoSpec("gallery/unemployment-choropleth"))).toEqual([
      { field: "encoding", values: ["key: id", "color: band"] },
      { field: "geo.projection", values: ['"albersUsa"'] },
    ]);
    expect(specNotes(demoSpec("maps/tile-basic"))).toEqual([
      { field: "palette", values: ['"blue"'] },
      { field: "valueFormat", values: ['".1f"'] },
    ]);
  });

  it("stop at four", () => {
    const busy = {
      mark: { type: "line", point: true },
      data: [],
      encoding: { x: { field: "a" } },
      transform: [{ fold: ["a", "b"] }],
      annotations: [{ type: "text", x: 1 }],
      columns: [{ key: "a", bar: {} }],
    } as unknown as VizSpec;
    expect(specNotes(busy)).toHaveLength(MAX_NOTES);
  });
});

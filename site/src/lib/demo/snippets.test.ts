/** Framework code generated from a spec for the demo code tabs. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
import { basicGraph } from "../../demos/flow/graph";
import { basicSankey } from "../../demos/flow/sankey";
import { basicChoropleth } from "../../demos/maps/choropleth";
import { basicSymbolMap } from "../../demos/maps/symbol-map";
import { basicTileMap } from "../../demos/maps/tile-map";
import { fillFolds } from "./fold-fill";
import { FoldMarkerError } from "./fold-targets";
import { foldedFrameworkSnippets, frameworkSnippets } from "./snippets";

const STYLES = 'import "@opendata-ai/openchart-core/styles.css";';

describe("frameworkSnippets", () => {
  it("returns code for React, Vue, Svelte and vanilla, each importing the styles", () => {
    const snippets = frameworkSnippets(fixtureBar.spec);
    expect(Object.keys(snippets)).toEqual(["react", "vue", "svelte", "vanilla"]);
    for (const code of Object.values(snippets)) expect(code).toContain(STYLES);
  });

  it("uses Chart and createChart for a chart spec", () => {
    const { react, vue, svelte, vanilla } = frameworkSnippets(fixtureBar.spec);
    expect(react).toContain('import { Chart } from "@opendata-ai/openchart-react";');
    expect(react).toContain("<Chart spec={spec} />");
    expect(vue).toContain('import { Chart } from "@opendata-ai/openchart-vue";');
    expect(vue).toContain('<Chart :spec="spec" />');
    expect(svelte).toContain('import { Chart } from "@opendata-ai/openchart-svelte";');
    expect(svelte).toContain("<Chart {spec} />");
    expect(vanilla).toContain('import { createChart } from "@opendata-ai/openchart-vanilla";');
    expect(vanilla).toContain("createChart(container, spec);");
  });

  it("uses DataTable and createTable for a table spec", () => {
    const { react, vanilla } = frameworkSnippets(fixtureTable.spec);
    expect(react).toContain('import { DataTable } from "@opendata-ai/openchart-react";');
    expect(react).toContain('import type { TableSpec } from "@opendata-ai/openchart-core";');
    expect(react).toContain("<DataTable spec={spec} />");
    expect(vanilla).toContain("createTable(container, spec);");
  });

  it("hoists data with more than five rows into a data constant", () => {
    const { react } = frameworkSnippets(fixtureBar.spec);
    expect(react).toContain('const data = [\n  {\n    "region": "North",');
    expect(react).toContain("const spec: ChartSpec = {\n  data,\n");
  });

  it("passes the demo's interaction and renderer as props and as mount options", () => {
    const { react, vue, svelte, vanilla } = frameworkSnippets(fixtureBar.spec, {
      renderer: "canvas",
      interaction: "edit",
    });
    expect(react).toContain('<Chart spec={spec} renderer="canvas" interaction="edit" />');
    expect(vue).toContain('<Chart :spec="spec" renderer="canvas" interaction="edit" />');
    expect(svelte).toContain('<Chart {spec} renderer="canvas" interaction="edit" />');
    expect(vanilla).toContain(
      'createChart(container, spec, { renderer: "canvas", interaction: "edit" });',
    );
  });

  it("passes only the host option the demo sets, and none without them", () => {
    expect(frameworkSnippets(fixtureBar.spec, { interaction: "select" }).react).toContain(
      '<Chart spec={spec} interaction="select" />',
    );
    expect(frameworkSnippets(fixtureBar.spec, {}).vanilla).toContain(
      "createChart(container, spec);",
    );
  });

  it("keeps the host options in the folded code", () => {
    const { shown } = foldedFrameworkSnippets(fixtureBar.spec, { interaction: "edit" });
    expect(shown.svelte).toContain('<Chart {spec} interaction="edit" />');
  });

  it("keeps data with five rows or fewer inline", () => {
    const rows = (fixtureBar.spec as { data: unknown[] }).data.slice(0, 5);
    const spec = { ...fixtureBar.spec, data: rows } as VizSpec;
    const { react } = frameworkSnippets(spec);
    expect(react).not.toContain("const data");
    expect(react).toContain('const spec: ChartSpec = {\n  "mark": "bar",\n  "data": [');
  });
});

describe("foldedFrameworkSnippets", () => {
  it("shows the complete code with the data rows folded into a comment that counts them", () => {
    const full = frameworkSnippets(fixtureBar.spec);
    const { shown } = foldedFrameworkSnippets(fixtureBar.spec);
    const rowsAt = full.react.indexOf("const data = [");
    const rowsEnd = full.react.indexOf("];", rowsAt) + 2;
    const placeholder = "const data = [/* 6 rows, as in the Spec tab; Copy includes them */];";
    expect(shown.react).toBe(
      `${full.react.slice(0, rowsAt)}${placeholder}${full.react.slice(rowsEnd)}`,
    );
    for (const code of Object.values(shown)) expect(code).not.toContain('"North"');
  });

  it("folds five rows or fewer where they stand, saying 1 row for a single row", () => {
    const rows = (fixtureBar.spec as { data: unknown[] }).data.slice(0, 1);
    const { shown } = foldedFrameworkSnippets({ ...fixtureBar.spec, data: rows } as VizSpec);
    expect(shown.vanilla).toContain(
      '  "data": [/* 1 row, as in the Spec tab; Copy includes them */],\n',
    );
    expect(shown.vanilla).not.toContain("const data");
  });

  it.each([
    {
      name: "a geo map's TopoJSON and rows",
      spec: basicChoropleth.spec,
      folded: [/\{\/\* TopoJSON, \d+ arcs; Copy includes it \*\/\}/, /\/\* \d+ rows,/],
    },
    {
      name: "a points layer's rows",
      spec: basicSymbolMap.spec,
      folded: [/"points": \{\n {4}"data": \[\/\* \d+ rows,/],
    },
    {
      name: "a graph's nodes and edges",
      spec: basicGraph.spec,
      folded: [/"nodes": \[\/\* \d+ nodes,/, /"edges": \[\/\* \d+ edges,/],
    },
    { name: "a sankey's rows", spec: basicSankey.spec, folded: [/const data = \[\/\* \d+ rows,/] },
    {
      name: "a tile map's record of values",
      spec: basicTileMap.spec,
      folded: [/"data": \{\/\* \d+ entries,/],
    },
  ])("folds $name, and its template fills back to the complete code", ({ spec, folded }) => {
    const { shown, template, folds } = foldedFrameworkSnippets(spec);
    for (const pattern of folded) expect(shown.react).toMatch(pattern);
    expect(shown.react.length).toBeLessThan(5_000);
    const full = frameworkSnippets(spec);
    for (const id of ["react", "vue", "svelte", "vanilla"] as const) {
      expect(fillFolds(template[id], folds, spec), id).toBe(full[id]);
    }
  });

  it("refuses a spec that contains the text fold markers are made of", () => {
    const spec = { ...fixtureBar.spec, title: "\u0000demo-fold:0" } as VizSpec;
    expect(() => foldedFrameworkSnippets(spec)).toThrow(FoldMarkerError);
  });

  it("matches the complete code for a spec without inline rows", () => {
    const spec = { ...fixtureBar.spec, data: { url: "/orders.csv" } } as unknown as VizSpec;
    const { shown, folds } = foldedFrameworkSnippets(spec);
    expect(shown).toEqual(frameworkSnippets(spec));
    expect(folds).toEqual([]);
  });
});

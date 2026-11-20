/** Framework code generated from a spec for the demo code tabs. */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { describe, expect, it } from "vitest";
import { fixtureBar } from "../../demos/fixtures/bar";
import { fixtureTable } from "../../demos/fixtures/table";
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

  it("keeps data with five rows or fewer inline", () => {
    const rows = (fixtureBar.spec as { data: unknown[] }).data.slice(0, 5);
    const spec = { ...fixtureBar.spec, data: rows } as VizSpec;
    const { react } = frameworkSnippets(spec);
    expect(react).not.toContain("const data");
    expect(react).toContain('const spec: ChartSpec = {\n  "mark": "bar",\n  "data": [');
  });
});

describe("foldedFrameworkSnippets", () => {
  it("is the complete code with the data rows folded into a comment that counts them", () => {
    const full = frameworkSnippets(fixtureBar.spec);
    const folded = foldedFrameworkSnippets(fixtureBar.spec);
    const rowsAt = full.react.indexOf("const data = [");
    const rowsEnd = full.react.indexOf("];", rowsAt) + 2;
    const placeholder = "const data = [/* 6 rows, as in the Spec tab; Copy includes them */];";
    expect(folded.react).toBe(
      `${full.react.slice(0, rowsAt)}${placeholder}${full.react.slice(rowsEnd)}`,
    );
    for (const code of Object.values(folded)) expect(code).not.toContain('"North"');
  });

  it("hoists and folds inline data, saying 1 row for a single row", () => {
    const rows = (fixtureBar.spec as { data: unknown[] }).data.slice(0, 1);
    const { vanilla } = foldedFrameworkSnippets({ ...fixtureBar.spec, data: rows } as VizSpec);
    expect(vanilla).toContain("const data = [/* 1 row,");
    expect(vanilla).toContain("const spec: ChartSpec = {\n  data,\n");
  });

  it("matches the complete code for a spec without inline rows", () => {
    const spec = { ...fixtureBar.spec, data: { url: "/orders.csv" } } as unknown as VizSpec;
    expect(foldedFrameworkSnippets(spec)).toEqual(frameworkSnippets(spec));
  });
});

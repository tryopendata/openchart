/**
 * Turns a spec into complete, runnable code for each framework the library
 * ships a wrapper for, and a display form of the same code with the data rows
 * folded away. The demo code tabs show the folded form and copy the complete one.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isChartSpec, isLayerSpec } from "@opendata-ai/openchart-core";

/** Code for each framework wrapper, keyed by framework. */
export type FrameworkSnippets = { react: string; vue: string; svelte: string; vanilla: string };

/** The names one spec type goes by in the wrappers and the core types. */
type Wrapper = { component: string; mount: string; specType: string };

const WRAPPERS_BY_TYPE: Record<string, Wrapper> = {
  table: { component: "DataTable", mount: "createTable", specType: "TableSpec" },
  graph: { component: "Graph", mount: "createGraph", specType: "GraphSpec" },
  sankey: { component: "Sankey", mount: "createSankey", specType: "SankeySpec" },
  tilemap: { component: "TileMap", mount: "createTileMap", specType: "TileMapSpec" },
  map: { component: "GeoMap", mount: "createGeoMap", specType: "GeoMapSpec" },
  barlist: { component: "BarList", mount: "createBarList", specType: "BarListSpec" },
};
const CHART: Wrapper = { component: "Chart", mount: "createChart", specType: "ChartSpec" };
const LAYER: Wrapper = { ...CHART, specType: "LayerSpec" };

const STYLES_IMPORT = 'import "@opendata-ai/openchart-core/styles.css";';
/** Data with more rows than this moves into its own constant so the spec stays readable. */
const MAX_INLINE_ROWS = 5;

function wrapperFor(spec: VizSpec): Wrapper {
  if (isLayerSpec(spec)) return LAYER;
  if (isChartSpec(spec)) return CHART;
  const type = String((spec as { type?: unknown }).type);
  const wrapper = WRAPPERS_BY_TYPE[type];
  if (!wrapper) throw new TypeError(`No framework wrapper renders a spec of type "${type}".`);
  return wrapper;
}

function hoistedData(spec: VizSpec): unknown[] | null {
  const data = (spec as { data?: unknown }).data;
  return Array.isArray(data) && data.length > MAX_INLINE_ROWS ? data : null;
}

/** The `data` and `spec` constants every snippet starts from, with the rows written out. */
function specDeclarations(spec: VizSpec, specType: string): string {
  const data = hoistedData(spec);
  if (!data) return `const spec: ${specType} = ${JSON.stringify(spec, null, 2)};`;
  return hoistedDeclarations(spec, specType, JSON.stringify(data, null, 2));
}

/** The declarations with the spec's `data` moved into a constant whose value is `dataSource`. */
function hoistedDeclarations(spec: VizSpec, specType: string, dataSource: string): string {
  const { data: _hoisted, ...rest } = spec as VizSpec & { data: unknown };
  const body = JSON.stringify(rest, null, 2).replace(/^\{\n?/, "{\n  data,\n");
  return `const data = ${dataSource};\n\nconst spec: ${specType} = ${body};`;
}

/** The declarations with any data rows folded into a one-line comment that counts them. */
function foldedDeclarations(spec: VizSpec, specType: string): string {
  const data = (spec as { data?: unknown }).data;
  if (!Array.isArray(data)) return specDeclarations(spec, specType);
  const rows = data.length === 1 ? "1 row" : `${data.length} rows`;
  return hoistedDeclarations(
    spec,
    specType,
    `[/* ${rows}, as in the Spec tab; Copy includes them */]`,
  );
}

function imports(name: string, from: string, specType: string): string {
  return [
    `import { ${name} } from "${from}";`,
    `import type { ${specType} } from "@opendata-ai/openchart-core";`,
    STYLES_IMPORT,
  ].join("\n");
}

function reactSnippet(wrapper: Wrapper, declarations: string): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-react", wrapper.specType);
  const body = `export function Example() {\n  return <${wrapper.component} spec={spec} />;\n}`;
  return `${head}\n\n${declarations}\n\n${body}\n`;
}

function vueSnippet(wrapper: Wrapper, declarations: string): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-vue", wrapper.specType);
  const template = `<template>\n  <${wrapper.component} :spec="spec" />\n</template>`;
  return `<script setup lang="ts">\n${head}\n\n${declarations}\n</script>\n\n${template}\n`;
}

function svelteSnippet(wrapper: Wrapper, declarations: string): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-svelte", wrapper.specType);
  return `<script lang="ts">\n${head}\n\n${declarations}\n</script>\n\n<${wrapper.component} {spec} />\n`;
}

function vanillaSnippet(wrapper: Wrapper, declarations: string): string {
  const head = imports(wrapper.mount, "@opendata-ai/openchart-vanilla", wrapper.specType);
  const mount = [
    'const container = document.getElementById("chart");',
    "if (!container) throw new Error('Add <div id=\"chart\"></div> to the page first.');",
    `${wrapper.mount}(container, spec);`,
  ].join("\n");
  return `${head}\n\n${declarations}\n\n${mount}\n`;
}

function snippetsFrom(wrapper: Wrapper, declarations: string): FrameworkSnippets {
  return {
    react: reactSnippet(wrapper, declarations),
    vue: vueSnippet(wrapper, declarations),
    svelte: svelteSnippet(wrapper, declarations),
    vanilla: vanillaSnippet(wrapper, declarations),
  };
}

/**
 * Complete, runnable code that renders this spec in each framework.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper.
 */
export function frameworkSnippets(spec: VizSpec): FrameworkSnippets {
  const wrapper = wrapperFor(spec);
  return snippetsFrom(wrapper, specDeclarations(spec, wrapper.specType));
}

/**
 * The code `frameworkSnippets` returns, for display: the data rows are folded into
 * a one-line comment that counts them, so a page carries each demo's data once.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper.
 */
export function foldedFrameworkSnippets(spec: VizSpec): FrameworkSnippets {
  const wrapper = wrapperFor(spec);
  return snippetsFrom(wrapper, foldedDeclarations(spec, wrapper.specType));
}

/**
 * Turns a spec into complete, runnable code for each framework the library
 * ships a wrapper for, and a display form of the same code with its bulky
 * values folded away. The demo code tabs show the folded form and copy the complete one.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isChartSpec, isLayerSpec } from "@opendata-ai/openchart-core";
import type { DemoMountOptions } from "../../demos/types";
import { foldTargets, jsonWithMarkers, showFolds } from "./fold-targets";
import type { SpecPath } from "./markup";

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

/** Writes a value as the indented JSON a snippet shows. */
type JsonWriter = (value: unknown) => string;

const plainJson: JsonWriter = (value) => JSON.stringify(value, null, 2);

function hoistedData(spec: VizSpec): unknown[] | null {
  const data = (spec as { data?: unknown }).data;
  return Array.isArray(data) && data.length > MAX_INLINE_ROWS ? data : null;
}

/** The `data` and `spec` constants every snippet starts from, each value written by `json`. */
function specDeclarations(spec: VizSpec, specType: string, json: JsonWriter): string {
  const data = hoistedData(spec);
  if (!data) return `const spec: ${specType} = ${json(spec)};`;
  const { data: _hoisted, ...rest } = spec as VizSpec & { data: unknown };
  const body = json(rest).replace(/^\{\n?/, "{\n  data,\n");
  return `const data = ${json(data)};\n\nconst spec: ${specType} = ${body};`;
}

function imports(name: string, from: string, specType: string): string {
  return [
    `import { ${name} } from "${from}";`,
    `import type { ${specType} } from "@opendata-ai/openchart-core";`,
    STYLES_IMPORT,
  ].join("\n");
}

/** The demo's host options as name and value pairs, in a fixed order; empty when it sets none. */
type HostOptions = readonly (readonly [name: string, value: string])[];

function hostOptions(mount: DemoMountOptions | undefined): HostOptions {
  const pairs: [string, string][] = [];
  if (mount?.renderer) pairs.push(["renderer", mount.renderer]);
  if (mount?.interaction) pairs.push(["interaction", mount.interaction]);
  return pairs;
}

/** The options as string props on a component, each after a space: ` interaction="edit"`. */
const asProps = (options: HostOptions) =>
  options.map(([name, value]) => ` ${name}="${value}"`).join("");

function reactSnippet(wrapper: Wrapper, declarations: string, options: HostOptions): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-react", wrapper.specType);
  const element = `<${wrapper.component} spec={spec}${asProps(options)} />`;
  const body = `export function Example() {\n  return ${element};\n}`;
  return `${head}\n\n${declarations}\n\n${body}\n`;
}

function vueSnippet(wrapper: Wrapper, declarations: string, options: HostOptions): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-vue", wrapper.specType);
  const template = `<template>\n  <${wrapper.component} :spec="spec"${asProps(options)} />\n</template>`;
  return `<script setup lang="ts">\n${head}\n\n${declarations}\n</script>\n\n${template}\n`;
}

function svelteSnippet(wrapper: Wrapper, declarations: string, options: HostOptions): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-svelte", wrapper.specType);
  const element = `<${wrapper.component} {spec}${asProps(options)} />`;
  return `<script lang="ts">\n${head}\n\n${declarations}\n</script>\n\n${element}\n`;
}

function vanillaSnippet(wrapper: Wrapper, declarations: string, options: HostOptions): string {
  const head = imports(wrapper.mount, "@opendata-ai/openchart-vanilla", wrapper.specType);
  const fields = options.map(([name, value]) => `${name}: "${value}"`).join(", ");
  const args = fields ? `container, spec, { ${fields} }` : "container, spec";
  const mount = [
    'const container = document.getElementById("chart");',
    "if (!container) throw new Error('Add <div id=\"chart\"></div> to the page first.');",
    `${wrapper.mount}(${args});`,
  ].join("\n");
  return `${head}\n\n${declarations}\n\n${mount}\n`;
}

function snippetsFrom(
  wrapper: Wrapper,
  declarations: string,
  mount: DemoMountOptions | undefined,
): FrameworkSnippets {
  const options = hostOptions(mount);
  return {
    react: reactSnippet(wrapper, declarations, options),
    vue: vueSnippet(wrapper, declarations, options),
    svelte: svelteSnippet(wrapper, declarations, options),
    vanilla: vanillaSnippet(wrapper, declarations, options),
  };
}

/**
 * Complete, runnable code that renders this spec in each framework, passing the
 * demo's host options (`renderer`, `interaction`) as props or mount options.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper.
 */
export function frameworkSnippets(spec: VizSpec, mount?: DemoMountOptions): FrameworkSnippets {
  const wrapper = wrapperFor(spec);
  return snippetsFrom(wrapper, specDeclarations(spec, wrapper.specType, plainJson), mount);
}

/**
 * The code `frameworkSnippets` returns with its bulky values folded: `shown` has
 * a one-line comment in place of each, and `template` a marker that `fillFolds`
 * turns back into the complete code, using `folds`, the values' paths in marker order.
 */
export type FoldedSnippets = {
  shown: FrameworkSnippets;
  template: FrameworkSnippets;
  folds: SpecPath[];
};

function mapSnippets(snippets: FrameworkSnippets, map: (code: string) => string) {
  const { react, vue, svelte, vanilla } = snippets;
  return { react: map(react), vue: map(vue), svelte: map(svelte), vanilla: map(vanilla) };
}

/**
 * The framework code with data rows, graph elements and geography folded, so a
 * page carries each demo's bulk once, in its embedded spec.
 *
 * @throws {TypeError} When the spec's type has no framework wrapper.
 * @throws {FoldMarkerError} When the spec contains the text fold markers use.
 */
export function foldedFrameworkSnippets(spec: VizSpec, mount?: DemoMountOptions): FoldedSnippets {
  const wrapper = wrapperFor(spec);
  const targets = foldTargets(spec);
  const json: JsonWriter = (value) => jsonWithMarkers(value, targets);
  const template = snippetsFrom(wrapper, specDeclarations(spec, wrapper.specType, json), mount);
  return {
    shown: mapSnippets(template, (code) => showFolds(code, targets)),
    template,
    folds: targets.map(({ path }) => path),
  };
}

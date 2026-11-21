/**
 * Turns a spec into complete, runnable code for each framework the library
 * ships a wrapper for, and a display form of the same code with its bulky
 * values folded away. The demo code tabs show the folded form and copy the complete one.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { isChartSpec, isLayerSpec } from "@opendata-ai/openchart-core";
import { site } from "../../config";
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

/** What the demo's host options add to each snippet. */
type HostCode = {
  /** String options as name and value pairs, in a fixed order; empty when the demo sets none. */
  options: readonly (readonly [name: string, value: string])[];
  /** Edit mode: each snippet declares an `onEdit` handler and passes it in its framework's spelling. */
  edit: boolean;
};

function hostCode(mount: DemoMountOptions | undefined): HostCode {
  const options: [string, string][] = [];
  if (mount?.renderer) options.push(["renderer", mount.renderer]);
  if (mount?.interaction) options.push(["interaction", mount.interaction]);
  return { options, edit: mount?.interaction === "edit" };
}

/** The handler an edit-mode snippet declares after its spec. */
const EDIT_HANDLER = [
  "// Each finished edit arrives as one transaction. Apply it to your spec with",
  `// applyEditTransaction and redraw: ${site.url}/docs/behavior/edit-mode/`,
  "function onEdit(transaction: EditTransaction) {",
  "  console.log(transaction.ops);",
  "}",
].join("\n");

function imports(name: string, from: string, specType: string, host: HostCode): string {
  const types = host.edit ? `EditTransaction, ${specType}` : specType;
  return [
    `import { ${name} } from "${from}";`,
    `import type { ${types} } from "@opendata-ai/openchart-core";`,
    STYLES_IMPORT,
  ].join("\n");
}

/** The spec declarations, followed by the edit handler in edit mode. */
const withHandler = (declarations: string, host: HostCode) =>
  host.edit ? `${declarations}\n\n${EDIT_HANDLER}` : declarations;

/** The string options as props on a component, each after a space: ` interaction="edit"`. */
const asProps = ({ options }: HostCode) =>
  options.map(([name, value]) => ` ${name}="${value}"`).join("");

function reactSnippet(wrapper: Wrapper, declarations: string, host: HostCode): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-react", wrapper.specType, host);
  const handler = host.edit ? " onEdit={onEdit}" : "";
  const element = `<${wrapper.component} spec={spec}${asProps(host)}${handler} />`;
  const body = `export function Example() {\n  return ${element};\n}`;
  return `${head}\n\n${withHandler(declarations, host)}\n\n${body}\n`;
}

function vueSnippet(wrapper: Wrapper, declarations: string, host: HostCode): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-vue", wrapper.specType, host);
  const handler = host.edit ? ' @edit="onEdit"' : "";
  const template = `<template>\n  <${wrapper.component} :spec="spec"${asProps(host)}${handler} />\n</template>`;
  return `<script setup lang="ts">\n${head}\n\n${withHandler(declarations, host)}\n</script>\n\n${template}\n`;
}

function svelteSnippet(wrapper: Wrapper, declarations: string, host: HostCode): string {
  const head = imports(wrapper.component, "@opendata-ai/openchart-svelte", wrapper.specType, host);
  const handler = host.edit ? " onedit={onEdit}" : "";
  const element = `<${wrapper.component} {spec}${asProps(host)}${handler} />`;
  return `<script lang="ts">\n${head}\n\n${withHandler(declarations, host)}\n</script>\n\n${element}\n`;
}

function vanillaSnippet(wrapper: Wrapper, declarations: string, host: HostCode): string {
  const head = imports(wrapper.mount, "@opendata-ai/openchart-vanilla", wrapper.specType, host);
  const fields = [
    ...host.options.map(([name, value]) => `${name}: "${value}"`),
    ...(host.edit ? ["onEdit"] : []),
  ].join(", ");
  const args = fields ? `container, spec, { ${fields} }` : "container, spec";
  const mount = [
    'const container = document.getElementById("chart");',
    "if (!container) throw new Error('Add <div id=\"chart\"></div> to the page first.');",
    `${wrapper.mount}(${args});`,
  ].join("\n");
  return `${head}\n\n${withHandler(declarations, host)}\n\n${mount}\n`;
}

function snippetsFrom(
  wrapper: Wrapper,
  declarations: string,
  mount: DemoMountOptions | undefined,
): FrameworkSnippets {
  const host = hostCode(mount);
  return {
    react: reactSnippet(wrapper, declarations, host),
    vue: vueSnippet(wrapper, declarations, host),
    svelte: svelteSnippet(wrapper, declarations, host),
    vanilla: vanillaSnippet(wrapper, declarations, host),
  };
}

/**
 * Complete, runnable code that renders this spec in each framework, passing the
 * demo's host options (`renderer`, `interaction`) as props or mount options. In
 * edit mode each snippet also declares an `onEdit` handler and passes it in its
 * framework's spelling: `onEdit`, `@edit` or `onedit`.
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

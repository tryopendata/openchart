#!/usr/bin/env node
/**
 * Generate `llms.txt` and `llms-full.txt` from the current spec surface.
 *
 * llms.txt: the hand-written narrative (intro, examples, prose) lives in this
 * file. The per-mark encoding grammar table is generated from the live
 * `MARK_ENCODING_RULES` / `MARK_DISPLAY_NAMES` exports in the BUILT
 * `@opendata-ai/openchart-core` package, so the required/optional channel
 * matrix can never drift from the engine's actual validation rules.
 *
 * llms-full.txt: llms.txt followed by the canonical docs set concatenated
 * verbatim, for agents that want the whole reference in one fetch.
 *
 * Run `node scripts/generate-llms.mjs` (build core first: `bun run build`).
 * Pass `--check` to fail (exit 1) if either committed file differs from a
 * fresh generation. CI runs `--check`; when the spec or docs change,
 * regenerate and commit.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const corePkg = join(repoRoot, 'packages', 'core');
const coreDist = join(corePkg, 'dist', 'index.js');
const outPath = join(repoRoot, 'llms.txt');

if (!existsSync(coreDist)) {
  console.error(`Built core not found at ${coreDist}. Run: bun run build`);
  process.exit(1);
}

const { MARK_ENCODING_RULES, MARK_DISPLAY_NAMES } = await import(pathToFileURL(coreDist).href);

/** Format a channel rule cell: "req (temporal, ordinal)" / "opt" / "-". */
function formatChannel(rule) {
  if (!rule) return '-';
  const req = rule.required ? 'req' : 'opt';
  const types = rule.allowedTypes.length ? ` (${rule.allowedTypes.join(', ')})` : '';
  return `${req}${types}`;
}

/**
 * Generate the mark encoding grammar table from MARK_ENCODING_RULES. Columns are
 * the positional/value channels that actually vary across marks; the rest
 * (tooltip, detail) are optional on every mark and documented in prose to keep
 * the table readable.
 */
/** Marks whose canonical value channel is theta (not y). */
const THETA_MARKS = new Set(['arc', 'waffle', 'parliament']);

function generateMarkTable() {
  const marks = Object.keys(MARK_ENCODING_RULES);
  const rows = marks.map((mark) => {
    const r = MARK_ENCODING_RULES[mark];
    // For arc/waffle/parliament, show theta as the required value channel
    // (the user writes theta; spec-sugar rewrites it to y for the engine).
    const isTheta = THETA_MARKS.has(mark);
    const cells = [
      `\`${mark}\``,
      formatChannel(r.x),
      isTheta ? '-' : formatChannel(r.y),
      isTheta ? 'req (quantitative)' : formatChannel(r.theta),
      formatChannel(r.color),
      formatChannel(r.size),
      MARK_DISPLAY_NAMES[mark] ?? '',
    ];
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '| mark | x | y | theta | color | size | Renders as |',
    '|------|---|---|-------|-------|------|------------|',
    ...rows,
  ].join('\n');
}

const markTable = generateMarkTable();

const body = `# openchart

> Declarative visualization library: write a JSON spec, get a chart, table, or graph. Spec in, SVG out. This file is generated from the library types; do not edit by hand (see scripts/generate-llms.mjs).

## Install

\`\`\`bash
npm install @opendata-ai/openchart-react    # React
npm install @opendata-ai/openchart-vue      # Vue 3
npm install @opendata-ai/openchart-svelte   # Svelte 5
npm install @opendata-ai/openchart-vanilla  # Vanilla JS / any framework
npm install @opendata-ai/openchart-core     # Types + JSON Schema only
\`\`\`

## Core concept

Write a VizSpec JSON object and render it with the entry point for its spec kind.

- React, Vue, and Svelte export \`Visualization\` for any VizSpec. Kind-specific components include \`Chart\` for chart and layer specs and \`Race\` for race specs.
- Vanilla uses kind-specific functions such as \`createChart(container, spec)\`, \`createTable(container, spec)\`, \`createGraph(container, spec)\`, and \`createRace(container, spec)\`.

The engine validates the spec, compiles layout and scales, and renders SVG (charts) or DOM (tables). Specs are plain JSON: serializable, and validatable against the published JSON Schema before rendering.

## VizSpec

VizSpec is a union of these spec kinds, discriminated differently per kind:

- **ChartSpec**: has a \`mark\` field (a mark string or MarkDef object). No \`type\`.
- **LayerSpec**: has a \`layer\` array (overlay multiple charts on shared scales).
- **TableSpec**: \`type: "table"\`.
- **GraphSpec**: \`type: "graph"\`.
- **SankeySpec**: \`type: "sankey"\`.
- **TileMapSpec**: \`type: "tilemap"\`.
- **BarListSpec**: \`type: "barlist"\`.
- **GeoMapSpec**: \`type: "map"\`.
- **RaceSpec**: \`type: "race"\`.

There is no \`type: "line"\` grammar. Charts use \`mark\`, following Vega-Lite. \`mark: "line"\`, not \`type: "line"\`.

## ChartSpec

\`\`\`typescript
{
  mark: MarkType | MarkDef,   // required: "bar" | "line" | ... or { type, ...options }
  data: Array<Record<string, unknown>>,   // required: the rows to plot
  encoding: {
    x?:     EncodingChannel,
    y?:     EncodingChannel,
    color?: EncodingChannel | { value: string },
    size?:  EncodingChannel,
    // also: x2, y2, theta, opacity, strokeDash, text, tooltip, detail, description, facet
  },
  transform?: Transform[],       // filter, bin, calculate, timeUnit, aggregate, joinaggregate, fold, window, density
  chrome?:    Chrome,            // title, subtitle, source, byline, footer, eyebrow, brand
  title?:     string | { text, subtitle },   // sugar -> chrome.title
  annotations?: Annotation[],    // text callouts, highlighted ranges, reference lines
  labels?:    boolean | LabelConfig,          // direct data labels
  legend?:    LegendConfig,      // { position, show, columns, ... }
  theme?:     ThemeConfig,       // colors, fonts, spacing overrides
  a11y?:      { description?: string, hidden?: boolean, table?: boolean },
  frame?:     { left?: number, right?: number }, // fixed horizontal plot margins
  description?: string,          // sugar -> a11y.description (alt text)
  width?: number, height?: number,
  animation?: boolean | AnimationConfig,
  seriesSearch?: boolean | { placeholder?: string },   // "find your country" typeahead; needs categorical color
  youDrawIt?: { from, prompt?, revealLabel?, resetLabel?, comparisonLine? },  // reader-draws-the-trend; line marks, single series
  crosshair?: boolean,
  display?: "full" | "sparkline",
  facet via encoding.facet + resolve?: { scale?, axis?, legend? },  // small multiples
}
\`\`\`

### MarkType and MarkDef

A mark is a string shorthand or an object \`{ type, ...options }\`. Mark types:

\`bar\`, \`line\`, \`area\`, \`point\`, \`circle\`, \`arc\`, \`text\`, \`rule\`, \`tick\`, \`rect\`, \`lollipop\`, \`beeswarm\`, \`histogram\`, \`density\`, \`range\`, \`waffle\`, \`calendar\`, \`parliament\`.

Common MarkDef options:

- **line/area**: \`point\` ("endpoints" | "last" | "first" | true), \`interpolate\` ("linear" | "monotone" | "step" | ...).
- **bar**: \`orient\` ("horizontal" | "vertical"), \`cornerRadius\` (number | "pill").
- **arc**: \`innerRadius\` (>0 -> donut), \`outerRadius\`, \`startAngle\` / \`endAngle\` (radians; e.g. \`startAngle: -Math.PI/2, endAngle: Math.PI/2\` for a half-donut).
- **point**: \`trendline\` (boolean, default true).
- **range**: \`style\` ("dumbbell" | "arrow" | "bar").
- **filled marks (bar/area/arc)**: \`fillPattern\` ("auto" | "none"). "auto" layers a per-series SVG pattern for color-vision-safe distinction.

### Static SVG and statistics

Import \`renderStaticSVG\` from \`@opendata-ai/openchart-vanilla/static\`. It renders chart, layer, barlist, tilemap and geomap specs without a browser or DOM shim. Options include per-call \`theme\`, \`measureText\`, \`idPrefix\`, \`darkMode\` and \`precision\` (0–15 or null; default 3). Render separate light/dark SVGs with distinct stable prefixes; keep build timezones consistent. The host supplies captions and HTML tables. See [static rendering](./docs/static-rendering.md).

\`encoding.description\` accepts a constant value or field. A series path needs constant text within each series; add a point layer for per-observation descriptions. Static data shapes carry titles and identity attributes; live mounts use authored descriptions for keyboard inspection. \`a11y.table: false\` suppresses the generated live table, while \`a11y.hidden: true\` hides decorative cells.

\`errorbar\` draws caller-computed horizontal x/x2 or vertical y/y2 intervals with optional \`ticks\` caps; it does not estimate intervals. Layer with points in compact \`display: 'sparkline'\` cells. Temporal bar x channels support \`interval: 'day' | 'week' | 'month' | 'quarter' | 'year' | number\` (positive milliseconds). Fixed \`frame.left\` and \`frame.right\` align paired plots and override automatic label reserves. \`labels.content\` accepts \`'label'\`, \`'value'\` or \`'label value'\`; \`prefix\` and \`suffix\` surround formatted values. Bar lists support groups, explicit value domains, input order with \`sort: null\`, and x reference lines.

### Encoding requirements by mark

\`req\`/\`opt\` = required/optional; parentheses list allowed field types. Every mark also accepts optional \`tooltip\`, \`detail\` and \`description\` channels. \`theta\` is the value channel for arc, waffle, and parliament marks.

${markTable}

An EncodingChannel is \`{ field, type, aggregate?, bin?, timeUnit?, sort?, scale?, axis?, legend?, format?, title?, stack?, highlight?, interval? }\`. \`type\` is one of \`quantitative\`, \`temporal\`, \`nominal\`, \`ordinal\`. Multi-series bar and area charts default to stacked (Vega-Lite aligned); set \`stack: null\` on the value channel for grouped bars or overlapping areas.

### Color legends

For a quantitative \`color\` field with a sequential/diverging \`scale.scheme\`, the engine renders a continuous gradient or binned legend automatically. \`encoding.color.bin: true\` produces a binned (stepped) legend; a bare quantitative color field produces a continuous gradient legend. Categorical color fields get a swatch legend. Control placement with \`encoding.color.legend\` or the top-level \`legend\`.

## Transforms

\`transform\` is an ordered array applied before encoding:

- \`{ filter: FieldPredicate | LogicalExpr }\` - keep matching rows.
- \`{ bin: true | { maxbins, step, ... }, field, as }\` - bucket a quantitative field.
- \`{ calculate: { op, field, field2?, value? }, as }\` - derive a field.
- \`{ timeUnit, field, as }\` - truncate a temporal field (year, month, yearmonth, ...).
- \`{ aggregate: [{ op, field, as }], groupby }\` - group and summarize (sum, mean, count, median, ...).
- \`{ joinaggregate: [{ op, field, as }], groupby }\` - same ops, joined back onto every row (group totals, shares).
- \`{ fold: [fields], as? }\` - wide to long.
- \`{ window: [...], sort, groupby? }\` - lag, lead, cumsum, rank, pct_change, ...
- \`{ density: field, groupby?, bandwidth?, extent?, cumulative?, counts?, steps?, as? }\` - kernel density estimate; replaces rows with one per evaluation point (fields \`value\` and \`density\`).

A bin plus a count aggregate is a histogram. Take both bin edges (\`as: ["bin_x", "bin_x_end"]\`) and put the end on \`encoding.x2\`: that is what puts the bars on a continuous axis instead of one equal-width slot per bin, and it is what \`mark: "histogram"\` writes for you. On a \`bar\` with a quantitative binned \`x\`, the \`encoding.x.bin\` shorthand emits both edges and the \`x2\` channel automatically.

## Annotations

\`annotations\` is an array of three shapes, discriminated by \`type\`:

- \`{ type: "text", x, y, text, subtitle?, connector?, dot?, anchor? }\` - callout at a data coordinate.
- \`{ type: "range", x1?, x2?, y1?, y2?, label? }\` - highlighted band.
- \`{ type: "refline", x?, y?, style?, label?, labelPlacement? }\` - reference line at a value.

## Chrome

Editorial framing rendered around the plot:

\`\`\`typescript
{ eyebrow?, title?, subtitle?, source?, byline?, footer?, brand? }
\`\`\`

Each accepts a string or \`{ text, style?, offset? }\`.

## Theme

\`theme\` overrides design tokens: \`{ colors?, fonts?, spacing?, borderRadius?, chrome? }\`. \`colors\` accepts a categorical array or an object (\`categorical\`, \`sequential\`, \`diverging\`, \`background\`, \`text\`, \`gridline\`, \`positive\`, \`negative\`, ...). Dark mode is not a spec field: pass \`darkMode\` ("auto" | "force" | "off") as a mount option or component prop.

## TableSpec

\`\`\`typescript
{
  type: "table",
  data: Array<Record<string, unknown>>,
  columns: Array<{ key, label?, format?, align?, sortable?, heatmap?, bar?, sparkline?, image?, flag?, categoryColors? }>,
  chrome?: Chrome,
  search?: boolean,
  pagination?: boolean | { pageSize: number },
  stickyFirstColumn?: boolean,
  density?: "condensed" | "regular" | "relaxed",
  theme?: ThemeConfig,
}
\`\`\`

## GraphSpec

\`\`\`typescript
{
  type: "graph",
  nodes: Array<{ id: string, [key: string]: unknown }>,
  edges: Array<{ source: string, target: string, [key: string]: unknown }>,
  encoding?: { nodeColor?, nodeSize?, edgeColor?, edgeWidth?, nodeLabel? },
  layout?: { type: "force" | "radial" | "hierarchical", clustering?, chargeStrength?, linkDistance? },
  chrome?: Chrome,
}
\`\`\`

## GeoMapSpec

\`\`\`typescript
{
  type: "map",
  geo: { features: topology, projection?: "albersUsa" | "mercator" | "equalEarth" | "identity", zoom?: boolean },
  data: rows,
  encoding: { key?, color?, tooltip?, text?, textPriority? },
  points?: { data, longitude, latitude, key?, size?, color?, tooltip?, text?, textPriority? },
  callouts?: [{ id, anchor, text, subtitle?, priority?, minZoom?, maxZoom?, offset?, maxWidth? }],
  chrome?, legend?, theme?, fields?,
}
\`\`\`

Use \`createGeoMap(container, spec)\` or the \`GeoMap\` framework component. Labels are opt-in: \`text: { field: "placeName" }\`; quantitative \`textPriority\` orders bounded placement. Point labels and point-anchored callouts require a unique \`points.key\`.

Callout anchors are \`{ kind: "feature", id }\`, \`{ kind: "point", id }\`, or \`{ kind: "coordinate", space: "geographic" | "source", x, y }\`. Feature IDs refer to topology features; point IDs refer to the point key. Geographic anchors use longitude/latitude and require a geographic projection; source anchors use the preprojected identity map's coordinate system. Do not interchange these spaces. Callout IDs must be unique.

Labels retain constant text size during camera movement. Decluttered text remains in the accessible inventory; callouts that do not fit use reserved numbered notes. Complete authored inventory is included in standalone SVG descriptions. A visible place-list disclosure is a runtime \`labelInventory: { container: hostElement }\` option, independent of any reader panel. The host owns its position. Omission does not add visible HTML or labels, and map callouts are not Cartesian editable annotations.

## SankeySpec, TileMapSpec, BarListSpec

- \`{ type: "sankey", data, encoding: { source, target, value }, ... }\` - flow diagram.
- \`{ type: "tilemap", data, encoding: { state, value }, palette?, ... }\` - US state tile-grid map.
- \`{ type: "barlist", data, encoding: { label, value }, ... }\` - ranked horizontal bar list.

## RaceSpec

A race plays a ranked leaderboard over a sequence of periods. Supply one row per key and period and at least two periods. Aggregate duplicate rows before rendering. Race specs do not support \`transform\`.

\`\`\`typescript
{
  type: "race",
  mark: "bar" | "line" | "table" | RaceMarkDef,
  data: Array<Record<string, unknown>>,
  encoding: { time, key, value, color?, label? },
  race?: { top?, duration?, step?, swap?, rescale?, gaps?, holdEnd?, loop?, autoplay?, controls?, period?, summary? },
  chrome?, theme?, a11y?, watermark?, width?, height?, labels?, animation?,
}
\`\`\`

- Required encodings are \`time\` (period field), \`key\` (stable series identity), and \`value\` (numeric ranking field). Quantitative and temporal periods sort by value. Ordinal periods use first-seen order. Pass an explicit array of period labels to \`encoding.time.sort\` to put those periods first in the given order. \`encoding.value.format\` formats displayed values.
- Optional \`color\` maps a field or sets a constant CSS color with \`{ value: "#357" }\`. By default each key gets a stable color. Optional \`label\` uses the last non-null label per key, with the key as the fallback.
- Mark objects take \`{ type: "bar", cornerRadius? }\`, \`{ type: "line", window? }\`, or \`{ type: "table", columns? }\`. The line window defaults to \`"reveal"\` and grows with the playhead. Use \`"all"\` to show the full time axis. Table columns are \`rank\`, \`change\`, \`name\`, \`bar\`, \`value\`, and \`share\` by default. The inline bar hides when the table area is narrower than 520px, unless it is the only requested column. Below 520px, a compact Change heading leaves more room for names.
- \`race.top\` defaults to 10. For bars and the table's inline bar column, \`rescale: "frame"\` (default) adapts the value domain as the race plays. \`"fixed"\` uses the full run, and \`{ min }\` sets a floor on the frame maximum. The line's value domain uses the series history through the playhead. Interior gaps use \`"interpolate"\` by default, with \`"hold"\` and \`"drop"\` as alternatives.
- Playback timing is in milliseconds. \`duration\` sets total playback time, or \`step\` sets the time between consecutive periods. Use one at most. The default duration is 700ms per period, clamped to 8000–90000ms. \`swap\` defaults to 400ms, \`holdEnd\` to 1500ms, and \`loop\` to false.
- \`autoplay: "visible"\` (default) starts at 25% visibility. Use \`true\` to start immediately or \`false\` to wait for input. \`controls\` defaults to true. Keep controls visible when autoplay is enabled so viewers can pause. Reduced motion and \`animation: false\` open on the final frame without autoplay. With reduced motion, Play advances one whole period at a time.
- Bar races show a large period label by default. Use \`period: false\` to hide it or \`period: { format }\` to override the time formatter. Use \`summary: "sum"\` to display the sum of the top N values on the bar mark.

Mount with \`createRace(container, spec, options?)\` from \`@opendata-ai/openchart-vanilla\` or use the \`Race\` or \`Visualization\` component in React, Vue, and Svelte. For a standalone picture of the final period, use either \`renderStaticSVG(spec, options?)\` or \`renderRaceStaticSVG(spec, options?)\` from \`@opendata-ai/openchart-vanilla/static\`. The supplied height includes the space reserved for the control strip.

- \`play()\` and \`pause()\` control playback. \`seek(t)\` clamps a finite period index to the available periods and accepts fractional positions. A non-finite position throws \`RangeError\`. \`setSpeed(multiplier)\` takes a finite positive playback multiplier.
- \`update({ ...spec, mark: "line" })\` switches marks and retains the playhead. An invalid update throws and leaves the mounted race intact. \`setTheme({ theme, darkMode })\` replaces the mount-level theme or color scheme in place and keeps the playhead, playing state and speed.
- \`getState()\` returns \`{ t, period, playing, speed, ended }\`. Pass this as \`options.initialState\` when remounting to resume at the same playhead and speed. \`on("period", callback)\` reports period crossings and seek destinations and returns an unsubscribe function.
- \`resize()\` remeasures the host. \`destroy()\` stops playback and removes the race. \`export("gif", { fps }?)\` returns a \`Promise<Blob>\` for bar and line races.

## Accessibility

Every chart ships a screen-reader description, a hidden data table, and keyboard mark navigation. Override the description with top-level \`description\` or \`a11y.description\`. Set \`a11y.hidden: true\` for purely decorative charts.

## Validation and repair

Validate a spec before rendering with \`validateSpec(spec)\` from \`@opendata-ai/openchart-engine\`. It returns \`{ valid, errors, normalized }\`. Each error carries a machine-readable \`code\`, the offending \`path\` as a root-relative JSON Pointer (e.g. \`/encoding/y/field\`, \`/layer/1/data/0/value\`), and a repair-friendly \`suggestion\`. Field references are checked against the columns in the provided \`data\`; a misspelled field name suggests the nearest actual column ("did you mean").

## JSON Schema

The published JSON Schema for structured LLM outputs (Anthropic tools, etc.) ships in \`@opendata-ai/openchart-core\`:

- \`@opendata-ai/openchart-core/schema\` - full VizSpec schema (plain, non-strict tool \`input_schema\`).
- \`@opendata-ai/openchart-core/schema/chart.schema.json\` - ChartSpec subset (all 19 marks).
- \`@opendata-ai/openchart-core/schema/table.schema.json\` - TableSpec subset.

Fetch-capable agents without a local install can pull the schema from unpkg or GitHub raw. See \`docs/generating-specs.md\` for tool-use and strict-mode guidance.

## React example

\`\`\`tsx
import { Chart } from '@opendata-ai/openchart-react';

const spec = {
  mark: 'bar',
  data: [
    { language: 'Python', popularity: 29 },
    { language: 'JavaScript', popularity: 24 },
    { language: 'Go', popularity: 10 },
  ],
  encoding: {
    x: { field: 'popularity', type: 'quantitative' },
    y: { field: 'language', type: 'nominal' },
  },
  chrome: {
    title: 'Python leads developer popularity',
    source: 'Source: Stack Overflow Survey 2024',
  },
};

function App() {
  return <div style={{ width: 600, height: 400 }}><Chart spec={spec} /></div>;
}
\`\`\`

## Scrollytelling

Vanilla ships a scrollytelling story API on a subpath: \`@opendata-ai/openchart-vanilla/story\`. It drives a pinned chart through steps as the reader scrolls, tweening between spec states. See [Scrollytelling](https://openchart.steamfield.io/docs/behavior/scrollytelling/) for the story builder API.

## Full documentation

- Generating specs (schema + tool use): [docs/generating-specs.md](./docs/generating-specs.md)
- Complete field reference: [docs/spec-reference.md](./docs/spec-reference.md)
- Agent patterns cookbook: [docs/agent-patterns.md](./docs/agent-patterns.md)
- Getting started guide: [docs/getting-started.md](./docs/getting-started.md)
- Integration guide: [docs/integration-guide.md](./docs/integration-guide.md)
- Architecture: [docs/architecture.md](./docs/architecture.md)
`;

// ---------------------------------------------------------------------------
// llms-full.txt: llms.txt + the canonical docs set, concatenated verbatim
// ---------------------------------------------------------------------------

const FULL_DOCS = [
  'getting-started.md',
  'spec-reference.md',
  'reference/chart-spec.md',
  'reference/layer-spec.md',
  'reference/encoding.md',
  'reference/marks.md',
  'reference/chrome.md',
  'reference/transforms.md',
  'reference/annotations.md',
  'reference/animation.md',
  'reference/theme.md',
  'reference/table-spec.md',
  'reference/graph-spec.md',
  'reference/sankey-spec.md',
  'reference/tilemap-spec.md',
  'reference/geomap-spec.md',
  'reference/barlist-spec.md',
  'reference/authoring.md',
  'reference/vanilla.md',
  'reference/react.md',
  'reference/vue.md',
  'reference/svelte.md',
  'reference/events.md',
  'reference/export.md',
  'reference/table-state.md',
  'reference/json-schema.md',
  'chart-types.md',
  'static-rendering.md',
  'graphs.md',
  'tables.md',
  'theming-tokens.md',
];

const fullOutPath = join(repoRoot, 'llms-full.txt');
const fullBody = [
  body.trimEnd(),
  ...FULL_DOCS.map((name) => {
    // Frontmatter is site metadata (section, order), not documentation.
    const doc = readFileSync(join(repoRoot, 'docs', name), 'utf8').replace(
      /^---\n[\s\S]*?\n---\n+/,
      '',
    );
    return `\n\n---\n\n<!-- docs/${name} -->\n\n${doc.trimEnd()}`;
  }),
  '\n',
].join('');

if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== body) {
    console.error('llms.txt is out of date. Run: node scripts/generate-llms.mjs');
    process.exit(1);
  }
  const currentFull = existsSync(fullOutPath) ? readFileSync(fullOutPath, 'utf8') : '';
  if (currentFull !== fullBody) {
    console.error('llms-full.txt is out of date. Run: node scripts/generate-llms.mjs');
    process.exit(1);
  }
  console.log('llms.txt and llms-full.txt are up to date.');
} else {
  writeFileSync(outPath, body);
  console.log(`Wrote llms.txt (${body.length} bytes)`);
  writeFileSync(fullOutPath, fullBody);
  console.log(`Wrote llms-full.txt (${fullBody.length} bytes)`);
}

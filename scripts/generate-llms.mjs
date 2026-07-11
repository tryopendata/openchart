#!/usr/bin/env node
/**
 * Generate `llms.txt` from the current spec surface.
 *
 * The hand-written narrative (intro, examples, prose) lives in this file. The
 * per-mark encoding grammar table is generated from the live
 * `MARK_ENCODING_RULES` / `MARK_DISPLAY_NAMES` exports in the BUILT
 * `@opendata-ai/openchart-core` package, so the required/optional channel
 * matrix can never drift from the engine's actual validation rules.
 *
 * Run `node scripts/generate-llms.mjs` (build core first: `bun run build`).
 * Pass `--check` to fail (exit 1) if the committed `llms.txt` differs from a
 * fresh generation. CI runs `--check`; when the spec changes, regenerate and
 * commit.
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
 * (tooltip, href, order, detail) are optional on every mark and documented in
 * prose to keep the table readable.
 */
function generateMarkTable() {
  const marks = Object.keys(MARK_ENCODING_RULES);
  const rows = marks.map((mark) => {
    const r = MARK_ENCODING_RULES[mark];
    const cells = [
      `\`${mark}\``,
      formatChannel(r.x),
      formatChannel(r.y),
      formatChannel(r.color),
      formatChannel(r.size),
      MARK_DISPLAY_NAMES[mark] ?? '',
    ];
    return `| ${cells.join(' | ')} |`;
  });
  return [
    '| mark | x | y | color | size | Renders as |',
    '|------|---|---|-------|------|------------|',
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

Write a VizSpec JSON object, then render it:

- React: \`<Chart spec={spec} />\`
- Vue / Svelte: \`<Chart :spec="spec" />\` / \`<Chart {spec} />\`
- Vanilla: \`createChart(container, spec)\`, \`createTable(...)\`, \`createGraph(...)\`

The engine validates the spec, compiles layout and scales, and renders SVG (charts) or DOM (tables). Specs are plain JSON: serializable, and validatable against the published JSON Schema before rendering.

## VizSpec

VizSpec is a union of six spec kinds, discriminated differently per kind:

- **ChartSpec**: has a \`mark\` field (a mark string or MarkDef object). No \`type\`.
- **LayerSpec**: has a \`layer\` array (overlay multiple charts on shared scales).
- **TableSpec**: \`type: "table"\`.
- **GraphSpec**: \`type: "graph"\`.
- **SankeySpec**: \`type: "sankey"\`.
- **TileMapSpec**: \`type: "tilemap"\`.
- **BarListSpec**: \`type: "barlist"\`.

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
    // also: x2, y2, opacity, strokeDash, text, tooltip, detail, theta, facet
  },
  transform?: Transform[],       // filter, bin, calculate, timeUnit, aggregate, fold, window
  chrome?:    Chrome,            // title, subtitle, source, byline, footer, eyebrow, brand
  title?:     string | { text, subtitle },   // sugar -> chrome.title
  annotations?: Annotation[],    // text callouts, highlighted ranges, reference lines
  labels?:    boolean | LabelConfig,          // direct data labels
  legend?:    LegendConfig,      // { position, show, columns, ... }
  theme?:     ThemeConfig,       // colors, fonts, spacing overrides
  darkMode?:  "auto" | "force" | "off",
  a11y?:      { description?: string, hidden?: boolean },
  description?: string,          // sugar -> a11y.description (alt text)
  width?: number, height?: number,
  animation?: boolean | AnimationConfig,
  seriesSearch?: boolean | { placeholder?: string },   // "find your country" typeahead; needs categorical color
  youDrawIt?: { from, prompt?, revealLabel?, comparisonLine? },  // reader-draws-the-trend; line marks, single series
  crosshair?: boolean,
  display?: "full" | "sparkline",
  facet via encoding.facet + resolve?: { scale?, axis?, legend? },  // small multiples
}
\`\`\`

### MarkType and MarkDef

A mark is a string shorthand or an object \`{ type, ...options }\`. Mark types:

\`bar\`, \`line\`, \`area\`, \`point\`, \`circle\`, \`arc\`, \`text\`, \`rule\`, \`tick\`, \`rect\`, \`lollipop\`, \`beeswarm\`, \`range\`, \`waffle\`, \`calendar\`, \`parliament\`.

Common MarkDef options:

- **line/area**: \`point\` ("endpoints" | "last" | "first" | true), \`interpolate\` ("linear" | "monotone" | "step" | ...).
- **bar**: \`orient\` ("horizontal" | "vertical"), \`cornerRadius\` (number | "pill").
- **arc**: \`innerRadius\` (>0 -> donut), \`outerRadius\`, \`startAngle\` / \`endAngle\` (radians; e.g. \`startAngle: -Math.PI/2, endAngle: Math.PI/2\` for a half-donut).
- **point**: \`trendline\` (boolean, default true).
- **range**: \`style\` ("dumbbell" | "arrow" | "bar").
- **filled marks (bar/area/arc)**: \`fillPattern\` ("auto" | "none"). "auto" layers a per-series SVG pattern for color-vision-safe distinction.

### Encoding requirements by mark

\`req\`/\`opt\` = required/optional; parentheses list allowed field types. Every mark also accepts optional \`tooltip\`, \`href\`, \`order\`, and \`detail\` channels.

${markTable}

An EncodingChannel is \`{ field, type, aggregate?, bin?, timeUnit?, sort?, scale?, axis?, legend?, format?, title?, stack?, highlight? }\`. \`type\` is one of \`quantitative\`, \`temporal\`, \`nominal\`, \`ordinal\`.

### Color legends

For a quantitative \`color\` field with a sequential/diverging \`scale.scheme\`, the engine renders a continuous gradient or binned legend automatically. \`encoding.color.bin: true\` produces a binned (stepped) legend; a bare quantitative color field produces a continuous gradient legend. Categorical color fields get a swatch legend. Control placement with \`encoding.color.legend\` or the top-level \`legend\`.

## Transforms

\`transform\` is an ordered array applied before encoding:

- \`{ filter: FieldPredicate | LogicalExpr }\` - keep matching rows.
- \`{ bin: true | { maxbins, step, ... }, field, as }\` - bucket a quantitative field.
- \`{ calculate: { op, field, field2?, value? }, as }\` - derive a field.
- \`{ timeUnit, field, as }\` - truncate a temporal field (year, month, yearmonth, ...).
- \`{ aggregate: [{ op, field, as }], groupby }\` - group and summarize (sum, mean, count, median, ...).
- \`{ fold: [fields], as? }\` - wide to long.
- \`{ window: [...], sort, groupby? }\` - lag, lead, cumsum, rank, pct_change, ...

## Annotations

\`annotations\` is an array of three shapes, discriminated by \`type\`:

- \`{ type: "text", x, y, text, subtitle?, connector?, dot?, anchor? }\` - callout at a data coordinate.
- \`{ type: "range", x1?, x2?, y1?, y2?, label? }\` - highlighted band.
- \`{ type: "refline" | "rule", x?, y?, style?, label? }\` - reference line at a value.

## Chrome

Editorial framing rendered around the plot:

\`\`\`typescript
{ eyebrow?, title?, subtitle?, source?, byline?, footer?, brand? }
\`\`\`

Each accepts a string or \`{ text, style?, offset? }\`.

## Theme

\`theme\` overrides design tokens: \`{ colors?, fonts?, spacing?, borderRadius?, chrome? }\`. \`colors\` accepts a categorical array or an object (\`categorical\`, \`sequential\`, \`diverging\`, \`background\`, \`text\`, \`gridline\`, \`positive\`, \`negative\`, ...). \`darkMode\` ("auto" | "force" | "off") controls automatic dark adaptation.

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
  compact?: boolean,
  theme?: ThemeConfig,
  darkMode?: "auto" | "force" | "off",
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
  darkMode?: "auto" | "force" | "off",
}
\`\`\`

## SankeySpec, TileMapSpec, BarListSpec

- \`{ type: "sankey", data, encoding: { source, target, value }, ... }\` - flow diagram.
- \`{ type: "tilemap", data, encoding: { state, value }, palette?, ... }\` - US state tile-grid map.
- \`{ type: "barlist", data, encoding: { label, value }, ... }\` - ranked horizontal bar list.

## Accessibility

Every chart ships a screen-reader description, a hidden data table, and keyboard mark navigation. Override the description with top-level \`description\` or \`a11y.description\`. Set \`a11y.hidden: true\` for purely decorative charts.

## Validation and repair

Validate a spec before rendering with \`validateSpec(spec)\` from \`@opendata-ai/openchart-engine\`. It returns \`{ valid, errors, normalized }\`. Each error carries a machine-readable \`code\`, the offending \`path\`, and a repair-friendly \`suggestion\`. Field references are checked against the columns in the provided \`data\`; a misspelled field name suggests the nearest actual column ("did you mean").

## JSON Schema

The published JSON Schema for structured LLM outputs (Anthropic tools, etc.) ships in \`@opendata-ai/openchart-core\`:

- \`@opendata-ai/openchart-core/schema\` - full VizSpec schema (plain, non-strict tool \`input_schema\`).
- \`@opendata-ai/openchart-core/schema/chart.schema.json\` - ChartSpec subset (all 16 marks).
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

Vanilla ships a scrollytelling story API on a subpath: \`@opendata-ai/openchart-vanilla/story\`. It drives a pinned chart through steps as the reader scrolls, tweening between spec states. See \`docs/spec-reference.md\` for the story builder API.

## Full documentation

- Generating specs (schema + tool use): [docs/generating-specs.md](./docs/generating-specs.md)
- Complete field reference: [docs/spec-reference.md](./docs/spec-reference.md)
- Agent patterns cookbook: [docs/agent-patterns.md](./docs/agent-patterns.md)
- Getting started guide: [docs/getting-started.md](./docs/getting-started.md)
- Integration guide: [docs/integration-guide.md](./docs/integration-guide.md)
- Architecture: [docs/architecture.md](./docs/architecture.md)
`;

if (process.argv.includes('--check')) {
  const current = existsSync(outPath) ? readFileSync(outPath, 'utf8') : '';
  if (current !== body) {
    console.error('llms.txt is out of date. Run: node scripts/generate-llms.mjs');
    process.exit(1);
  }
  console.log('llms.txt is up to date.');
} else {
  writeFileSync(outPath, body);
  console.log(`Wrote llms.txt (${body.length} bytes)`);
}

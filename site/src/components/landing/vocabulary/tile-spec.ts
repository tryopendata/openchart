/**
 * Turns a demo's spec into the specimen a wall tile draws. A tile is 240px
 * wide and its name is printed under it, so it keeps the marks and drops what
 * cannot survive at that size: chrome, annotations and reference lines, value
 * and endpoint labels, axis titles, legends, and all but a few ticks. The data
 * and encodings are the demo's own, so the tile is the chart its docs page
 * shows, set as a specimen.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";

/**
 * The size every tile chart lays out at, static and live, in px. CSS scales
 * it to the cell's width (the static SVG through its viewBox, the live chart
 * through `--wall-scale`), so the two are the same picture at every width.
 */
export const TILE_SVG_SIZE = { width: 240, height: 180 } as const;

/** How much of a table a tile shows: enough rows and columns to read as a table at tile size. */
export const TILE_TABLE = { rows: 2, columns: 2 } as const;

/** Most ticks an axis keeps on a tile: enough to read the scale, few enough to stay clear. */
const TILE_TICKS = 3;

/** Tight, even padding so the marks fill the cell the same way on every tile. */
const TILE_THEME: ThemeConfig = {
  spacing: { padding: 4, chromeGap: 0, chromeToChart: 0, chartToFooter: 0 },
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An encoding channel's axis without its title, and with at most TILE_TICKS ticks. */
function tileAxis(axis: unknown): unknown {
  if (axis === false || axis === null) return axis;
  const config = isObject(axis) ? axis : {};
  const tickCount = typeof config.tickCount === "number" ? config.tickCount : TILE_TICKS;
  return { ...config, title: "", tickCount: Math.min(tickCount, TILE_TICKS) };
}

/** Positional channels lose their axis titles; a color channel loses its legend. */
function tileEncoding(encoding: unknown): unknown {
  if (!isObject(encoding)) return encoding;
  const result: Json = { ...encoding };
  for (const channel of ["x", "y"]) {
    const value = result[channel];
    if (isObject(value)) result[channel] = { ...value, axis: tileAxis(value.axis) };
  }
  if (isObject(result.color)) result.color = { ...result.color, legend: null };
  return result;
}

function withTileTheme(theme: unknown): ThemeConfig {
  const own = isObject(theme) ? (theme as ThemeConfig) : {};
  const colors = Array.isArray(own.colors) ? { categorical: own.colors } : (own.colors ?? {});
  return {
    ...own,
    // Transparent so every tile shows the page behind it, networks included.
    colors: { ...colors, background: "transparent" },
    spacing: { ...own.spacing, ...TILE_THEME.spacing },
  };
}

/** A chart or one layer of a layered chart, stripped to its marks and a light scale. */
function tileChart(chart: Json): Json {
  const {
    chrome: _chrome,
    annotations: _annotations,
    metrics: _metrics,
    labels: _labels,
    endpointLabels: _endpointLabels,
    legend: _legend,
    ...rest
  } = chart;
  const stripped: Json = { ...rest, encoding: tileEncoding(rest.encoding) };
  if ("mark" in chart) Object.assign(stripped, { labels: false, endpointLabels: false });
  if ("layer" in chart && Array.isArray(chart.layer)) {
    stripped.layer = chart.layer.map((layer) => (isObject(layer) ? tileChart(layer) : layer));
  }
  return stripped;
}

/** Column settings that draw something in the cell rather than print a value. */
const DRAWN_COLUMN_KEYS = ["sparkline", "bar", "heatmap", "delta", "image"];

const isDrawnColumn = (column: unknown) =>
  isObject(column) && DRAWN_COLUMN_KEYS.some((key) => key in column);

/**
 * The columns a table tile keeps: the first (what each row is), then the
 * columns that draw something, then the rest, up to TILE_TABLE.columns.
 */
function tileColumns(columns: unknown[]): unknown[] {
  const [first, ...rest] = columns;
  const ordered = [...rest.filter(isDrawnColumn), ...rest.filter((c) => !isDrawnColumn(c))];
  return [first, ...ordered].filter((column) => column !== undefined).slice(0, TILE_TABLE.columns);
}

/** A network without its legend or node labels, which are unreadable at tile size. */
function tileGraph({ chrome: _chrome, ...rest }: Json): Json {
  const encoding = isObject(rest.encoding) ? rest.encoding : {};
  const { nodeLabel: _nodeLabel, ...marks } = encoding;
  return { ...rest, encoding: marks, legend: false };
}

/** A table's first rows and its most telling columns, kept a table rather than cards. */
function tileTable({
  chrome: _chrome,
  search: _search,
  pagination: _pagination,
  ...rest
}: Json): Json {
  return {
    ...rest,
    data: Array.isArray(rest.data) ? rest.data.slice(0, TILE_TABLE.rows) : rest.data,
    columns: Array.isArray(rest.columns) ? tileColumns(rest.columns) : rest.columns,
    // Under 400px a table turns into cards; a tile keeps it a table, as its name says.
    mobileLayout: "scroll",
    density: "condensed",
  };
}

/** A sankey, map, tile map or bar list: these take a top-level legend switch. */
function tileOther({ chrome: _chrome, annotations: _annotations, ...rest }: Json): Json {
  const tile: Json = { ...rest, encoding: tileEncoding(rest.encoding), legend: { show: false } };
  // Labels outside the first column's nodes run off a tile's left edge; inside, they stay on it.
  if (rest.type === "sankey") tile.nodeLabelAlign = "right";
  return tile;
}

/** The tile's version of a demo spec: the same data and encodings, set as a specimen. */
export function tileSpec(spec: VizSpec): VizSpec {
  const source = spec as unknown as Json;
  let tile: Json;
  if ("mark" in source || "layer" in source)
    tile = { ...tileChart(source), legend: { show: false } };
  else if (source.type === "graph") tile = tileGraph(source);
  else if (source.type === "table") tile = tileTable(source);
  else tile = tileOther(source);
  tile.theme = withTileTheme(source.theme);
  return tile as unknown as VizSpec;
}

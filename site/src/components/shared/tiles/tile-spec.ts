/**
 * Turns a demo's spec into the specimen a tile draws, on the landing wall, the
 * examples gallery or the blog index. A tile is a few hundred pixels wide and
 * its headline or name is printed beside it, so it keeps the marks and drops
 * what cannot survive at that size: chrome, annotations and reference lines,
 * value labels, axis titles and all but a few ticks. Legends and endpoint
 * labels go too, unless the caller keeps the key (`keepKey`) because color
 * carries what the tile's headline states. The data and encodings are the
 * demo's own, so the tile is the chart its docs page shows, set as a specimen.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";

/**
 * The size a tile's static chart lays out at, in px. The stage keeps this
 * shape; the static SVG scales to the cell through its viewBox, and the live
 * chart fills the stage at the cell's own size.
 */
export type TileSize = { readonly width: number; readonly height: number };

/** How much of a table a tile shows by default: enough to read as a table at tile size. */
export const TILE_TABLE = { rows: 5, columns: 2 } as const;

/** What a page may change about a tile's specimen. */
export type TileSpecOptions = {
  /** Keep the legend and endpoint labels, where color carries the finding. Default false. */
  keepKey?: boolean;
  /** Rows and columns a table tile keeps. Default TILE_TABLE. */
  table?: { rows: number; columns: number };
};

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

/** Positional channels lose their axis titles; a color channel loses its legend unless kept. */
function tileEncoding(encoding: unknown, keepKey: boolean): unknown {
  if (!isObject(encoding)) return encoding;
  const result: Json = { ...encoding };
  for (const channel of ["x", "y"]) {
    const value = result[channel];
    if (isObject(value)) result[channel] = { ...value, axis: tileAxis(value.axis) };
  }
  if (isObject(result.color) && !keepKey) result.color = { ...result.color, legend: null };
  return result;
}

/**
 * A sankey's padding: its last column's names and values sit right of the nodes,
 * and the engine's estimate of their width falls a few pixels short, so the
 * tile leaves them room. Padding is one number for every side.
 */
const SANKEY_PADDING = 28;

function withTileTheme(theme: unknown, padding?: number): ThemeConfig {
  const own = isObject(theme) ? (theme as ThemeConfig) : {};
  const colors = Array.isArray(own.colors) ? { categorical: own.colors } : (own.colors ?? {});
  const spacing = { ...own.spacing, ...TILE_THEME.spacing };
  return {
    ...own,
    // Transparent so every tile shows the page behind it, networks included.
    colors: { ...colors, background: "transparent" },
    spacing: padding === undefined ? spacing : { ...spacing, padding },
  };
}

/** A chart or one layer of a layered chart, stripped to its marks and a light scale. */
function tileChart(chart: Json, keepKey: boolean): Json {
  const {
    chrome: _chrome,
    annotations: _annotations,
    metrics: _metrics,
    labels: _labels,
    endpointLabels,
    legend,
    ...rest
  } = chart;
  const stripped: Json = { ...rest, encoding: tileEncoding(rest.encoding, keepKey) };
  if ("mark" in chart) {
    stripped.labels = false;
    stripped.endpointLabels = keepKey && endpointLabels !== undefined ? endpointLabels : false;
  }
  if (keepKey && legend !== undefined) stripped.legend = legend;
  if ("layer" in chart && Array.isArray(chart.layer)) {
    stripped.layer = chart.layer.map((layer) =>
      isObject(layer) ? tileChart(layer, keepKey) : layer,
    );
  }
  return stripped;
}

/** Column settings that draw something in the cell rather than print a value. */
const DRAWN_COLUMN_KEYS = ["sparkline", "bar", "heatmap", "delta", "image"];

const isDrawnColumn = (column: unknown) =>
  isObject(column) && DRAWN_COLUMN_KEYS.some((key) => key in column);

/**
 * The columns a table tile keeps: the first (what each row is), then the
 * columns that draw something, then the rest, up to `count`.
 */
function tileColumns(columns: unknown[], count: number): unknown[] {
  const [first, ...rest] = columns;
  const ordered = [...rest.filter(isDrawnColumn), ...rest.filter((c) => !isDrawnColumn(c))];
  return [first, ...ordered].filter((column) => column !== undefined).slice(0, count);
}

/** A network without its legend or node labels, which are unreadable at tile size. */
function tileGraph({ chrome: _chrome, ...rest }: Json): Json {
  const encoding = isObject(rest.encoding) ? rest.encoding : {};
  const { nodeLabel: _nodeLabel, ...marks } = encoding;
  return { ...rest, encoding: marks, legend: false };
}

/** A table's first rows and its most telling columns, kept a table rather than cards. */
function tileTable(
  { chrome: _chrome, search: _search, pagination: _pagination, ...rest }: Json,
  size: { rows: number; columns: number },
): Json {
  return {
    ...rest,
    data: Array.isArray(rest.data) ? rest.data.slice(0, size.rows) : rest.data,
    columns: Array.isArray(rest.columns) ? tileColumns(rest.columns, size.columns) : rest.columns,
    // Under 400px a table turns into cards; a tile keeps it a table, as its name says.
    mobileLayout: "scroll",
    density: "condensed",
  };
}

/** A sankey, map, tile map or bar list: these take a top-level legend switch. */
function tileOther(
  { chrome: _chrome, annotations: _annotations, ...rest }: Json,
  keepKey: boolean,
): Json {
  const tile: Json = { ...rest, encoding: tileEncoding(rest.encoding, keepKey) };
  if (!keepKey) tile.legend = { show: false };
  // Every label right of its node: "auto" sets the first column's outside-left, where the
  // engine's label-width estimate falls short and the longest name runs off the tile.
  if (rest.type === "sankey") tile.nodeLabelAlign = "right";
  return tile;
}

/** The tile's version of a demo spec: the same data and encodings, set as a specimen. */
export function tileSpec(spec: VizSpec, options: TileSpecOptions = {}): VizSpec {
  const keepKey = options.keepKey ?? false;
  const source = spec as unknown as Json;
  let tile: Json;
  if ("mark" in source || "layer" in source) {
    tile = tileChart(source, keepKey);
    if (!keepKey) tile.legend = { show: false };
  } else if (source.type === "graph") tile = tileGraph(source);
  else if (source.type === "table") tile = tileTable(source, options.table ?? TILE_TABLE);
  else tile = tileOther(source, keepKey);
  tile.theme = withTileTheme(source.theme, source.type === "sankey" ? SANKEY_PADDING : undefined);
  return tile as unknown as VizSpec;
}

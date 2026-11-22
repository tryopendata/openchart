/**
 * What a blog post adds to a demo figure: the credit line's target (the docs
 * page for the figure's chart type) and the width its static SVGs lay out at,
 * the article's wide column. Demo.astro and the `json demo` fence decide whether
 * the page is a post and pass the result to `demoFigureHtml`; docs pages pass
 * nothing and their figures are unchanged. Pure: no I/O.
 */
import {
  type ChartSpec,
  isChartSpec,
  isGeoMapSpec,
  isLayerSpec,
  type LayerSpec,
  type VizSpec,
} from "@opendata-ai/openchart-core";

/** Where a figure's "Made with OpenChart" line links, and what it calls the chart. */
export type FigureCredit = {
  /** A docs page route with its trailing slash, such as "/docs/change-over-time/line/". */
  href: string;
  /** The chart type in lowercase prose, such as "line chart". */
  chartName: string;
};

/** The blog-only parts of a demo figure. */
export type BlogFigure = { credit: FigureCredit; staticWidth: number };

/** The article's wide column in px, which blog figures' static SVGs lay out at. */
export const BLOG_FIGURE_WIDTH = 1024;

/** Thrown when a blog figure's spec has no docs page to credit. The message names the demo. */
export class UnknownFigureCreditError extends Error {}

const docsCredit = (page: string, chartName: string): FigureCredit => ({
  href: `/docs/${page}/`,
  chartName,
});

/**
 * Every chart kind a blog figure can credit, keyed by `chartKind`. A kind is the
 * spec's `type`, a chart's mark, or one of the splits `chartKind` makes (bars
 * by orientation, maps by whether they draw symbols).
 */
const CREDIT_TARGETS: Record<string, FigureCredit> = {
  line: docsCredit("change-over-time/line", "line chart"),
  column: docsCredit("comparison/column", "column chart"),
  bar: docsCredit("comparison/bar", "bar chart"),
  point: docsCredit("correlation/scatter", "scatter plot"),
  range: docsCredit("comparison/range", "range chart"),
  sankey: docsCredit("flow/sankey", "sankey diagram"),
  tilemap: docsCredit("maps/tile-map", "tile map"),
  choropleth: docsCredit("maps/choropleth", "choropleth map"),
  "symbol-map": docsCredit("maps/symbol-map", "symbol map"),
  table: docsCredit("tables/data-table", "data table"),
  area: docsCredit("change-over-time/area", "area chart"),
  rect: docsCredit("correlation/heatmap", "heatmap"),
  lollipop: docsCredit("comparison/lollipop", "lollipop chart"),
  arc: docsCredit("part-to-whole/pie-donut", "pie chart"),
  waffle: docsCredit("part-to-whole/waffle", "waffle chart"),
  beeswarm: docsCredit("distribution/beeswarm", "beeswarm plot"),
  histogram: docsCredit("distribution/histogram", "histogram"),
};

/** A chart's mark name, whether the spec writes it as a string or as `{ type }`. */
function markName(spec: ChartSpec): string {
  const mark: unknown = spec.mark;
  if (typeof mark === "string") return mark;
  const type = (mark as { type?: unknown } | undefined)?.type;
  return typeof type === "string" ? type : String(mark);
}

/** A bar mark runs horizontally when its value sits on x, which is the bar chart; otherwise it is a column chart. */
function barKind(spec: ChartSpec): string {
  const x = spec.encoding?.x as { type?: unknown } | undefined;
  return x?.type === "quantitative" ? "bar" : "column";
}

/**
 * A layer spec's first child with the parent's encoding under its own, channel
 * by channel (the child's channel wins), the way the engine hands encoding down.
 */
function firstLayer(spec: LayerSpec): LayerSpec["layer"][number] | undefined {
  const [first] = spec.layer;
  if (!first || !spec.encoding) return first;
  // The spec types pair each mark with its own encoding shape, which a spread
  // can't prove it keeps; only the chart kind is read from the merged spec.
  return { ...first, encoding: { ...spec.encoding, ...first.encoding } } as typeof first;
}

/** The `CREDIT_TARGETS` key for a spec, or a description of it when it has none. */
function chartKind(spec: VizSpec): string {
  if (isLayerSpec(spec)) {
    const first = firstLayer(spec);
    return first ? chartKind(first) : "empty layer";
  }
  if (isGeoMapSpec(spec)) {
    // A map with a points layer and no feature fill is a symbol map; with a fill it is a choropleth.
    return spec.points && !spec.encoding.color ? "symbol-map" : "choropleth";
  }
  if (isChartSpec(spec)) {
    const mark = markName(spec);
    return mark === "bar" ? barKind(spec) : mark;
  }
  return String((spec as { type?: unknown }).type);
}

/**
 * The docs page that shows how to build this figure's chart type.
 *
 * @throws {UnknownFigureCreditError} When the spec's type or mark has no credit target.
 */
export function figureCredit(id: string, spec: VizSpec): FigureCredit {
  const kind = chartKind(spec);
  const credit = Object.hasOwn(CREDIT_TARGETS, kind) ? CREDIT_TARGETS[kind] : undefined;
  if (credit) return credit;
  throw new UnknownFigureCreditError(
    `Blog demo "${id}" has no credit target for its chart type "${kind}". Add a target for "${kind}" to CREDIT_TARGETS in site/src/lib/demo/blog-figure.ts.`,
  );
}

/**
 * The blog-only options for one figure: its credit and the wide static width.
 *
 * @throws {UnknownFigureCreditError} When the spec's type or mark has no credit target.
 */
export function blogFigure(id: string, spec: VizSpec): BlogFigure {
  return { credit: figureCredit(id, spec), staticWidth: BLOG_FIGURE_WIDTH };
}

/**
 * One segment under /blog/, with or without the trailing slash. "tags" is the
 * tag pages' parent, and a segment with a dot is a file such as rss.xml, not a post.
 */
const BLOG_POST_ROUTE = /^\/blog\/(?!tags\/?$)[^/.]+\/?$/;

/** Whether a route is a blog post ("/blog/<slug>/"), not the index or a tag page. */
export function isBlogPostPath(pathname: string): boolean {
  return BLOG_POST_ROUTE.test(pathname);
}

/** A file directly inside a `src/content/blog/` directory. */
const BLOG_POST_FILE = /(^|\/)src\/content\/blog\/[^/]+$/;

/** A file URL's path, or a plain path as given, with Windows separators turned into slashes. */
function filePath(fileURL: URL | string): string {
  const path =
    fileURL instanceof URL
      ? fileURL.pathname
      : fileURL.startsWith("file:")
        ? new URL(fileURL).pathname
        : fileURL;
  return path.replaceAll("\\", "/");
}

/** Whether a content file is a blog post, a file under `src/content/blog/`. */
export function isBlogPostFile(fileURL: URL | string | undefined): boolean {
  if (fileURL === undefined) return false;
  return BLOG_POST_FILE.test(filePath(fileURL));
}

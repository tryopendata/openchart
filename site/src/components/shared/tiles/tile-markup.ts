/**
 * The build-time HTML of a tile's chart: a bare demo stage and the embedded
 * spec, in the demo markup contract, so the page's demo script (scripts/demos.ts)
 * mounts each tile and plays its entrance the first time it is seen, like any
 * demo. Charts with a static renderer show their light and dark static SVGs as
 * lazy images (tile-files.ts writes the files); a page that lays a tile out in
 * two shapes passes a `narrow` size too, and its CSS picks one by the
 * `data-tile-variant` wrapper. Tables and sankeys show a small table instead
 * (tile-fallback.ts), with the demo system's placeholder line as its caption.
 * The stage keeps the layout's shape (`--tile-ratio`, and `--tile-ratio-narrow`).
 */
import { isGraphSpec, isSankeySpec, isTableSpec, type VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../../demos/registry";
import { escapeHtml } from "../../../lib/demo/escape-html";
import { embeddedSpecHtml, stageContentHtml } from "../../../lib/demo/figure";
import { DEMO_ATTR, DEMO_CLASS } from "../../../lib/demo/markup";
import { validateDemo } from "../../../lib/demo/validate";
import { sankeyFallbackHtml, tableFallbackHtml } from "./tile-fallback";
import { type TileRequest, type TileTheme, tileFileUrl } from "./tile-files";
import { type TileSize, type TileSpecOptions, tileSpec } from "./tile-spec";

export { tableFallbackHtml } from "./tile-fallback";

/** The class on a tile's stage, which tiles.css sizes. */
export const TILE_STAGE_CLASS = "tile-stage";

/** How a page lays its tiles out. */
export type TileOptions = {
  /** The size the static chart lays out at; the stage keeps its shape. */
  size: TileSize;
  /** A second layout the page switches to on narrow screens (`data-tile-variant="narrow"`). */
  narrow?: TileSize;
  /** How the specimen is cut (tile-spec.ts). */
  spec?: TileSpecOptions;
};

/** Every static file a tile with these options shows, for the route that writes them. */
export function tileRequests(demo: string, options: TileOptions): TileRequest[] {
  const sizes = options.narrow ? [options.size, options.narrow] : [options.size];
  return sizes.map((size) => ({ demo, size, spec: options.spec }));
}

const ratio = (size: TileSize) => `${size.width} / ${size.height}`;

/** The light and dark images of one layout, each shown by demo.css in its theme. */
function imagesHtml(request: TileRequest): string {
  const { width, height } = request.size;
  return (["light", "dark"] as TileTheme[])
    .map(
      (theme) =>
        `<img class="${DEMO_CLASS.static}" data-theme="${theme}" src="${tileFileUrl(request, theme)}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async">`,
    )
    .join("");
}

/** The demo system's line naming a chart drawn only in the browser. */
function placeholderHtml(demo: string, title: string, spec: VizSpec): string {
  return stageContentHtml({ spec, title, domId: demo, width: 1, height: 1, static: false });
}

/** A table or sankey's fallback table, captioned by the placeholder line naming the chart. */
function fallbackHtml(demo: string, title: string, spec: VizSpec): string {
  const table = isTableSpec(spec) ? tableFallbackHtml(spec) : sankeyFallbackHtml(spec);
  return table + placeholderHtml(demo, title, spec);
}

function stageContent(demo: string, title: string, spec: VizSpec, options: TileOptions): string {
  if (isTableSpec(spec) || isSankeySpec(spec)) return fallbackHtml(demo, title, spec);
  if (isGraphSpec(spec)) return placeholderHtml(demo, title, spec);
  const [main, narrow] = tileRequests(demo, options);
  if (!main) return "";
  if (!narrow) return imagesHtml(main);
  const variant = (name: string, request: TileRequest) =>
    `<span class="tile-variant" data-tile-variant="${name}">${imagesHtml(request)}</span>`;
  return variant("main", main) + variant("narrow", narrow);
}

/**
 * One tile's stage and embedded spec for the demo `demoId`. `pageShared` is the
 * page's record of shared values already written (`pageSharedHashes(Astro.locals)`),
 * so a value such as a US atlas goes into the page once.
 *
 * @throws {Error} Naming the tile when its demo is unknown or its spec fails validation.
 */
export function tileChartHtml(
  demoId: string,
  pageShared: Set<string>,
  options: TileOptions,
): string {
  let title: string;
  let spec: VizSpec;
  try {
    const demo = getDemo(demoId);
    validateDemo(demoId, demo.spec);
    title = demo.title;
    spec = tileSpec(demo.spec, options.spec);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Tile "${demoId}": ${reason}`, { cause: error });
  }
  const shape = options.narrow
    ? `--tile-ratio: ${ratio(options.size)}; --tile-ratio-narrow: ${ratio(options.narrow)}`
    : `--tile-ratio: ${ratio(options.size)}`;
  const stage = `<div class="demo-stage ${TILE_STAGE_CLASS}" ${DEMO_ATTR.stage} style="${escapeHtml(shape)}">${stageContent(demoId, title, spec, options)}</div>`;
  return stage + embeddedSpecHtml(spec, pageShared);
}

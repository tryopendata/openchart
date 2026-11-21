/**
 * Static tile charts as files. A page's tiles are many small charts in two
 * themes each, which inline would make the landing wall and the gallery several
 * hundred kilobytes of HTML. So each tile's static SVG is written once to
 * /tiles/<name>.svg by the src/pages/tiles/ route, and the tile shows it as a
 * lazy <img>. The SVGs carry their own colors and need no page CSS.
 *
 * An image cannot load the page's fonts, so a tile file sets its text in
 * TILE_IMAGE_FONT instead of the site sans, which would fall back to the
 * reader's system sans. The build lays text out with the library's width
 * table, which has Helvetica and Arial metrics, so text drawn in those faces
 * fits the space the layout gave it on every platform; a system sans can run
 * wider (DejaVu Sans, a common Linux default, is about 14% wider in its
 * figures). Embedding a subset of the site sans in each file would match the
 * page's typeface, but roughly triples the tiles' bytes for a picture most
 * readers never see: with motion allowed it stays hidden until the live chart
 * has played its entrance.
 */
import type { ThemeConfig, VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../../demos/registry";
import { chartTheme } from "../../../lib/demo/chart-theme";
import { staticSvg } from "../../../lib/demo/static-svg";
import { type TileSize, type TileSpecOptions, tileSpec } from "./tile-spec";
import { mergeRects } from "./tile-svg";

/** One static tile chart a page shows: which demo, at what size, with which specimen options. */
export type TileRequest = { demo: string; size: TileSize; spec?: TileSpecOptions };

export type TileTheme = "light" | "dark";

/**
 * The faces a tile file's text draws in: Helvetica or Arial, or a face with
 * their metrics (Liberation Sans, Arimo), which the build's text layout assumes.
 */
export const TILE_IMAGE_FONT = 'Helvetica, Arial, "Liberation Sans", Arimo, sans-serif';

/** The site's chart theme with its text set in TILE_IMAGE_FONT. */
function tileFileTheme(theme: TileTheme): ThemeConfig {
  const site = chartTheme(theme === "dark");
  return { ...site, fonts: { ...site.fonts, family: TILE_IMAGE_FONT } };
}

/** The served path of a tile file. */
export const TILE_FILE_DIR = "/tiles/";

/** The specimen options as part of a file name, so two specimens of one demo never share a file. */
function optionsKey(options: TileSpecOptions = {}): string {
  const parts = [
    options.keepKey ? "key" : "",
    options.table ? `t${options.table.rows}x${options.table.columns}` : "",
  ];
  return parts.filter(Boolean).join("-");
}

/** The file name, without extension, for one tile in one theme: "comparison--bar-basic-440x292-light". */
export function tileFileName(request: TileRequest, theme: TileTheme): string {
  const { width, height } = request.size;
  const options = optionsKey(request.spec);
  return [request.demo.replace("/", "--"), `${width}x${height}`, options, theme]
    .filter(Boolean)
    .join("-");
}

/** The URL of a tile's file, as an <img> src. */
export function tileFileUrl(request: TileRequest, theme: TileTheme): string {
  return `${TILE_FILE_DIR}${tileFileName(request, theme)}.svg`;
}

/** The tile specimen a request draws. */
export function requestSpec(request: TileRequest): VizSpec {
  return tileSpec(getDemo(request.demo).spec, request.spec);
}

/**
 * The SVG file for one tile in one theme (already slimmed by staticSvg), with
 * its rects merged, or null when the chart type has no static renderer
 * (tables, sankeys, networks).
 */
export function tileFileSvg(request: TileRequest, theme: TileTheme): string | null {
  // A copy: the renderer writes defaults into the spec, and the tile shares objects with the demo's.
  const svg = staticSvg(structuredClone(requestSpec(request)), {
    idPrefix: "t",
    width: request.size.width,
    height: request.size.height,
    dark: theme === "dark",
    theme: tileFileTheme(theme),
    precision: 0,
  });
  return svg === null ? null : mergeRects(svg);
}

/** Every distinct request in `requests`, once, keyed by its light file name. */
export function uniqueRequests(requests: readonly TileRequest[]): TileRequest[] {
  const byName = new Map(requests.map((request) => [tileFileName(request, "light"), request]));
  return [...byName.values()];
}

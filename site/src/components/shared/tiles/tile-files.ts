/**
 * Static tile charts as files. A page's tiles are many small charts in two
 * themes each, which inline would make the landing wall and the gallery several
 * hundred kilobytes of HTML. So each tile's static SVG is written once to
 * /tiles/<name>.svg by the src/pages/tiles/ route, and the tile shows it as a
 * lazy <img>. The SVGs carry their own colors and need no page CSS; their text
 * asks for the site fonts, which an image cannot load, so tick labels draw in
 * the reader's system sans until the live chart replaces them.
 */
import type { VizSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../../demos/registry";
import { staticSvg } from "../../../lib/demo/static-svg";
import { type TileSize, type TileSpecOptions, tileSpec } from "./tile-spec";
import { mergeRects, slimSvg } from "./tile-svg";

/** One static tile chart a page shows: which demo, at what size, with which specimen options. */
export type TileRequest = { demo: string; size: TileSize; spec?: TileSpecOptions };

export type TileTheme = "light" | "dark";

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
 * The SVG file for one tile in one theme, slimmed, or null when the chart type
 * has no static renderer (tables, sankeys, networks).
 */
export function tileFileSvg(request: TileRequest, theme: TileTheme): string | null {
  // A copy: the renderer writes defaults into the spec, and the tile shares objects with the demo's.
  const svg = staticSvg(structuredClone(requestSpec(request)), {
    idPrefix: "t",
    width: request.size.width,
    height: request.size.height,
    dark: theme === "dark",
    precision: 0,
  });
  return svg === null ? null : mergeRects(slimSvg(svg));
}

/** Every distinct request in `requests`, once, keyed by its light file name. */
export function uniqueRequests(requests: readonly TileRequest[]): TileRequest[] {
  const byName = new Map(requests.map((request) => [tileFileName(request, "light"), request]));
  return [...byName.values()];
}

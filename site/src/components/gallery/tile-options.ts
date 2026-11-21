/**
 * How the gallery cuts and sizes each entry's tile: its shape's size on the
 * wall (and the standard shape it narrows to), the standard shape under an
 * entry page, whether it keeps the chart's key, and how much of a table it
 * shows. The tile component and the route that writes the static files both
 * read it, so a tile never points at a file that was not written.
 */
import { isTableSpec } from "@opendata-ai/openchart-core";
import { getDemo } from "../../demos/registry";
import type { TileRequest } from "../shared/tiles/tile-files";
import { type TileOptions, tileRequests } from "../shared/tiles/tile-markup";
import type { TileSpecOptions } from "../shared/tiles/tile-spec";
import { NARROW_SIZE, tileSizesFor, type WallEntry } from "./tile-size";

/** A table tile's rows and columns: enough to read as the table it is. */
export const GALLERY_TABLE = { rows: 6, columns: 3 } as const;

/** The specimen options that apply to the entry's chart, so a file name carries only those. */
function specOptions(entry: WallEntry): TileSpecOptions {
  const table = isTableSpec(getDemo(entry.demo).spec) ? GALLERY_TABLE : undefined;
  return { keepKey: entry.keepKey, table };
}

/** The tile on the wall: the entry's shape, narrowing to the standard shape. */
export function wallTileOptions(entry: WallEntry): TileOptions {
  return { ...tileSizesFor(entry), spec: specOptions(entry) };
}

/** The tile under another entry's page: always the standard shape. */
export function relatedTileOptions(entry: WallEntry): TileOptions {
  return { size: NARROW_SIZE, spec: specOptions(entry) };
}

/** Every static file the gallery's tiles show, on the wall and under entry pages. */
export function galleryTileRequests(entries: readonly WallEntry[]): TileRequest[] {
  return entries.flatMap((entry) => [
    ...tileRequests(entry.demo, wallTileOptions(entry)),
    ...tileRequests(entry.demo, relatedTileOptions(entry)),
  ]);
}

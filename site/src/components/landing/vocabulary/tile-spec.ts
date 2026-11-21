/**
 * The vocabulary wall's tile size. The specimen rules live in
 * components/shared/tiles/tile-spec.ts, shared with the gallery and the blog.
 */
import type { TileSize } from "../../shared/tiles/tile-spec";

export { TILE_TABLE, tileSpec } from "../../shared/tiles/tile-spec";

/**
 * The size every wall chart's static SVG lays out at, in px: a 4:3 cell of the
 * six-column wall at its widest, so the swap to the live chart, which lays out
 * at the cell's own size, keeps its text the same size there.
 */
export const TILE_SVG_SIZE = { width: 208, height: 156 } as const satisfies TileSize;

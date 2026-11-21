/**
 * The vocabulary wall's tile size. The specimen rules live in
 * components/shared/tiles/tile-spec.ts, shared with the gallery and the blog.
 */
import type { TileSize } from "../../shared/tiles/tile-spec";

export { TILE_TABLE, tileSpec } from "../../shared/tiles/tile-spec";

/** The size every wall chart lays out at, static and live, in px. */
export const TILE_SVG_SIZE = { width: 240, height: 180 } as const satisfies TileSize;

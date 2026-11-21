/**
 * The size a post's lead chart lays out at on the blog index and tag pages,
 * static and live. Its own module so the page script that scales live tiles
 * imports this alone, not the build-time markup and the demo registry.
 */
import type { TileSize } from "../shared/tiles/tile-spec";

/** 3:2, a size picked for the index cell. */
export const LEAD_TILE_SIZE: TileSize = { width: 360, height: 240 };

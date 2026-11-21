/**
 * The size a post's lead chart's static image lays out at on the blog index and
 * tag pages; the stage keeps its shape and the live chart fills the stage.
 */
import type { TileSize } from "../shared/tiles/tile-spec";

/** 3:2, a size picked for the index cell. */
export const LEAD_TILE_SIZE: TileSize = { width: 360, height: 240 };

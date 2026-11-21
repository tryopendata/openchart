/**
 * The size each gallery tile's chart lays out at. A standard tile uses
 * GALLERY_TILE_SIZE (3:2). A wide entry is the wall's feature: two columns
 * across and, on the three-column wall, two rows down, so it lays out at twice
 * the standard width and a 5:4 shape that fills about the height of two
 * standard tiles stacked beside it. The static SVG lays out at this size and
 * the stage keeps its shape; the live chart fills the stage at the cell's size.
 */
import { GALLERY_TILE_SIZE, type GalleryEntry } from "../../lib/gallery-types";
import type { TileSize } from "../shared/tiles/tile-spec";

/** The layout size of a wide entry's tile, in px. */
export const GALLERY_FEATURE_TILE_SIZE = { width: 720, height: 576 } as const;

/** Whether an entry is drawn as the wall's feature. */
export const isFeature = (entry: GalleryEntry): boolean => entry.size === "wide";

/** The layout size an entry's tile draws at: the feature size on the wall when it is wide, else the standard size. */
export function tileSizeFor(entry: GalleryEntry, { feature }: { feature: boolean }): TileSize {
  return feature && isFeature(entry) ? GALLERY_FEATURE_TILE_SIZE : GALLERY_TILE_SIZE;
}

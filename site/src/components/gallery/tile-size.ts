/**
 * The shapes a gallery tile takes, and the size each lays its static chart out
 * at. The wall is a six-column grid from 1100px: a standard or square tile takes
 * two columns, a wide one four, a feature four columns and two rows, and the
 * lead the full width above the grid. The sizes are those cells at the wall's
 * widest (1376px of content, 32px gutters), so the static chart's text matches
 * the live chart, which lays out at the cell's own size. Narrower screens, and a
 * filtered wall, show every tile in the standard shape.
 */
import type { GalleryEntry } from "../../lib/gallery-types";
import type { TileSize } from "../shared/tiles/tile-spec";

/** What a tile's chart needs: room across for a strip, height for a grid of cells. */
export type TileShape = "lead" | "feature" | "wide" | "square" | "standard";

/** A gallery entry as the wall draws it: its shape, and whether its tile keeps the chart's key. */
export type WallEntry = GalleryEntry & {
  /** Default "standard". */
  shape?: TileShape;
  /** Keep the legend or endpoint labels on the tile, where color carries the headline's finding. */
  keepKey?: boolean;
};

/** One column of the six at the wall's widest, and the gutter between columns. */
const COLUMN = 203;
const GUTTER = 32;
const span = (columns: number) => columns * COLUMN + (columns - 1) * GUTTER;

/** The layout size of each shape, in px. */
export const SHAPE_SIZES: Record<TileShape, TileSize> = {
  standard: { width: span(2), height: 292 },
  square: { width: span(2), height: span(2) },
  wide: { width: span(4), height: 292 },
  feature: { width: span(4), height: 760 },
  lead: { width: span(6), height: 600 },
};

/** The shape every tile takes on a narrow screen or a filtered wall. */
export const NARROW_SIZE = SHAPE_SIZES.standard;

/** An entry's shape on the arranged wall. */
export const shapeOf = (entry: WallEntry): TileShape => entry.shape ?? "standard";

/** The layout an entry's tile draws at, and the narrow one it switches to, if it differs. */
export function tileSizesFor(entry: WallEntry): { size: TileSize; narrow?: TileSize } {
  const shape = shapeOf(entry);
  return shape === "standard"
    ? { size: NARROW_SIZE }
    : { size: SHAPE_SIZES[shape], narrow: NARROW_SIZE };
}

/**
 * The vocabulary wall's live-chart scale: the shared tile scale
 * (components/shared/tiles/tile-scale.ts) at the wall's tile size.
 */
import {
  observeTileScale as observeSharedTileScale,
  tileScale as sharedTileScale,
} from "../../shared/tiles/tile-scale";
import { TILE_SVG_SIZE } from "./tile-spec";

/** The factor that fits a wall chart into a cell this wide. */
export function tileScale(cellWidth: number): number {
  return sharedTileScale(cellWidth, TILE_SVG_SIZE.width);
}

/** Watches the wall's cell width and writes the scale on `root`. Returns a teardown. */
export function observeTileScale(root: HTMLElement): () => void {
  return observeSharedTileScale(root, TILE_SVG_SIZE);
}

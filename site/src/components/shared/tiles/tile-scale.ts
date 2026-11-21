/**
 * Keeps each live tile chart the same picture as the static one it replaces.
 * Both lay out at the page's tile size: the static SVG scales to its cell
 * through its viewBox, and this writes `--tile-scale` on the grid so the live
 * chart's fixed-size host scales by the same factor at every cell width.
 */
import { DEMO_ATTR } from "../../../lib/demo/markup";
import type { TileSize } from "./tile-spec";

/** The CSS variable the live hosts read. */
export const TILE_SCALE_VAR = "--tile-scale";

/** The factor that fits a chart laid out `layoutWidth` wide into a cell `cellWidth` wide. */
export function tileScale(cellWidth: number, layoutWidth: number): number {
  return cellWidth / layoutWidth;
}

/** Watches the first visible stage's width under `root` and writes the scale for `size` on it. Returns a teardown. */
export function observeTileScale(root: HTMLElement, size: TileSize): () => void {
  const update = () => {
    const stage = [...root.querySelectorAll<HTMLElement>(`[${DEMO_ATTR.stage}]`)].find(
      (candidate) => candidate.offsetWidth > 0,
    );
    if (stage) {
      root.style.setProperty(TILE_SCALE_VAR, String(tileScale(stage.offsetWidth, size.width)));
    }
  };
  const observer = new ResizeObserver(update);
  observer.observe(root);
  update();
  return () => observer.disconnect();
}

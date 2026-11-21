/**
 * Keeps each live wall chart the same picture as the static one it replaces.
 * Both lay out at TILE_SVG_SIZE: the static SVG scales to its cell through its
 * viewBox, and this writes `--wall-scale` on the grid so the live chart's
 * fixed-size host scales by the same factor at every cell width.
 */
import { DEMO_ATTR } from "../../../lib/demo/markup";
import { TILE_SVG_SIZE } from "./tile-spec";

/** The CSS variable the live hosts read (landing-wall.css). */
export const WALL_SCALE_VAR = "--wall-scale";

/** The factor that fits a chart laid out at the tile width into a cell this wide. */
export function tileScale(cellWidth: number): number {
  return cellWidth / TILE_SVG_SIZE.width;
}

/** Watches the first visible stage's width and writes the scale on `root`. Returns a teardown. */
export function observeTileScale(root: HTMLElement): () => void {
  const update = () => {
    const stage = [...root.querySelectorAll<HTMLElement>(`[${DEMO_ATTR.stage}]`)].find(
      (candidate) => candidate.offsetWidth > 0,
    );
    if (stage) root.style.setProperty(WALL_SCALE_VAR, String(tileScale(stage.offsetWidth)));
  };
  const observer = new ResizeObserver(update);
  observer.observe(root);
  update();
  return () => observer.disconnect();
}

/**
 * Keeps each live wall chart the same picture as the static one it replaces.
 * A live chart lays out at its cell's width, but never narrower than
 * TILE_SVG_SIZE (the static SVG's layout size): in a narrower cell it lays out
 * at that minimum and scales down, as the static SVG does through its viewBox.
 * This writes the layout width and the scale on the grid as CSS variables.
 */
import { TILE_SVG_SIZE } from "./tile-spec";
import { WALL_ATTR } from "./wall-live";

/** The CSS variables the live hosts read (landing-wall.css). */
export const WALL_VARS = { width: "--wall-layout-width", scale: "--wall-scale" } as const;

/** The width a live chart lays out at in a cell this wide, and the scale that fits it back in. */
export function tileLayout(cellWidth: number): { width: number; scale: number } {
  const width = Math.max(cellWidth, TILE_SVG_SIZE.width);
  return { width, scale: width > 0 ? cellWidth / width : 1 };
}

/** Watches the first visible stage's width and writes the layout on `root`. Returns a teardown. */
export function observeTileScale(root: HTMLElement): () => void {
  const update = () => {
    const stage = [...root.querySelectorAll<HTMLElement>(`[${WALL_ATTR.stage}]`)].find(
      (candidate) => candidate.offsetWidth > 0,
    );
    if (!stage) return;
    const { width, scale } = tileLayout(stage.offsetWidth);
    root.style.setProperty(WALL_VARS.width, `${width}px`);
    root.style.setProperty(WALL_VARS.scale, String(scale));
  };
  const observer = new ResizeObserver(update);
  observer.observe(root);
  update();
  return () => observer.disconnect();
}

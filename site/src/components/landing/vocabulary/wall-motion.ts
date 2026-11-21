/**
 * The vocabulary wall's choreography: the shared tile motion
 * (components/shared/tiles/tile-motion.ts) over the wall's rule and name.
 */
import type { MotionTools } from "../../../scripts/motion";
import {
  refile as refileTiles,
  type TileParts,
  waveIn as waveInTiles,
} from "../../shared/tiles/tile-motion";

export { finishRefile } from "../../shared/tiles/tile-motion";

const WALL_PARTS: TileParts = { rule: ".wall-rule", name: ".wall-name" };

/** Draws each row of the wall in as it scrolls into view, once. */
export function waveIn(tools: MotionTools, tiles: HTMLElement[]): void {
  waveInTiles(tools, tiles, WALL_PARTS);
}

/** Applies a filter change to the wall, refiling the tiles with Flip. */
export function refile(tools: MotionTools, tiles: HTMLElement[], apply: () => void): void {
  refileTiles(tools, tiles, WALL_PARTS, apply);
}

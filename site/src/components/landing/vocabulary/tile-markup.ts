/**
 * The vocabulary wall's tile chart markup: the shared tile markup
 * (components/shared/tiles/tile-markup.ts) at the wall's tile size, with an
 * error that names the wall's tile list when a tile's demo is wrong.
 */
import type { VocabularyTile } from "../../../landing/vocabulary";
import { tileChartHtml as sharedTileChartHtml } from "../../shared/tiles/tile-markup";
import { TILE_SVG_SIZE } from "./tile-spec";

/** Prefix for the wall's static SVG ids, kept from before the tiles were shared. */
const WALL_DOM_PREFIX = "w";

/**
 * One wall tile's stage and embedded spec.
 *
 * @throws {Error} Naming src/landing/vocabulary.ts and the tile when its demo is unknown or invalid.
 */
export function tileChartHtml(tile: VocabularyTile, pageShared: Set<string>): string {
  try {
    return sharedTileChartHtml(tile.demo, pageShared, {
      size: TILE_SVG_SIZE,
      domPrefix: WALL_DOM_PREFIX,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/landing/vocabulary.ts: ${reason}`, { cause: error });
  }
}

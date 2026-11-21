/**
 * The vocabulary wall's tile chart markup: the shared tile markup
 * (components/shared/tiles/tile-markup.ts) at the wall's tile size, with an
 * error that names the wall's tile list when a tile's demo is wrong, and the
 * static files the wall's tiles show, for the route that writes them.
 */
import { type VocabularyTile, vocabularyTiles } from "../../../landing/vocabulary";
import type { TileRequest } from "../../shared/tiles/tile-files";
import { tileChartHtml as sharedTileChartHtml, tileRequests } from "../../shared/tiles/tile-markup";
import { TILE_SVG_SIZE } from "./tile-spec";

/**
 * One wall tile's stage and embedded spec.
 *
 * @throws {Error} Naming src/landing/vocabulary.ts and the tile when its demo is unknown or invalid.
 */
export function tileChartHtml(tile: VocabularyTile, pageShared: Set<string>): string {
  try {
    return sharedTileChartHtml(tile.demo, pageShared, { size: TILE_SVG_SIZE });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`src/landing/vocabulary.ts: ${reason}`, { cause: error });
  }
}

/** The static tile files the wall shows. */
export function vocabularyTileRequests(): TileRequest[] {
  return vocabularyTiles.flatMap((tile) => tileRequests(tile.demo, { size: TILE_SVG_SIZE }));
}

/**
 * The vocabulary wall's filter: the shared tile filter rules
 * (components/shared/tiles/tile-filter.ts) under the `#vocabulary=` hash key,
 * over the Visualizations sections.
 */
import { docsAreas, type SectionId } from "../../../config";
import {
  filterHash,
  isTileShown as isSharedTileShown,
  kindCounts,
  parseFilterHash,
  type TileFilter,
  type TileFilterAction,
  tileFilterReducer,
} from "../../shared/tiles/tile-filter";

/** What the wall can be filtered to: every tile, or one Visualizations section. */
export type WallFilter = TileFilter<SectionId>;

/** One filter button: a section id and its label from `docsAreas`. */
export type WallIntent = { id: SectionId; label: string };

/** The attribute on each tile, holding its demo id; the filter shows and hides these. */
export const TILE_ATTR = "data-vocabulary-tile";

/** The key the wall's state lives under in the URL hash. */
export const WALL_HASH_KEY = "vocabulary";

/** The Visualizations sections, in sidebar order: the filter's buttons after "All". */
export const WALL_INTENTS: readonly WallIntent[] =
  docsAreas.find((area) => area.id === "visualizations")?.sections ?? [];

const intentIds: readonly SectionId[] = WALL_INTENTS.map((intent) => intent.id);

/** Whether a tile filed under `intent` shows while `filter` is chosen. */
export const isTileShown = (intent: SectionId, filter: WallFilter): boolean =>
  isSharedTileShown(intent, filter);

/** Reads the wall's filter from a URL hash, or null when the hash is not the wall's. */
export const parseWallHash = (hash: string): WallFilter | null =>
  parseFilterHash(hash, WALL_HASH_KEY, intentIds);

/** The hash that records a filter: `#vocabulary` for every tile, else `#vocabulary=<intent>`. */
export const wallHash = (filter: WallFilter): string => filterHash(filter, WALL_HASH_KEY);

/** A change to the filter: a button press, or the URL hash changing under it. */
export type WallAction = TileFilterAction<SectionId>;

/** The filter after an action. A hash that is not the wall's leaves the filter as it was. */
export const wallFilterReducer = tileFilterReducer(WALL_HASH_KEY, intentIds);

/** How many tiles each intent has, for the counts beside the filter buttons. */
export const intentCounts = (intents: readonly SectionId[]): Map<SectionId, number> =>
  kindCounts(intents);

/**
 * The vocabulary wall's filter rules, with no DOM: which intents the filter
 * offers, which tiles a filter shows, and how the choice is written to and read
 * from the URL hash (`#vocabulary=distribution`). The island holds the state;
 * this module decides what it means.
 */
import { docsAreas, type SectionId } from "../../../config";

/** What the wall can be filtered to: every tile, or one Visualizations section. */
export type WallFilter = "all" | SectionId;

/** One filter button: a section id and its label from `docsAreas`. */
export type WallIntent = { id: SectionId; label: string };

/** The section the wall's state lives under in the URL hash. */
export const WALL_HASH_KEY = "vocabulary";

/** The Visualizations sections, in sidebar order: the filter's buttons after "All". */
export const WALL_INTENTS: readonly WallIntent[] =
  docsAreas.find((area) => area.id === "visualizations")?.sections ?? [];

const intentIds = new Set<string>(WALL_INTENTS.map((intent) => intent.id));

/** Whether a tile filed under `intent` shows while `filter` is chosen. */
export function isTileShown(intent: SectionId, filter: WallFilter): boolean {
  return filter === "all" || filter === intent;
}

/**
 * Reads the wall's filter from a URL hash. `#vocabulary=<intent>` names one
 * intent and `#vocabulary` alone means every tile. Returns null for a hash that
 * is not the wall's, or names no Visualizations section, so the caller keeps its state.
 */
export function parseWallHash(hash: string): WallFilter | null {
  const [key, value, ...extra] = hash.replace(/^#/, "").split("=");
  if (key !== WALL_HASH_KEY || extra.length > 0) return null;
  if (value === undefined || value === "" || value === "all") return "all";
  let intent: string;
  try {
    intent = decodeURIComponent(value);
  } catch {
    // A malformed escape such as "%E0%A4" names no section; keep the current filter.
    return null;
  }
  return intentIds.has(intent) ? (intent as SectionId) : null;
}

/** The hash that records a filter: `#vocabulary` for every tile, else `#vocabulary=<intent>`. */
export function wallHash(filter: WallFilter): string {
  return filter === "all" ? `#${WALL_HASH_KEY}` : `#${WALL_HASH_KEY}=${filter}`;
}

/** A change to the filter: a button press, or the URL hash changing under it. */
export type WallAction = { type: "choose"; filter: WallFilter } | { type: "hash"; hash: string };

/** The filter after an action. A hash that is not the wall's leaves the filter as it was. */
export function wallFilterReducer(filter: WallFilter, action: WallAction): WallFilter {
  if (action.type === "choose") return action.filter;
  return parseWallHash(action.hash) ?? filter;
}

/** How many tiles each intent has, for the counts beside the filter buttons. */
export function intentCounts(intents: readonly SectionId[]): Map<SectionId, number> {
  const counts = new Map<SectionId, number>();
  for (const intent of intents) counts.set(intent, (counts.get(intent) ?? 0) + 1);
  return counts;
}

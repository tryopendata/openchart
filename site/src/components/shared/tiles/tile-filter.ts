/**
 * The filter rules for a wall of tiles, with no DOM: which tiles a filter
 * shows, how many each kind has, and how the choice is written to and read
 * from the URL hash under the page's own key (`#vocabulary=maps` on the
 * landing wall, `#kind=maps` in the gallery). The page's script or island
 * holds the state; this module decides what it means.
 */

/** What a wall can be filtered to: every tile, or one of the page's ids. */
export type TileFilter<Id extends string = string> = "all" | Id;

/** Whether a tile filed under `kind` shows while `filter` is chosen. */
export function isTileShown<Id extends string>(kind: Id, filter: TileFilter<Id>): boolean {
  return filter === "all" || filter === kind;
}

/**
 * Reads a filter from a URL hash. `#<key>=<id>` names one id from `ids` and
 * `#<key>` alone (or `=all`, or an empty value) means every tile. Returns null
 * for a hash under another key, an id not in `ids` or a malformed escape, so
 * the caller keeps its state.
 */
export function parseFilterHash<Id extends string>(
  hash: string,
  key: string,
  ids: readonly Id[],
): TileFilter<Id> | null {
  const [hashKey, value, ...extra] = hash.replace(/^#/, "").split("=");
  if (hashKey !== key || extra.length > 0) return null;
  if (value === undefined || value === "" || value === "all") return "all";
  let id: string;
  try {
    id = decodeURIComponent(value);
  } catch {
    // A malformed escape such as "%E0%A4" names no id; keep the current filter.
    return null;
  }
  return ids.find((candidate) => candidate === id) ?? null;
}

/** The hash that records a filter: `#<key>` for every tile, else `#<key>=<id>`. */
export function filterHash(filter: TileFilter, key: string): string {
  return filter === "all" ? `#${key}` : `#${key}=${filter}`;
}

/** A change to the filter: a button press, or the URL hash changing under it. */
export type TileFilterAction<Id extends string = string> =
  | { type: "choose"; filter: TileFilter<Id> }
  | { type: "hash"; hash: string };

/**
 * The reducer for a wall whose hash lives under `key` and names one of `ids`.
 * A hash that is not the wall's leaves the filter as it was.
 */
export function tileFilterReducer<Id extends string>(key: string, ids: readonly Id[]) {
  return (filter: TileFilter<Id>, action: TileFilterAction<Id>): TileFilter<Id> => {
    if (action.type === "choose") return action.filter;
    return parseFilterHash(action.hash, key, ids) ?? filter;
  };
}

/** How many tiles each kind has, in first-seen order, for the counts beside the filter buttons. */
export function kindCounts<Id extends string>(kinds: readonly Id[]): Map<Id, number> {
  const counts = new Map<Id, number>();
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return counts;
}

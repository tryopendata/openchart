/**
 * Files shaped search results under their areas for the dialog: groups in
 * SEARCH_AREAS order, empty ones left out, results in rank order within each,
 * and pages with no known area last under "Other". A group shows its first
 * GROUP_LIMIT results until the reader asks for all of them.
 */
import { SEARCH_AREAS, type SearchArea } from "../search-index";
import type { SearchHit } from "./result-shape";

/** The group for pages whose area meta is missing or unknown. */
export const OTHER_GROUP = "Other";

/** How many results a group shows before "Show all n". */
export const GROUP_LIMIT = 5;

/** A group's heading: a search area, or "Other". */
export type GroupName = SearchArea | typeof OTHER_GROUP;

/** One area's results, all of them, in rank order. */
export type ResultGroup = { name: GroupName; hits: readonly SearchHit[] };

/**
 * Groups ranked hits by area. Each unfiled page is reported once per call
 * through `warn`, naming its URL, since every indexed page should carry an area
 * (`searchBodyAttrs`) and a missing one means a page was built without it.
 */
export function groupHits(
  hits: readonly SearchHit[],
  warn: (message: string) => void = console.warn,
): ResultGroup[] {
  const byName = new Map<GroupName, SearchHit[]>();
  for (const hit of hits) {
    const name = hit.area ?? OTHER_GROUP;
    if (name === OTHER_GROUP) {
      warn(`Search result ${hit.pageUrl} has no search area, so it is listed under Other.`);
    }
    byName.set(name, [...(byName.get(name) ?? []), hit]);
  }
  const order: readonly GroupName[] = [...SEARCH_AREAS, OTHER_GROUP];
  return order.flatMap((name) => {
    const groupHits = byName.get(name);
    return groupHits ? [{ name, hits: groupHits }] : [];
  });
}

/** The hits a group shows: all when expanded, else the first GROUP_LIMIT. */
export function shownHits(group: ResultGroup, expanded: boolean): readonly SearchHit[] {
  return expanded ? group.hits : group.hits.slice(0, GROUP_LIMIT);
}

/** True when the group holds more than it shows collapsed. */
export function canExpand(group: ResultGroup): boolean {
  return group.hits.length > GROUP_LIMIT;
}

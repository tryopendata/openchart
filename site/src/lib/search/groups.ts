/**
 * The groups search results are shown in: one per search area in SEARCH_AREAS
 * order, empty ones left out, then "Other" for pages with no area. A group
 * holds the results loaded so far and the true number of matches in its area,
 * so "Show all n" names the real count and knows when nothing is left to load.
 */
import { SEARCH_AREAS, type SearchArea } from "../search-index";
import type { PagefindFilterCounts } from "./pagefind-types";
import type { SearchHit } from "./result-shape";

/** The group for pages whose area filter is missing or unknown. */
export const OTHER_GROUP = "Other";

/** How many results a group loads and shows before "Show all n". */
export const GROUP_LIMIT = 5;

/** A group's heading: a search area, or "Other". */
export type GroupName = SearchArea | typeof OTHER_GROUP;

/** One area's matches: those loaded so far, in rank order, and how many there are in all. */
export type ResultGroup = { name: GroupName; total: number; hits: readonly SearchHit[] };

/** The areas with matches and their counts, in display order, from a search's `area` filter counts. */
export function areaCounts(filters: PagefindFilterCounts | undefined): [SearchArea, number][] {
  const counts = filters?.area ?? {};
  return SEARCH_AREAS.flatMap((area): [SearchArea, number][] => {
    const count = counts[area] ?? 0;
    return count > 0 ? [[area, count]] : [];
  });
}

/** Groups in display order (SEARCH_AREAS, then Other), leaving out any with nothing loaded. */
export function orderGroups(groups: readonly ResultGroup[]): ResultGroup[] {
  const order: readonly GroupName[] = [...SEARCH_AREAS, OTHER_GROUP];
  return order.flatMap((name) => {
    const group = groups.find((candidate) => candidate.name === name);
    return group && group.hits.length > 0 ? [group] : [];
  });
}

/** True when the group has matches it has not loaded yet. */
export function canExpand(group: ResultGroup): boolean {
  return group.hits.length < group.total;
}

/**
 * A function that warns once per URL that a page has no search area, however
 * many searches find it. Every indexed page should carry one (`searchBodyAttrs`),
 * so a missing area means a page was built without it.
 */
export function createUnfiledReporter(
  warn: (message: string) => void = console.warn,
): (url: string) => void {
  const reported = new Set<string>();
  return (url) => {
    if (reported.has(url)) return;
    reported.add(url);
    warn(`Search result ${url} has no search area, so it is listed under Other.`);
  };
}

/**
 * The result the dialog highlights after a search: a page whose title is the
 * query itself ("sankey" finds the page titled "Sankey"), else Pagefind's best
 * rank. Pagefind alone would put SankeySpec first, since it splits compound
 * words and the reference page says "sankey" more often than the chart page.
 */
export function bestHit(groups: readonly ResultGroup[], query: string): SearchHit | undefined {
  const wanted = query.trim().toLowerCase();
  const exact = (hit: SearchHit) => hit.title.trim().toLowerCase() === wanted;
  const better = (hit: SearchHit, than: SearchHit) =>
    exact(hit) !== exact(than) ? exact(hit) : hit.rank < than.rank;
  let best: SearchHit | undefined;
  for (const hit of groups.flatMap((group) => group.hits)) {
    if (!best || better(hit, best)) best = hit;
  }
  return best;
}

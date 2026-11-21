/**
 * Runs one query as the dialog shows it: grouped by area, so a busy area cannot
 * crowd a quiet one out of a shared top-N list. One debounced search is the
 * gate (a newer keystroke cancels it) and supplies the overall rank and the
 * per-area match counts; then each area with matches is searched with the
 * `area` filter and only its first GROUP_LIMIT results' data is loaded. Pages
 * no area search returned go under "Other". The rest of each group loads on
 * "Show all" through `loadHits`.
 */
import { areaCounts, GROUP_LIMIT, type GroupName, OTHER_GROUP, type ResultGroup } from "./groups";
import type { PagefindApi, PagefindResult } from "./pagefind-types";
import { type SearchHit, shapeResult } from "./result-shape";

/** A finished search: the groups to show and what "Show all" needs to load the rest. */
export type AreaSearch = {
  /** How many pages match the query in all. */
  total: number;
  groups: ResultGroup[];
  /** Each group's results not loaded yet, in rank order. */
  rest: Map<GroupName, readonly PagefindResult[]>;
  /** Each result's place in the overall ranking, by Pagefind id. */
  ranks: ReadonlyMap<string, number>;
};

export type AreaSearchOptions = {
  debounceMs: number;
  /** Called with the URL of each page that has no search area. */
  reportUnfiled: (url: string) => void;
  warn?: (message: string, cause?: unknown) => void;
};

/** Searches `query` area by area; null when a newer debounced search replaced it. */
export async function searchByArea(
  api: PagefindApi,
  query: string,
  { debounceMs, reportUnfiled, warn = console.warn }: AreaSearchOptions,
): Promise<AreaSearch | null> {
  const all = await api.debouncedSearch(query, {}, debounceMs);
  if (!all) return null;
  const ranks = new Map(all.results.map((result, index) => [result.id, index]));
  const byArea = await Promise.all(
    areaCounts(all.filters).map(async ([area, count]) => {
      const { results } = await api.search(query, { filters: { area } });
      return { name: area as GroupName, total: count, results };
    }),
  );
  const filed = new Set(byArea.flatMap((area) => area.results.map((result) => result.id)));
  const unfiled = all.results.filter((result) => !filed.has(result.id));
  if (unfiled.length > 0)
    byArea.push({ name: OTHER_GROUP, total: unfiled.length, results: unfiled });

  const rest = new Map<GroupName, readonly PagefindResult[]>();
  const groups = await Promise.all(
    byArea.map(async ({ name, total, results }) => {
      rest.set(name, results.slice(GROUP_LIMIT));
      const hits = await loadHits(results.slice(0, GROUP_LIMIT), ranks, warn);
      if (name === OTHER_GROUP) for (const hit of hits) reportUnfiled(hit.pageUrl);
      return { name, total, hits };
    }),
  );
  return { total: all.results.length, groups, rest, ranks };
}

/**
 * Loads and shapes results. A result whose data fails to load is left out and
 * warned about by its Pagefind id (its URL is in the data that failed), so one
 * bad fragment never empties the list.
 */
export async function loadHits(
  results: readonly PagefindResult[],
  ranks: ReadonlyMap<string, number>,
  warn: (message: string, cause?: unknown) => void = console.warn,
): Promise<SearchHit[]> {
  const loaded = await Promise.allSettled(results.map((result) => result.data()));
  const hits: SearchHit[] = [];
  loaded.forEach((outcome, index) => {
    const id = results[index]?.id ?? "";
    if (outcome.status === "rejected") {
      warn(`Search could not load result ${id}, so it is left out.`, outcome.reason);
      return;
    }
    const hit = shapeResult(outcome.value, ranks.get(id) ?? Number.MAX_SAFE_INTEGER, warn);
    if (hit) hits.push(hit);
  });
  return hits;
}

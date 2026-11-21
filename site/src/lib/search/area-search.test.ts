import { describe, expect, it, vi } from "vitest";
import { loadHits, searchByArea } from "./area-search";
import { GROUP_LIMIT } from "./groups";
import type {
  PagefindApi,
  PagefindResult,
  PagefindResultData,
  PagefindSearchOptions,
} from "./pagefind-types";

type Page = { url: string; area?: string; fails?: boolean };

/**
 * A stand-in for Pagefind's browser API over a fixed ranked list of pages,
 * shaped like what pagefind.js 1.6 returns: results in rank order, `area`
 * filter counts on the unfiltered search, and `data()` loaded per result.
 */
function fakePagefind(pages: readonly Page[]) {
  const loads: string[] = [];
  const toResult = (page: Page, index: number): PagefindResult => ({
    id: `en_${index}`,
    data: async (): Promise<PagefindResultData> => {
      loads.push(page.url);
      if (page.fails) throw new Error(`fragment for ${page.url} returned 503`);
      return {
        url: page.url,
        excerpt: "<mark>sankey</mark>",
        meta: { title: page.url, ...(page.area ? { area: page.area } : {}) },
        sub_results: [],
      };
    },
  });
  const ranked = pages.map(toResult);
  const counts: Record<string, number> = {};
  for (const page of pages) if (page.area) counts[page.area] = (counts[page.area] ?? 0) + 1;
  const search = async (_term: string, options?: PagefindSearchOptions) => {
    const area = options?.filters?.area;
    const results = area ? ranked.filter((_, index) => pages[index]?.area === area) : ranked;
    return { results, filters: { area: counts } };
  };
  const api: PagefindApi = {
    init: async () => {},
    filters: async () => ({ area: counts }),
    search,
    debouncedSearch: search,
  };
  return { api, loads };
}

const pages = (area: string, count: number): Page[] =>
  Array.from({ length: count }, (_, index) => ({ url: `/${area.toLowerCase()}/${index}/`, area }));

const quiet = { debounceMs: 0, reportUnfiled: vi.fn(), warn: vi.fn() };

describe("searchByArea", () => {
  it("keeps a quiet area that a busy one would push out of a shared top 20", async () => {
    const { api } = fakePagefind([...pages("Reference", 25), ...pages("Examples", 1)]);
    const found = await searchByArea(api, "sankey", quiet);
    expect(found?.groups.map((group) => [group.name, group.total, group.hits.length])).toEqual([
      ["Reference", 25, GROUP_LIMIT],
      ["Examples", 1, 1],
    ]);
    expect(found?.total).toBe(26);
  });

  it(`loads data for each area's first ${GROUP_LIMIT} results only, keeping the rest for Show all`, async () => {
    const { api, loads } = fakePagefind([...pages("Guides", 8), ...pages("Blog", 2)]);
    const found = await searchByArea(api, "sankey", quiet);
    expect(loads.sort()).toEqual(
      [...pages("Guides", GROUP_LIMIT), ...pages("Blog", 2)].map((page) => page.url).sort(),
    );
    const rest = found?.rest.get("Guides") ?? [];
    const more = await loadHits(rest, found?.ranks ?? new Map(), vi.fn());
    expect(more.map((hit) => hit.pageUrl)).toEqual(
      pages("Guides", 8)
        .slice(GROUP_LIMIT)
        .map((page) => page.url),
    );
  });

  it("gives each hit its rank in the whole query, so the dialog can highlight the best", async () => {
    const { api } = fakePagefind([
      { url: "/a/", area: "Reference" },
      { url: "/b/", area: "Visualizations" },
      { url: "/c/", area: "Reference" },
    ]);
    const found = await searchByArea(api, "sankey", quiet);
    const ranks = found?.groups.flatMap((group) =>
      group.hits.map((hit) => [hit.pageUrl, hit.rank]),
    );
    expect(ranks).toEqual([
      ["/b/", 1],
      ["/a/", 0],
      ["/c/", 2],
    ]);
  });

  it("puts pages no area search returned under Other and reports each one", async () => {
    const reportUnfiled = vi.fn();
    const { api } = fakePagefind([{ url: "/stray/" }, { url: "/a/", area: "Guides" }]);
    const found = await searchByArea(api, "sankey", { ...quiet, reportUnfiled });
    expect(
      found?.groups.map((group) => [group.name, group.hits.map((hit) => hit.pageUrl)]),
    ).toEqual([
      ["Guides", ["/a/"]],
      ["Other", ["/stray/"]],
    ]);
    expect(reportUnfiled.mock.calls).toEqual([["/stray/"]]);
  });

  it("returns null when a newer keystroke replaced the debounced search", async () => {
    const { api } = fakePagefind(pages("Guides", 2));
    const replaced: PagefindApi = { ...api, debouncedSearch: async () => null };
    expect(await searchByArea(replaced, "sankey", quiet)).toBeNull();
  });
});

describe("loadHits", () => {
  it("keeps the results that loaded when one fails, and warns naming the failed one", async () => {
    const warn = vi.fn();
    const { api } = fakePagefind([
      { url: "/a/", area: "Guides" },
      { url: "/b/", area: "Guides", fails: true },
      { url: "/c/", area: "Guides" },
    ]);
    const { results } = await api.search("sankey");
    const hits = await loadHits(results, new Map(), warn);
    expect(hits.map((hit) => hit.pageUrl)).toEqual(["/a/", "/c/"]);
    expect(warn.mock.calls.map(([message]) => message)).toEqual([
      "Search could not load result en_1, so it is left out.",
    ]);
  });
});

import { describe, expect, it, vi } from "vitest";
import type { SearchArea } from "../search-index";
import { canExpand, GROUP_LIMIT, groupHits, shownHits } from "./groups";
import type { SearchHit } from "./result-shape";

const hit = (pageUrl: string, area: SearchArea | null): SearchHit => ({
  href: pageUrl,
  title: pageUrl,
  excerptHtml: "",
  area,
  location: null,
  pageUrl,
});

const urls = (hits: readonly SearchHit[]) => hits.map((each) => each.pageUrl);

describe("groupHits", () => {
  it("files hits in SEARCH_AREAS order, keeps rank order within a group and leaves out empty groups", () => {
    const warn = vi.fn();
    const groups = groupHits(
      [
        hit("/docs/spec/sankey-spec/", "Reference"),
        hit("/blog/flows/", "Blog"),
        hit("/docs/flow/sankey/", "Visualizations"),
        hit("/docs/api/react/", "Reference"),
        hit("/examples/energy-flow/", "Examples"),
        hit("/docs/upgrading/migrating-v8/", "Guides"),
      ],
      warn,
    );
    expect(groups.map((group) => [group.name, urls(group.hits)])).toEqual([
      ["Guides", ["/docs/upgrading/migrating-v8/"]],
      ["Visualizations", ["/docs/flow/sankey/"]],
      ["Reference", ["/docs/spec/sankey-spec/", "/docs/api/react/"]],
      ["Examples", ["/examples/energy-flow/"]],
      ["Blog", ["/blog/flows/"]],
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it("puts pages with no area last under Other and warns once for each, naming its URL", () => {
    const warn = vi.fn();
    const groups = groupHits(
      [
        hit("/docs/stray/", null),
        hit("/docs/flow/sankey/", "Visualizations"),
        hit("/fixtures/demo/", null),
      ],
      warn,
    );
    expect(groups.map((group) => [group.name, urls(group.hits)])).toEqual([
      ["Visualizations", ["/docs/flow/sankey/"]],
      ["Other", ["/docs/stray/", "/fixtures/demo/"]],
    ]);
    expect(warn.mock.calls).toEqual([
      ["Search result /docs/stray/ has no search area, so it is listed under Other."],
      ["Search result /fixtures/demo/ has no search area, so it is listed under Other."],
    ]);
  });

  it("returns no groups for no hits", () => {
    expect(groupHits([], vi.fn())).toEqual([]);
  });
});

describe("shownHits", () => {
  const groupOf = (count: number) =>
    groupHits(
      Array.from({ length: count }, (_, index) => hit(`/docs/page-${index}/`, "Reference")),
      vi.fn(),
    )[0] ?? { name: "Reference" as const, hits: [] };

  it(`shows ${GROUP_LIMIT} of a larger group until it is expanded`, () => {
    const group = groupOf(GROUP_LIMIT + 3);
    expect(canExpand(group)).toBe(true);
    expect(urls(shownHits(group, false))).toEqual(urls(group.hits.slice(0, GROUP_LIMIT)));
    expect(shownHits(group, true)).toHaveLength(GROUP_LIMIT + 3);
  });

  it(`shows a group of exactly ${GROUP_LIMIT} whole, with nothing to expand`, () => {
    const group = groupOf(GROUP_LIMIT);
    expect(canExpand(group)).toBe(false);
    expect(shownHits(group, false)).toHaveLength(GROUP_LIMIT);
  });
});

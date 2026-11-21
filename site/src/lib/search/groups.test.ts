import { describe, expect, it, vi } from "vitest";
import type { SearchArea } from "../search-index";
import {
  areaCounts,
  bestHit,
  canExpand,
  createUnfiledReporter,
  GROUP_LIMIT,
  orderGroups,
  type ResultGroup,
} from "./groups";
import type { SearchHit } from "./result-shape";

const hit = (pageUrl: string, area: SearchArea | null = null): SearchHit => ({
  href: pageUrl,
  title: pageUrl,
  excerptHtml: "",
  area,
  location: null,
  pageUrl,
  rank: 0,
});

const group = (name: ResultGroup["name"], loaded: number, total = loaded): ResultGroup => ({
  name,
  total,
  hits: Array.from({ length: loaded }, (_, index) => hit(`/${name}/${index}/`)),
});

describe("areaCounts", () => {
  it("lists the areas with matches in SEARCH_AREAS order and leaves out the empty ones", () => {
    const counts = areaCounts({
      area: { Blog: 1, "Building blocks": 0, Examples: 2, Guides: 5, Reference: 13 },
    });
    expect(counts).toEqual([
      ["Guides", 5],
      ["Reference", 13],
      ["Examples", 2],
      ["Blog", 1],
    ]);
  });

  it("finds no areas when the search carries no area counts", () => {
    expect(areaCounts(undefined)).toEqual([]);
    expect(areaCounts({ tag: { climate: 3 } })).toEqual([]);
  });
});

describe("orderGroups", () => {
  it("puts groups in SEARCH_AREAS order with Other last, leaving out groups with nothing loaded", () => {
    const ordered = orderGroups([
      group("Other", 1),
      group("Blog", 2),
      group("Guides", 0, 3),
      group("Visualizations", 1),
      group("Reference", 4),
    ]);
    expect(ordered.map((each) => each.name)).toEqual([
      "Visualizations",
      "Reference",
      "Blog",
      "Other",
    ]);
  });
});

describe("canExpand", () => {
  it(`offers the rest of a group whose matches outnumber the ${GROUP_LIMIT} it loaded`, () => {
    expect(canExpand(group("Reference", GROUP_LIMIT, 13))).toBe(true);
  });

  it("offers nothing once every match has loaded", () => {
    expect(canExpand(group("Reference", 13, 13))).toBe(false);
    expect(canExpand(group("Guides", GROUP_LIMIT, GROUP_LIMIT))).toBe(false);
  });
});

describe("createUnfiledReporter", () => {
  it("warns once per URL, naming it, however many searches find the page", () => {
    const warn = vi.fn();
    const report = createUnfiledReporter(warn);
    report("/docs/stray/");
    report("/fixtures/demo/");
    report("/docs/stray/");
    expect(warn.mock.calls).toEqual([
      ["Search result /docs/stray/ has no search area, so it is listed under Other."],
      ["Search result /fixtures/demo/ has no search area, so it is listed under Other."],
    ]);
  });
});

describe("bestHit", () => {
  const ranked = (title: string, rank: number): SearchHit => ({ ...hit(`/${rank}/`), title, rank });
  const groups = (...hits: SearchHit[]): ResultGroup[] => [
    { name: "Reference", total: hits.length, hits },
  ];

  it("picks the page titled with the query over a better-ranked page", () => {
    const best = bestHit(groups(ranked("SankeySpec", 0), ranked("Sankey", 1)), " sankey ");
    expect(best?.title).toBe("Sankey");
  });

  it("picks the best rank when no title is the query, wherever its group sits", () => {
    const later: ResultGroup = { name: "Examples", total: 1, hits: [ranked("Energy flow", 0)] };
    const best = bestHit([...groups(ranked("Migrating to v8", 4)), later], "flow");
    expect(best?.title).toBe("Energy flow");
  });

  it("picks the better rank between two exact title matches", () => {
    expect(bestHit(groups(ranked("Bar", 3), ranked("bar", 1)), "Bar")?.rank).toBe(1);
  });

  it("finds nothing in no results", () => {
    expect(bestHit([], "sankey")).toBeUndefined();
  });
});

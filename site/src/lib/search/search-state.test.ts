import { describe, expect, it } from "vitest";
import { SEARCH_UNAVAILABLE } from "../search-index";
import type { ResultGroup } from "./groups";
import type { SearchHit } from "./result-shape";
import {
  IDLE,
  panelMessage,
  type SearchAction,
  type SearchState,
  searchReducer,
  statusAnnouncement,
} from "./search-state";

const hit = (pageUrl: string): SearchHit => ({
  href: pageUrl,
  title: pageUrl,
  excerptHtml: "",
  area: "Reference",
  location: null,
  pageUrl,
});

const reference = (count: number): ResultGroup => ({
  name: "Reference",
  hits: Array.from({ length: count }, (_, index) => hit(`/docs/page-${index}/`)),
});

const run = (actions: readonly SearchAction[], from: SearchState = IDLE) =>
  actions.reduce(searchReducer, from);

/** The state, what the panel shows and what the status region announces. */
const view = (state: SearchState) => ({
  status: state.status,
  message: panelMessage(state),
  announced: statusAnnouncement(state),
});

describe("searchReducer", () => {
  it("starts idle, showing and announcing nothing", () => {
    expect(view(IDLE)).toEqual({ status: "idle", message: null, announced: "" });
  });

  it("loads while a search runs, without announcing anything", () => {
    const state = run([{ type: "typed", query: "sankey" }]);
    expect(view(state)).toEqual({ status: "loading", message: null, announced: null });
  });

  it("shows results and announces how many", () => {
    const state = run([
      { type: "typed", query: "sankey" },
      { type: "found", query: "sankey", groups: [reference(3)] },
    ]);
    expect(view(state)).toEqual({ status: "results", message: null, announced: "3 results" });
    expect(
      statusAnnouncement(
        run([{ type: "found", query: "sankey", groups: [reference(1)] }], {
          status: "loading",
          query: "sankey",
          groups: [],
        }),
      ),
    ).toBe("1 result");
  });

  it("says no results for the query, in curly quotes", () => {
    const state = run([
      { type: "typed", query: "  zebra " },
      { type: "found", query: "zebra", groups: [] },
    ]);
    expect(view(state)).toEqual({
      status: "empty",
      message: "No results for “zebra”",
      announced: "No results for “zebra”",
    });
  });

  it("stays unavailable once the index fails, whatever the reader types", () => {
    const state = run([
      { type: "typed", query: "sankey" },
      { type: "unavailable" },
      { type: "typed", query: "bar" },
      { type: "found", query: "bar", groups: [reference(2)] },
    ]);
    expect(view(state)).toEqual({
      status: "unavailable",
      message: SEARCH_UNAVAILABLE,
      announced: SEARCH_UNAVAILABLE,
    });
  });

  it("keeps the last results on screen while the next search loads", () => {
    const groups = [reference(2)];
    const state = run([
      { type: "typed", query: "san" },
      { type: "found", query: "san", groups },
      { type: "typed", query: "sankey" },
    ]);
    expect(state).toEqual({ status: "loading", query: "sankey", groups });
  });

  it("drops results for a query the reader has since changed", () => {
    const state = run([
      { type: "typed", query: "san" },
      { type: "typed", query: "sankey" },
      { type: "found", query: "san", groups: [reference(9)] },
    ]);
    expect(state).toEqual({ status: "loading", query: "sankey", groups: [] });
  });

  it("returns to idle when the query is cleared, and ignores a search that finishes after", () => {
    const state = run([
      { type: "typed", query: "sankey" },
      { type: "typed", query: "   " },
      { type: "found", query: "sankey", groups: [reference(2)] },
    ]);
    expect(state).toEqual(IDLE);
  });

  it("expands a group until the next results arrive", () => {
    const expanded = run([
      { type: "typed", query: "spec" },
      { type: "found", query: "spec", groups: [reference(8)] },
      { type: "expand", group: "Reference" },
    ]);
    expect(expanded.status === "results" && [...expanded.expanded]).toEqual(["Reference"]);
    const next = run(
      [
        { type: "typed", query: "specs" },
        { type: "found", query: "specs", groups: [reference(8)] },
      ],
      expanded,
    );
    expect(next.status === "results" && [...next.expanded]).toEqual([]);
  });
});

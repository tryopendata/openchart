import { describe, expect, it } from "vitest";
import { SEARCH_UNAVAILABLE } from "../search-index";
import type { ResultGroup } from "./groups";
import type { SearchHit } from "./result-shape";
import {
  IDLE,
  panelMessage,
  progressMessage,
  SEARCH_FAILED,
  SEARCHING,
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
  rank: 0,
});

const reference = (loaded: number, total = loaded): ResultGroup => ({
  name: "Reference",
  total,
  hits: Array.from({ length: loaded }, (_, index) => hit(`/docs/page-${index}/`)),
});

const run = (actions: readonly SearchAction[], from: SearchState = IDLE) =>
  actions.reduce(searchReducer, from);

/** The state, what the panel shows, what it shows while loading and what it announces. */
const view = (state: SearchState) => ({
  status: state.status,
  message: panelMessage(state),
  progress: progressMessage(state),
  announced: statusAnnouncement(state),
});

const found = (query: string, groups: ResultGroup[], total = 0): SearchAction => ({
  type: "found",
  query,
  total,
  groups,
});

describe("searchReducer", () => {
  it("starts idle, showing and announcing nothing", () => {
    expect(view(IDLE)).toEqual({ status: "idle", message: null, progress: null, announced: "" });
  });

  it("shows Searching… without announcing it while the first results load", () => {
    const state = run([{ type: "typed", query: "sankey" }]);
    expect(view(state)).toEqual({
      status: "loading",
      message: null,
      progress: SEARCHING,
      announced: null,
    });
  });

  it("announces the true match count with the query, not just what loaded", () => {
    const state = run([
      { type: "typed", query: "sankey" },
      found("sankey", [reference(5, 13)], 20),
    ]);
    expect(view(state)).toEqual({
      status: "results",
      message: null,
      progress: null,
      announced: "20 results for “sankey”",
    });
    const one = run([{ type: "typed", query: "waffle" }, found("waffle", [reference(1)], 1)]);
    expect(statusAnnouncement(one)).toBe("1 result for “waffle”");
  });

  it("says no results for the query, in curly quotes", () => {
    const state = run([{ type: "typed", query: "  wombat " }, found("wombat", [])]);
    expect(view(state)).toEqual({
      status: "empty",
      message: "No results for “wombat”",
      progress: null,
      announced: "No results for “wombat”",
    });
  });

  it("counts a search whose groups all came back empty as no results", () => {
    const state = run([{ type: "typed", query: "sankey" }, found("sankey", [reference(0, 3)], 3)]);
    expect(state.status).toBe("empty");
  });

  it("shows the failure message when a search fails, and leaves it on the next keystroke", () => {
    const failed = run([
      { type: "typed", query: "sankey" },
      { type: "failed", query: "sankey" },
    ]);
    expect(view(failed)).toEqual({
      status: "failed",
      message: SEARCH_FAILED,
      progress: null,
      announced: SEARCH_FAILED,
    });
    expect(run([{ type: "typed", query: "sankeys" }], failed).status).toBe("loading");
  });

  it("shows the unavailable message when the index fails, and typing tries again", () => {
    const unavailable = run([{ type: "typed", query: "sankey" }, { type: "unavailable" }]);
    expect(view(unavailable)).toEqual({
      status: "unavailable",
      message: SEARCH_UNAVAILABLE,
      progress: null,
      announced: SEARCH_UNAVAILABLE,
    });
    expect(run([{ type: "typed", query: "bar" }], unavailable).status).toBe("loading");
  });

  it("keeps the last results on screen while the next search loads, with no Searching… line", () => {
    const groups = [reference(2)];
    const state = run([
      { type: "typed", query: "san" },
      found("san", groups, 2),
      { type: "typed", query: "sankey" },
    ]);
    expect(state).toEqual({ status: "loading", query: "sankey", groups });
    expect(progressMessage(state)).toBeNull();
  });

  it("drops results and failures for a query the reader has since changed", () => {
    const state = run([
      { type: "typed", query: "san" },
      { type: "typed", query: "sankey" },
      found("san", [reference(9)], 9),
      { type: "failed", query: "san" },
    ]);
    expect(state).toEqual({ status: "loading", query: "sankey", groups: [] });
  });

  it("returns to idle when the query is cleared, and ignores a search that finishes after", () => {
    const state = run([
      { type: "typed", query: "sankey" },
      { type: "typed", query: "   " },
      found("sankey", [reference(2)], 2),
    ]);
    expect(state).toEqual(IDLE);
  });

  it("adds a group's remaining results when they load, for the current query only", () => {
    const shown = run([{ type: "typed", query: "spec" }, found("spec", [reference(5, 7)], 7)]);
    const rest = [hit("/docs/page-5/"), hit("/docs/page-6/")];
    const stale = run([{ type: "expanded", query: "spe", group: "Reference", hits: rest }], shown);
    expect(stale).toBe(shown);
    const expanded = run(
      [{ type: "expanded", query: "spec", group: "Reference", hits: rest }],
      shown,
    );
    expect(expanded.status === "results" && expanded.groups[0]?.hits.length).toBe(7);
  });
});

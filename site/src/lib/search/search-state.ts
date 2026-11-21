/**
 * The search dialog's states and the text each one shows and announces, as a
 * reducer: idle (no query), loading (a search is running; the last results stay
 * on screen so the list does not flash), results, empty, failed (a search threw)
 * and unavailable (Pagefind itself did not load). Typing leaves every state, so
 * a failure never outlasts the next keystroke. Results for a query the reader
 * has since changed are dropped, so a slow search never overwrites a newer one.
 */
import { SEARCH_UNAVAILABLE } from "../search-index";
import { type GroupName, orderGroups, type ResultGroup } from "./groups";
import type { SearchHit } from "./result-shape";

/** Shown when a search fails after the index loaded. */
export const SEARCH_FAILED = "Search failed. Check your connection and try again.";

/** Shown while the first results for a query load. Not announced. */
export const SEARCHING = "Searching…";

/** What the dialog is showing. */
export type SearchState =
  | { status: "idle"; query: "" }
  | { status: "loading"; query: string; groups: readonly ResultGroup[] }
  | { status: "results"; query: string; total: number; groups: readonly ResultGroup[] }
  | { status: "empty"; query: string }
  | { status: "failed"; query: string }
  | { status: "unavailable" };

/** What happened: the reader typed, a search finished or failed, the index failed, a group loaded in full. */
export type SearchAction =
  | { type: "typed"; query: string }
  | { type: "found"; query: string; total: number; groups: readonly ResultGroup[] }
  | { type: "failed"; query: string }
  | { type: "unavailable" }
  | { type: "expanded"; query: string; group: GroupName; hits: readonly SearchHit[] };

/** The state before the reader types anything. */
export const IDLE: SearchState = { status: "idle", query: "" };

/** The next state after an action. */
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "typed": {
      const query = action.query.trim();
      if (!query) return IDLE;
      return { status: "loading", query, groups: groupsOnScreen(state) };
    }
    case "unavailable":
      return { status: "unavailable" };
    case "found": {
      if (state.status !== "loading" || state.query !== action.query.trim()) return state;
      const groups = orderGroups(action.groups);
      if (groups.length === 0) return { status: "empty", query: state.query };
      return { status: "results", query: state.query, total: action.total, groups };
    }
    case "failed":
      if (state.status !== "loading" || state.query !== action.query.trim()) return state;
      return { status: "failed", query: state.query };
    case "expanded": {
      if (state.status !== "results" || state.query !== action.query.trim()) return state;
      const groups = state.groups.map((group) =>
        group.name === action.group ? { ...group, hits: [...group.hits, ...action.hits] } : group,
      );
      return { ...state, groups };
    }
  }
}

function groupsOnScreen(state: SearchState): readonly ResultGroup[] {
  return state.status === "results" || state.status === "loading" ? state.groups : [];
}

/** The message the panel shows in place of results, and announces; null when it shows results or nothing. */
export function panelMessage(state: SearchState): string | null {
  if (state.status === "empty") return `No results for “${state.query}”`;
  if (state.status === "failed") return SEARCH_FAILED;
  if (state.status === "unavailable") return SEARCH_UNAVAILABLE;
  return null;
}

/** The progress line shown, not announced, while the first results load; null otherwise. */
export function progressMessage(state: SearchState): string | null {
  return state.status === "loading" && state.groups.length === 0 ? SEARCHING : null;
}

/**
 * What the polite status region announces. Loading keeps the last announcement
 * (null), so typing does not make a screen reader chatter. A count names its
 * query, so two searches in a row with the same count still sound different.
 */
export function statusAnnouncement(state: SearchState): string | null {
  switch (state.status) {
    case "idle":
      return "";
    case "loading":
      return null;
    case "results":
      return `${state.total === 1 ? "1 result" : `${state.total} results`} for “${state.query}”`;
    default:
      return panelMessage(state);
  }
}

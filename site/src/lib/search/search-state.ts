/**
 * The search dialog's states and the text each one shows and announces, as a
 * reducer: idle (no query), loading (a search is running; the last results stay
 * on screen so the list does not flash), results, empty and unavailable (the
 * index could not load). Results for a query the reader has since changed are
 * dropped, so a slow search never overwrites a newer one.
 */
import { SEARCH_UNAVAILABLE } from "../search-index";
import type { GroupName, ResultGroup } from "./groups";

/** What the dialog is showing. */
export type SearchState =
  | { status: "idle"; query: "" }
  | { status: "loading"; query: string; groups: readonly ResultGroup[] }
  | {
      status: "results";
      query: string;
      groups: readonly ResultGroup[];
      expanded: ReadonlySet<GroupName>;
    }
  | { status: "empty"; query: string }
  | { status: "unavailable" };

/** What happened: the reader typed, a search finished, the index failed, a group opened. */
export type SearchAction =
  | { type: "typed"; query: string }
  | { type: "found"; query: string; groups: readonly ResultGroup[] }
  | { type: "unavailable" }
  | { type: "expand"; group: GroupName };

/** The state before the reader types anything. */
export const IDLE: SearchState = { status: "idle", query: "" };

/** The next state after an action. */
export function searchReducer(state: SearchState, action: SearchAction): SearchState {
  if (state.status === "unavailable") return state;
  switch (action.type) {
    case "unavailable":
      return { status: "unavailable" };
    case "typed": {
      const query = action.query.trim();
      if (!query) return IDLE;
      return { status: "loading", query, groups: groupsOnScreen(state) };
    }
    case "found":
      if (state.status !== "loading" || action.query.trim() !== state.query) return state;
      if (action.groups.length === 0) return { status: "empty", query: state.query };
      return { status: "results", query: state.query, groups: action.groups, expanded: new Set() };
    case "expand":
      if (state.status !== "results") return state;
      return { ...state, expanded: new Set([...state.expanded, action.group]) };
  }
}

function groupsOnScreen(state: SearchState): readonly ResultGroup[] {
  return state.status === "results" || state.status === "loading" ? state.groups : [];
}

/** The message the panel shows in place of results, or null when it shows results or nothing. */
export function panelMessage(state: SearchState): string | null {
  if (state.status === "empty") return `No results for “${state.query}”`;
  if (state.status === "unavailable") return SEARCH_UNAVAILABLE;
  return null;
}

/**
 * What the polite status region announces. Loading keeps the last
 * announcement (null), so typing does not make a screen reader chatter.
 */
export function statusAnnouncement(state: SearchState): string | null {
  switch (state.status) {
    case "idle":
      return "";
    case "loading":
      return null;
    case "results": {
      const count = state.groups.reduce((sum, group) => sum + group.hits.length, 0);
      return count === 1 ? "1 result" : `${count} results`;
    }
    default:
      return panelMessage(state);
  }
}

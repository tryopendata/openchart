/**
 * The lazy part of site search, imported by search.ts on the first hover, focus
 * or open of the trigger. search.ts has already shown the dialog in
 * components/search/Search.astro and focused its input; this module runs the
 * combobox over a listbox of grouped results. Each query goes through
 * lib/search/area-search.ts (one debounced Pagefind search, then one filtered
 * search per area); the pure rules in lib/search/ shape and track the results,
 * and components/search/result-list.ts draws them. Text typed before this
 * module arrived is searched as soon as it does.
 */
import { motionTokens } from "@steamfield/ui/reveal";
import { loadPagefind, PAGEFIND_URL } from "../components/search/pagefind-index";
import { renderResultList } from "../components/search/result-list";
import { type AreaSearch, loadHits, searchByArea } from "../lib/search/area-search";
import { bestHit, createUnfiledReporter, type GroupName } from "../lib/search/groups";
import type { PagefindApi } from "../lib/search/pagefind-types";
import {
  IDLE,
  panelMessage,
  progressMessage,
  type SearchAction,
  type SearchState,
  searchReducer,
  statusAnnouncement,
} from "../lib/search/search-state";
import { SEARCH_UNAVAILABLE_HINT } from "../lib/search-index";

/** How long Pagefind waits after the last keystroke before it searches. */
const DEBOUNCE_MS = 150;

type SearchDialog = { open: () => void; prepare: () => void };

const dialogs = new WeakMap<HTMLDialogElement, SearchDialog>();

/** Takes over the dialog search.ts opened: wires it on first use and searches whatever is typed. */
export function openSearch(dialog: HTMLDialogElement): void {
  searchDialogFor(dialog).open();
}

/** Wires the dialog and starts loading the index ahead of the first open. */
export function prepareSearch(dialog: HTMLDialogElement): void {
  searchDialogFor(dialog).prepare();
}

function searchDialogFor(dialog: HTMLDialogElement): SearchDialog {
  let search = dialogs.get(dialog);
  if (!search) {
    search = createSearchDialog(dialog);
    dialogs.set(dialog, search);
  }
  return search;
}

/** The dialog's parts, from Search.astro. */
function dialogParts(dialog: HTMLDialogElement) {
  const input = dialog.querySelector<HTMLInputElement>("[data-search-input]");
  const listbox = dialog.querySelector<HTMLElement>("[data-search-results]");
  const progress = dialog.querySelector<HTMLElement>("[data-search-progress]");
  const status = dialog.querySelector<HTMLElement>("[data-search-status]");
  if (!input || !listbox || !progress || !status) {
    throw new Error(
      "The search dialog lacks its input, listbox, progress line or status line. Search.astro must render all four.",
    );
  }
  return { input, listbox, progress, status };
}

function createSearchDialog(dialog: HTMLDialogElement): SearchDialog {
  const { input, listbox, progress, status } = dialogParts(dialog);
  const reportUnfiled = createUnfiledReporter();
  let state: SearchState = IDLE;
  let options: HTMLElement[] = [];
  let active = -1;
  let index: Promise<PagefindApi | null> | undefined;
  /** The search behind the results on screen, for loading a group's rest. */
  let shown: (AreaSearch & { query: string }) | undefined;
  /** Enter was pressed while a search ran: follow the best result once it lands. */
  let enterPending = false;

  /**
   * Pagefind, or null when it failed to load. The failure is logged and shown
   * once, then forgotten, so the next open or keystroke tries again.
   */
  function pagefind(): Promise<PagefindApi | null> {
    index ??= loadPagefind().catch((error: unknown) => {
      index = undefined;
      console.warn(
        `Search is unavailable: ${PAGEFIND_URL} did not load. ${SEARCH_UNAVAILABLE_HINT}`,
        error,
      );
      dispatch({ type: "unavailable" });
      return null;
    });
    return index;
  }

  function dispatch(action: SearchAction): void {
    const previous = state;
    state = searchReducer(state, action);
    if (state !== previous) render(action);
  }

  function render(action: SearchAction): void {
    const progressText = progressMessage(state);
    progress.hidden = progressText === null;
    progress.textContent = progressText ?? "";
    // One line both shows a message ("No results…") and announces counts, which only screen readers hear.
    const announcement = statusAnnouncement(state);
    if (announcement !== null) status.textContent = announcement;
    status.classList.toggle("sr-only", panelMessage(state) === null);
    listbox.setAttribute("aria-busy", String(state.status === "loading"));
    // While a search runs the last results stay as they are, so the list never flashes.
    if (state.status === "loading") return;
    const firstNew =
      action.type === "expanded"
        ? options.findIndex((option) => option.dataset.expand === action.group)
        : -1;
    const best = drawResults();
    listbox.hidden = options.length === 0;
    input.setAttribute("aria-expanded", String(options.length > 0));
    setActive(firstNew >= 0 ? firstNew : best);
    const follow = enterPending && action.type === "found" ? options[active] : undefined;
    enterPending = false;
    if (follow) choose(follow);
  }

  /** Draws the results, or clears the list, and returns the option to highlight (-1 for none). */
  function drawResults(): number {
    if (state.status !== "results") {
      options = [];
      listbox.replaceChildren();
      return -1;
    }
    const rendered = renderResultList(listbox, state.groups);
    options = rendered.options;
    const top = bestHit(state.groups, state.query);
    const at = top ? options.indexOf(rendered.optionFor.get(top) ?? listbox) : -1;
    return Math.max(at, 0);
  }

  function setActive(next: number, scroll = true): void {
    options[active]?.setAttribute("aria-selected", "false");
    active = next;
    const option = options[active];
    if (!option) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    option.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", option.id);
    if (scroll) option.scrollIntoView({ block: "nearest" });
  }

  /** Follows a result, or loads the rest of a group for its "Show all" option. */
  function choose(option: HTMLElement): void {
    const group = option.dataset.expand as GroupName | undefined;
    if (group) {
      void expand(group);
      return;
    }
    const href = option.getAttribute("href");
    if (!href) return;
    dialog.close();
    window.location.assign(href);
  }

  async function expand(group: GroupName): Promise<void> {
    const search = shown;
    const rest = search?.rest.get(group);
    if (!search || !rest || rest.length === 0) return;
    search.rest.set(group, []);
    const hits = await loadHits(rest, search.ranks);
    dispatch({ type: "expanded", query: search.query, group, hits });
  }

  function runQuery(value: string): void {
    enterPending = false;
    dispatch({ type: "typed", query: value });
    if (state.status === "loading") void search(state.query);
  }

  async function search(query: string): Promise<void> {
    const api = await pagefind();
    if (!api) return;
    try {
      const found = await searchByArea(api, query, { debounceMs: DEBOUNCE_MS, reportUnfiled });
      if (!found) return; // A newer keystroke replaced this search.
      dispatch({ type: "found", query, total: found.total, groups: found.groups });
      if (state.status === "results" && state.query === query) shown = { ...found, query };
    } catch (error) {
      console.error(`Pagefind failed while searching for "${query}".`, error);
      dispatch({ type: "failed", query });
    }
  }

  input.addEventListener("input", () => runQuery(input.value));

  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Enter" && state.status === "loading") {
      // The results on screen are for an older query; wait for this one's.
      enterPending = true;
      event.preventDefault();
      return;
    }
    if (options.length === 0) return;
    const activeOption = options[active];
    if (event.key === "ArrowDown") setActive((active + 1) % options.length);
    else if (event.key === "ArrowUp") setActive((active - 1 + options.length) % options.length);
    else if (event.key === "Enter" && activeOption) choose(activeOption);
    else return;
    event.preventDefault();
  });

  // Keep focus in the input when an option is pressed, so the combobox stays in charge.
  listbox.addEventListener("mousedown", (event) => event.preventDefault());
  listbox.addEventListener("pointermove", (event) => {
    const option = optionAt(event.target);
    if (option) setActive(options.indexOf(option), false);
  });
  listbox.addEventListener("click", (event) => {
    const option = optionAt(event.target);
    if (!option) return;
    // A modified click opens the link in a new tab or window; leave it to the browser.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    choose(option);
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && outside(dialog, event)) dialog.close();
  });
  applyEntranceTiming(dialog);
  render({ type: "typed", query: "" });

  return {
    prepare: () => void pagefind(),
    // search.ts has shown the dialog already; it may have been closed again while
    // this module loaded, so this never reopens it, only searches what was typed.
    open() {
      const current = "query" in state ? state.query : "";
      const retry = state.status === "unavailable" || state.status === "failed";
      if (retry || input.value.trim() !== current) runQuery(input.value);
      void pagefind();
    },
  };
}

function optionAt(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[role="option"]') : null;
}

/** True when a click landed on the backdrop, outside the panel's box. */
function outside(dialog: HTMLDialogElement, event: MouseEvent): boolean {
  const box = dialog.getBoundingClientRect();
  return (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  );
}

/** Gives the CSS entrance (search.css) the shared motion timings: a small lift and a fade. */
function applyEntranceTiming(dialog: HTMLDialogElement): void {
  const lift = motionTokens.animationTypes["lift-xs"].initial.transform ?? "none";
  dialog.style.setProperty("--search-enter-from", lift);
  dialog.style.setProperty("--search-enter-duration", `${motionTokens.durations.chip}s`);
  dialog.style.setProperty("--search-enter-easing", motionTokens.easings.expoOut);
}

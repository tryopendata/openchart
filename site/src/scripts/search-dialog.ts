/**
 * The lazy part of site search, imported by search.ts on the first hover, focus
 * or open of the trigger. It runs the dialog in components/search/Search.astro:
 * a native modal (focus trapped, page inert, Escape closes) whose input is a
 * combobox over a listbox of grouped results. Typing runs Pagefind's debounced
 * search; the pure rules in lib/search/ shape, group and track the results, and
 * components/search/result-list.ts draws them.
 */
import { motionTokens } from "@steamfield/ui/reveal";
import { loadPagefind, PAGEFIND_URL } from "../components/search/pagefind-index";
import { renderResultList } from "../components/search/result-list";
import { type GroupName, groupHits } from "../lib/search/groups";
import type { PagefindApi } from "../lib/search/pagefind-types";
import { shapeResult } from "../lib/search/result-shape";
import {
  IDLE,
  panelMessage,
  type SearchAction,
  type SearchState,
  searchReducer,
  statusAnnouncement,
} from "../lib/search/search-state";

/** Results whose data loads per search; Pagefind ranks them, so these are the best. */
const RESULT_LIMIT = 20;
/** How long Pagefind waits after the last keystroke before it searches. */
const DEBOUNCE_MS = 150;

type SearchDialog = { open: () => void; prepare: () => void };

const dialogs = new WeakMap<HTMLDialogElement, SearchDialog>();

/** Opens the search dialog, wiring it on first use. */
export function openSearch(dialog: HTMLDialogElement, trigger: HTMLElement): void {
  searchDialogFor(dialog, trigger).open();
}

/** Wires the dialog and starts loading the index ahead of the first open. */
export function prepareSearch(dialog: HTMLDialogElement, trigger: HTMLElement): void {
  searchDialogFor(dialog, trigger).prepare();
}

function searchDialogFor(dialog: HTMLDialogElement, trigger: HTMLElement): SearchDialog {
  let search = dialogs.get(dialog);
  if (!search) {
    search = createSearchDialog(dialog, trigger);
    dialogs.set(dialog, search);
  }
  return search;
}

/** The dialog's parts, from Search.astro. */
function dialogParts(dialog: HTMLDialogElement) {
  const input = dialog.querySelector<HTMLInputElement>("[data-search-input]");
  const listbox = dialog.querySelector<HTMLElement>("[data-search-results]");
  const status = dialog.querySelector<HTMLElement>("[data-search-status]");
  const close = dialog.querySelector<HTMLButtonElement>("[data-search-close]");
  if (!input || !listbox || !status || !close) {
    throw new Error(
      "The search dialog lacks its input, listbox, status line or close button. Search.astro must render all four.",
    );
  }
  return { input, listbox, status, close };
}

function createSearchDialog(dialog: HTMLDialogElement, trigger: HTMLElement): SearchDialog {
  const { input, listbox, status, close } = dialogParts(dialog);
  let state: SearchState = IDLE;
  let options: HTMLElement[] = [];
  let active = -1;
  let index: Promise<PagefindApi | null> | undefined;

  /** Pagefind, or null once it has failed to load; the failure is logged and shown once. */
  function pagefind(): Promise<PagefindApi | null> {
    index ??= loadPagefind().catch((error: unknown) => {
      // Expected on the dev server, which has no index: a warning, not an error.
      console.warn(`Search is unavailable: ${PAGEFIND_URL} did not load.`, error);
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
    // One line both shows a message ("No results…") and announces counts, which only screen readers hear.
    const announcement = statusAnnouncement(state);
    if (announcement !== null) status.textContent = announcement;
    status.classList.toggle("sr-only", panelMessage(state) === null);
    // While a search runs the last results stay as they are, so the list never flashes.
    if (state.status === "loading") return;
    const firstShown = action.type === "expand" ? firstHiddenIndex(action.group) : 0;
    options =
      state.status === "results" ? renderResultList(listbox, state.groups, state.expanded) : [];
    if (state.status !== "results") listbox.replaceChildren();
    listbox.hidden = options.length === 0;
    input.setAttribute("aria-expanded", String(options.length > 0));
    setActive(options.length > 0 ? Math.min(firstShown, options.length - 1) : -1);
  }

  /** Where the "Show all" option of `group` sits: its first hidden result takes that place. */
  function firstHiddenIndex(group: GroupName): number {
    const more = options.findIndex((option) => option.dataset.expand === group);
    return Math.max(more, 0);
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

  /** Follows a result, or expands a group for its "Show all" option. */
  function choose(option: HTMLElement): void {
    const group = option.dataset.expand as GroupName | undefined;
    if (group) {
      dispatch({ type: "expand", group });
      return;
    }
    const href = option.getAttribute("href");
    if (!href) return;
    dialog.close();
    window.location.assign(href);
  }

  async function search(query: string): Promise<void> {
    const api = await pagefind();
    if (!api) return;
    try {
      const found = await api.debouncedSearch(query, {}, DEBOUNCE_MS);
      if (!found) return; // A newer keystroke replaced this search.
      const top = found.results.slice(0, RESULT_LIMIT);
      const data = await Promise.all(top.map((result) => result.data()));
      dispatch({ type: "found", query, groups: groupHits(data.map(shapeResult)) });
    } catch (error) {
      console.error(`Pagefind failed while searching for "${query}".`, error);
      dispatch({ type: "unavailable" });
    }
  }

  input.addEventListener("input", () => {
    dispatch({ type: "typed", query: input.value });
    if (state.status === "loading") void search(state.query);
  });

  input.addEventListener("keydown", (event) => {
    if (event.isComposing || options.length === 0) return;
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

  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog && outside(dialog, event)) dialog.close();
  });
  dialog.addEventListener("close", () => trigger.focus({ preventScroll: true }));

  return {
    prepare: () => void pagefind(),
    open() {
      if (dialog.open) return;
      dialog.showModal();
      playEntrance(dialog);
      input.focus();
      input.select();
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

/** Lifts the panel in and fades the backdrop, with the shared motion timings; nothing under reduced motion. */
function playEntrance(dialog: HTMLDialogElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const { initial, animate } = motionTokens.animationTypes["lift-xs"];
  const timing = {
    duration: motionTokens.durations.chip * 1000,
    easing: motionTokens.easings.expoOut,
  };
  dialog.animate([{ ...initial }, { ...animate }], timing);
  dialog.animate({ opacity: [0, 1] }, { ...timing, pseudoElement: "::backdrop" });
}

/**
 * The gallery pages' behavior, as plain DOM code that does nothing without its
 * markup. On /examples/ it runs the filter: a choice is a history entry under
 * `#kind=` (All is the bare URL), so Back and Forward step through choices; a
 * change shows and hides tiles by `data-kind` and writes the choice as
 * `data-filter` on the wall, which drops the arranged layout (gallery.css). With
 * motion allowed the tiles refile with Flip; GSAP loads only when the reader
 * first points at or tabs into the filter, and a change before it arrives
 * applies at once, as it always does under reduced motion. The live region
 * reads the chosen button's sentence. On an entry page it records the view.
 * Loaded only by the two gallery pages, through their own `<script>`.
 */
import {
  filterHash,
  isTileShown,
  parseFilterHash,
  type TileFilter,
  type TileFilterAction,
  tileFilterReducer,
} from "../components/shared/tiles/tile-filter";
import { finishRefile, refile, type TileParts } from "../components/shared/tiles/tile-motion";
import { track } from "../lib/analytics";
import { Events } from "../lib/events";
import { GALLERY_HASH_KEY } from "../lib/gallery-types";
import { type MotionTools, withMotion } from "./motion";

/** The parts of a tile a refile draws in (GalleryTile.astro). */
export const TILE_PARTS: TileParts = { rule: ".gallery-rule", name: ".gallery-headline a" };

const TILE = "[data-gallery-tile]";

/** Where the page's motion tools come from: loaded on demand, null until they arrive. */
export type MotionSource = {
  /** The loaded tools, or null while loading, before the first request, or under reduced motion. */
  tools(): MotionTools | null;
  /** Starts loading the tools, once. */
  warm(): void;
};

/** The gallery's filter reducer: `choose` from a button, `hash` from the URL, over the kinds on the page. */
export function galleryFilterReducer(kinds: readonly string[]) {
  return tileFilterReducer<string>(GALLERY_HASH_KEY, kinds);
}

/** The URL a filter is recorded at: the bare page for All, else `#kind=<kind>`. */
export function filterUrl(filter: TileFilter, location: Pick<Location, "pathname" | "search">) {
  const base = `${location.pathname}${location.search}`;
  return filter === "all" ? base : `${base}${filterHash(filter, GALLERY_HASH_KEY)}`;
}

/**
 * Shows the tiles `filter` keeps and hides the rest. A tile that comes back is
 * marked revealed first, so its one entrance is the refile's and the scroll
 * reveal never replays it.
 */
export function applyFilter(tiles: readonly HTMLElement[], filter: TileFilter): void {
  for (const tile of tiles) {
    const shown = isTileShown(tile.dataset.kind ?? "", filter);
    if (shown && tile.hidden) tile.setAttribute("data-revealed", "true");
    tile.hidden = !shown;
  }
}

/**
 * Wires the filter under `root`: reads the URL, applies it at once, shows the
 * buttons, then follows presses, Back and Forward and hash changes. A hash
 * under the filter's key that names no kind is rewritten to the current
 * filter. Returns a teardown.
 */
export function setupGalleryFilter(root: HTMLElement, motion: MotionSource): () => void {
  const fieldset = root.querySelector<HTMLFieldSetElement>("[data-gallery-filter]");
  if (!fieldset) return () => {};
  const status = root.querySelector<HTMLElement>("[data-gallery-status]");
  const buttons = [...fieldset.querySelectorAll<HTMLButtonElement>("button[data-filter]")];
  const tiles = [...root.querySelectorAll<HTMLElement>(TILE)];
  const kinds = buttons.map((button) => button.dataset.filter ?? "").filter((id) => id !== "all");
  const reduce = galleryFilterReducer(kinds);
  let filter: TileFilter = "all";

  /** The filter the URL names: All for no hash, null for a hash that names none. */
  const fromUrl = (): TileFilter | null => {
    const { hash } = window.location;
    if (hash === "" || hash === "#") return "all";
    return parseFilterHash(hash, GALLERY_HASH_KEY, kinds);
  };
  const show = (next: TileFilter, { animate }: { animate: boolean }) => {
    const tools = animate ? motion.tools() : null;
    const apply = () => {
      applyFilter(tiles, next);
      root.dataset.filter = next;
    };
    if (tools) refile(tools, tiles, TILE_PARTS, apply);
    else apply();
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === next));
    }
  };
  const dispatch = (action: TileFilterAction, { announce }: { announce: boolean }) => {
    const next = reduce(filter, action);
    if (next === filter) return;
    filter = next;
    show(next, { animate: true });
    if (announce && status) {
      status.textContent = buttons.find((b) => b.dataset.filter === next)?.dataset.announce ?? "";
    }
  };
  /** Follows the URL after Back, Forward or an edited hash; a hash naming no kind is put right. */
  const follow = () => {
    const named = fromUrl();
    if (named === null) {
      window.history.replaceState(null, "", filterUrl(filter, window.location));
      return;
    }
    dispatch({ type: "choose", filter: named }, { announce: true });
  };

  const initial = fromUrl();
  if (initial === null) window.history.replaceState(null, "", filterUrl("all", window.location));
  filter = initial ?? "all";
  show(filter, { animate: false });
  fieldset.dataset.ready = "";

  const onClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-filter]");
    if (!button) return;
    const chosen = button.dataset.filter ?? "all";
    if (chosen === filter) return;
    window.history.pushState(null, "", filterUrl(chosen, window.location));
    dispatch({ type: "choose", filter: chosen }, { announce: true });
  };
  const onApproach = () => motion.warm();
  fieldset.addEventListener("click", onClick);
  fieldset.addEventListener("pointerenter", onApproach);
  fieldset.addEventListener("focusin", onApproach);
  window.addEventListener("popstate", follow);
  window.addEventListener("hashchange", follow);
  return () => {
    fieldset.removeEventListener("click", onClick);
    fieldset.removeEventListener("pointerenter", onApproach);
    fieldset.removeEventListener("focusin", onApproach);
    window.removeEventListener("popstate", follow);
    window.removeEventListener("hashchange", follow);
  };
}

/** Motion tools for the wall, loaded through `withMotion` on the first `warm()`. */
function lazyMotion(wall: HTMLElement): MotionSource & { teardown(): void } {
  let tools: MotionTools | null = null;
  let revert: (() => void) | null = null;
  return {
    tools: () => tools,
    warm() {
      revert ??= withMotion(function galleryRefile(loaded) {
        tools = loaded;
        return () => {
          finishRefile(loaded, [...wall.querySelectorAll<HTMLElement>(TILE)]);
          tools = null;
        };
      });
    },
    teardown: () => revert?.(),
  };
}

/** Runs everything the page's markup asks for. Returns a teardown. */
export function initGallery(doc: Document = document): () => void {
  const teardowns: (() => void)[] = [];
  const wall = doc.querySelector<HTMLElement>("[data-gallery]");
  if (wall) {
    const motion = lazyMotion(wall);
    teardowns.push(setupGalleryFilter(wall, motion), () => motion.teardown());
  }
  const entry = doc.querySelector<HTMLElement>("[data-gallery-entry]")?.dataset.galleryEntry;
  if (entry) track(Events.exampleViewed, { example: entry });
  return () => {
    for (const teardown of teardowns) teardown();
  };
}

initGallery();

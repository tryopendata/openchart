/**
 * The gallery pages' behavior, as plain DOM code that does nothing without its
 * markup. On /examples/ it runs the filter: the choice lives in the URL hash
 * under `#kind=`, a change shows and hides tiles by `data-kind` (refiled with
 * Flip when motion is allowed, at once under reduced motion) and the live
 * region reads the chosen button's sentence. On an entry page it records the
 * view. Live tile charts need no script: they fill their stage (gallery.css).
 * Loaded only by the two gallery pages, through their own `<script>`.
 */
import {
  filterHash,
  isTileShown,
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

/** The gallery's filter reducer: `choose` from a button, `hash` from the URL, over the kinds on the page. */
export function galleryFilterReducer(kinds: readonly string[]) {
  return tileFilterReducer<string>(GALLERY_HASH_KEY, kinds);
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
 * Wires the filter under `root`: reads the hash, applies it at once, shows the
 * buttons, then follows button presses and hash changes. `motion` returns the
 * loaded GSAP tools, or null while they are loading or motion is reduced, in
 * which case a change applies without a refile. Returns a teardown.
 */
export function setupGalleryFilter(
  root: HTMLElement,
  motion: () => MotionTools | null,
): () => void {
  const fieldset = root.querySelector<HTMLFieldSetElement>("[data-gallery-filter]");
  if (!fieldset) return () => {};
  const status = root.querySelector<HTMLElement>("[data-gallery-status]");
  const buttons = [...fieldset.querySelectorAll<HTMLButtonElement>("button[data-filter]")];
  const tiles = [...root.querySelectorAll<HTMLElement>(TILE)];
  const kinds = buttons.map((button) => button.dataset.filter ?? "").filter((id) => id !== "all");
  const reduce = galleryFilterReducer(kinds);
  let filter = reduce("all", { type: "hash", hash: window.location.hash });

  const press = (next: TileFilter) => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.dataset.filter === next));
    }
  };
  const dispatch = (action: TileFilterAction) => {
    const next = reduce(filter, action);
    if (next === filter) return;
    filter = next;
    const tools = motion();
    if (tools) refile(tools, tiles, TILE_PARTS, () => applyFilter(tiles, next));
    else applyFilter(tiles, next);
    press(next);
    const chosen = buttons.find((button) => button.dataset.filter === next);
    if (status) status.textContent = chosen?.dataset.announce ?? "";
  };

  applyFilter(tiles, filter);
  press(filter);
  fieldset.hidden = false;

  const onClick = (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-filter]");
    if (!button) return;
    const chosen = button.dataset.filter ?? "all";
    dispatch({ type: "choose", filter: chosen });
    window.history.replaceState(null, "", filterHash(chosen, GALLERY_HASH_KEY));
  };
  const onHash = () => dispatch({ type: "hash", hash: window.location.hash });
  fieldset.addEventListener("click", onClick);
  window.addEventListener("hashchange", onHash);
  return () => {
    fieldset.removeEventListener("click", onClick);
    window.removeEventListener("hashchange", onHash);
  };
}

/** Runs everything the page's markup asks for. Returns a teardown. */
export function initGallery(doc: Document = document): () => void {
  const teardowns: (() => void)[] = [];
  const wall = doc.querySelector<HTMLElement>("[data-gallery]");
  if (wall) {
    let tools: MotionTools | null = null;
    teardowns.push(
      withMotion(function galleryRefile(loaded) {
        tools = loaded;
        return () => {
          finishRefile(loaded, [...wall.querySelectorAll<HTMLElement>(TILE)]);
          tools = null;
        };
      }),
      setupGalleryFilter(wall, () => tools),
    );
  }
  const entry = doc.querySelector<HTMLElement>("[data-gallery-entry]")?.dataset.galleryEntry;
  if (entry) track(Events.exampleViewed, { example: entry });
  return () => {
    for (const teardown of teardowns) teardown();
  };
}

initGallery();

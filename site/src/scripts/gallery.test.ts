import { filterAnnouncement } from "../components/gallery/kind-words";
import type { TileFilter } from "../components/shared/tiles/tile-filter";
import type { VisualizationSectionId } from "../config";
import {
  applyFilter,
  filterUrl,
  galleryFilterReducer,
  type MotionSource,
  setupGalleryFilter,
} from "./gallery";
import type { MotionTools } from "./motion";

const KINDS = ["comparison", "maps", "tables"] as const;
const TILES: VisualizationSectionId[] = [
  "maps",
  "comparison",
  "maps",
  "tables",
  "maps",
  "comparison",
  "maps",
];

/** The wall as GalleryFilter.astro and GalleryTile.astro write it. */
function renderWall(): HTMLElement {
  const count = (id: TileFilter<VisualizationSectionId>) =>
    id === "all" ? TILES.length : TILES.filter((kind) => kind === id).length;
  const button = (id: TileFilter<VisualizationSectionId>) =>
    `<button type="button" data-filter="${id}" data-announce="${filterAnnouncement(id, count(id))}" aria-pressed="${id === "all"}">${id}</button>`;
  document.body.innerHTML = `
    <div data-gallery>
      <fieldset data-gallery-filter>${["all", ...KINDS].map((id) => button(id as TileFilter<VisualizationSectionId>)).join("")}</fieldset>
      <p aria-live="polite" data-gallery-status></p>
      <ul>${TILES.map((kind) => `<li data-gallery-tile data-kind="${kind}"></li>`).join("")}</ul>
    </div>`;
  return document.querySelector<HTMLElement>("[data-gallery]") as HTMLElement;
}

const shownKinds = (root: HTMLElement) =>
  [...root.querySelectorAll<HTMLElement>("[data-gallery-tile]")]
    .filter((tile) => !tile.hidden)
    .map((tile) => tile.dataset.kind);
const pressed = (root: HTMLElement) =>
  [...root.querySelectorAll("[aria-pressed='true']")].map((b) => b.getAttribute("data-filter"));
const status = (root: HTMLElement) =>
  root.querySelector("[data-gallery-status]")?.textContent ?? "";
const choose = (root: HTMLElement, id: string) =>
  root.querySelector<HTMLButtonElement>(`[data-filter="${id}"]`)?.click();
const goTo = (url: string, event: "popstate" | "hashchange") => {
  window.history.replaceState(null, "", url);
  window.dispatchEvent(
    event === "popstate" ? new PopStateEvent("popstate") : new HashChangeEvent("hashchange"),
  );
};

/** Motion that never loads: every change applies at once, as under reduced motion. */
const still: MotionSource = { tools: () => null, warm: () => {} };

describe("the gallery filter reducer", () => {
  const reduce = galleryFilterReducer(KINDS);

  it.each([
    ["a button press", "all", { type: "choose", filter: "maps" }, "maps"],
    ["a hash naming a kind", "all", { type: "hash", hash: "#kind=tables" }, "tables"],
    ["the bare key", "maps", { type: "hash", hash: "#kind" }, "all"],
    ["an unknown kind", "maps", { type: "hash", hash: "#kind=charts" }, "maps"],
    ["another page's key", "maps", { type: "hash", hash: "#vocabulary=tables" }, "maps"],
    ["a malformed escape", "tables", { type: "hash", hash: "#kind=%E0%A4" }, "tables"],
  ] as const)("follows %s", (_case, from, action, expected) => {
    expect(reduce(from, action)).toBe(expected);
  });
});

describe("the URL a filter is recorded at", () => {
  it("is the bare page for All and #kind=<kind> for a kind", () => {
    const at = { pathname: "/examples/", search: "?q=1" };
    expect(filterUrl("all", at)).toBe("/examples/?q=1");
    expect(filterUrl("maps", at)).toBe("/examples/?q=1#kind=maps");
  });
});

describe("the gallery filter", () => {
  let teardown = () => {};
  afterEach(() => {
    teardown();
    window.history.replaceState(null, "", "/examples/");
  });

  it("marks the row ready once wired, with All pressed, every tile shown and the wall arranged", () => {
    const root = renderWall();
    teardown = setupGalleryFilter(root, still);
    expect(root.querySelector<HTMLElement>("[data-gallery-filter]")?.dataset.ready).toBe("");
    expect(pressed(root)).toEqual(["all"]);
    expect(shownKinds(root)).toEqual(TILES);
    expect(root.dataset.filter).toBe("all");
    expect(status(root)).toBe("");
  });

  it("shows only the chosen kind, presses it, records it in history and reads it out; All writes the bare URL", () => {
    const root = renderWall();
    teardown = setupGalleryFilter(root, still);
    const entries = window.history.length;
    choose(root, "maps");
    expect(shownKinds(root)).toEqual(["maps", "maps", "maps", "maps"]);
    expect(pressed(root)).toEqual(["maps"]);
    expect(root.dataset.filter).toBe("maps");
    expect(window.location.hash).toBe("#kind=maps");
    expect(window.history.length).toBe(entries + 1);
    expect(status(root)).toBe("Showing 4 maps.");

    choose(root, "all");
    expect(shownKinds(root)).toEqual(TILES);
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/examples/");
    expect(status(root)).toBe("Showing all 7 graphics.");
  });

  it("applies the filter the URL names on arrival, and puts right a hash that names no kind", () => {
    window.history.replaceState(null, "", "/examples/#kind=tables");
    const root = renderWall();
    teardown = setupGalleryFilter(root, still);
    expect(shownKinds(root)).toEqual(["tables"]);
    teardown();

    window.history.replaceState(null, "", "/examples/#kind=charts");
    const again = renderWall();
    teardown = setupGalleryFilter(again, still);
    expect(shownKinds(again)).toEqual(TILES);
    expect(`${window.location.pathname}${window.location.hash}`).toBe("/examples/");
  });

  it.each(["popstate", "hashchange"] as const)(
    "follows the URL on %s, and rewrites an unknown kind to the current one",
    (event) => {
      const root = renderWall();
      teardown = setupGalleryFilter(root, still);
      goTo("/examples/#kind=comparison", event);
      expect(shownKinds(root)).toEqual(["comparison", "comparison"]);
      expect(status(root)).toBe("Showing 2 comparison charts.");
      goTo("/examples/", event);
      expect(shownKinds(root)).toEqual(TILES);
      goTo("/examples/#kind=tables", event);
      goTo("/examples/#kind=charts", event);
      expect(shownKinds(root)).toEqual(["tables"]);
      expect(window.location.hash).toBe("#kind=tables");
    },
  );

  it("asks for the motion tools only when the reader reaches for the filter", () => {
    const root = renderWall();
    let warmed = 0;
    teardown = setupGalleryFilter(root, { tools: () => null, warm: () => (warmed += 1) });
    expect(warmed).toBe(0);
    root.querySelector("[data-gallery-filter]")?.dispatchEvent(new Event("pointerenter"));
    root.querySelector("[data-gallery-filter]")?.dispatchEvent(new FocusEvent("focusin"));
    expect(warmed).toBe(2);
  });

  it("refiles through Flip once the tools are in, and ends in the right state after two quick choices", () => {
    const root = renderWall();
    const flips: number[] = [];
    const tools = {
      gsap: {},
      ScrollTrigger: { refresh: () => {} },
      Draggable: {},
      Flip: {
        killFlipsOf: () => {},
        getState: () => ({}),
        from: (_state: unknown, options: { onComplete?: () => void }) => {
          flips.push(flips.length);
          options.onComplete?.();
        },
      },
    } as unknown as MotionTools;
    teardown = setupGalleryFilter(root, { tools: () => tools, warm: () => {} });
    choose(root, "tables");
    choose(root, "comparison");
    expect(flips).toHaveLength(2);
    expect(shownKinds(root)).toEqual(["comparison", "comparison"]);
    expect(pressed(root)).toEqual(["comparison"]);
    expect(root.dataset.filter).toBe("comparison");
    expect(status(root)).toBe("Showing 2 comparison charts.");
  });

  it("does nothing on a page without the filter", () => {
    document.body.innerHTML = "<div data-gallery></div>";
    const root = document.querySelector<HTMLElement>("[data-gallery]") ?? document.body;
    expect(() => setupGalleryFilter(root, still)()).not.toThrow();
  });
});

describe("applying a filter", () => {
  it("marks a tile that comes back as revealed, so the scroll entrance never replays it", () => {
    const root = renderWall();
    const tiles = [...root.querySelectorAll<HTMLElement>("[data-gallery-tile]")];
    applyFilter(tiles, "tables");
    expect(tiles.some((tile) => tile.hasAttribute("data-revealed"))).toBe(false);
    applyFilter(tiles, "all");
    const revealed = tiles.filter((tile) => tile.hasAttribute("data-revealed"));
    expect(revealed.map((tile) => tile.dataset.kind)).toEqual(TILES.filter((k) => k !== "tables"));
  });
});

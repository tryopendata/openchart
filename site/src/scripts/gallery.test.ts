import { filterAnnouncement } from "../components/gallery/kind-words";
import type { TileFilter } from "../components/shared/tiles/tile-filter";
import type { VisualizationSectionId } from "../config";
import { applyFilter, galleryFilterReducer, setupGalleryFilter } from "./gallery";

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
      <fieldset data-gallery-filter hidden>${["all", ...KINDS].map((id) => button(id as TileFilter<VisualizationSectionId>)).join("")}</fieldset>
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

describe("the gallery filter", () => {
  let teardown = () => {};
  afterEach(() => {
    teardown();
    window.history.replaceState(null, "", "/examples/");
  });

  it("shows the buttons once wired, with All pressed and every tile shown", () => {
    const root = renderWall();
    teardown = setupGalleryFilter(root, () => null);
    expect(root.querySelector<HTMLFieldSetElement>("[data-gallery-filter]")?.hidden).toBe(false);
    expect(pressed(root)).toEqual(["all"]);
    expect(shownKinds(root)).toEqual(TILES);
    expect(status(root)).toBe("");
  });

  it("shows only the chosen kind, presses its button, records it in the hash and reads it out", () => {
    const root = renderWall();
    teardown = setupGalleryFilter(root, () => null);
    choose(root, "maps");
    expect(shownKinds(root)).toEqual(["maps", "maps", "maps", "maps"]);
    expect(pressed(root)).toEqual(["maps"]);
    expect(window.location.hash).toBe("#kind=maps");
    expect(status(root)).toBe("Showing 4 maps.");

    choose(root, "all");
    expect(shownKinds(root)).toEqual(TILES);
    expect(window.location.hash).toBe("#kind");
    expect(status(root)).toBe("Showing all 7 graphics.");
  });

  it("applies a filter the URL names on arrival, before any press", () => {
    window.history.replaceState(null, "", "/examples/#kind=tables");
    const root = renderWall();
    teardown = setupGalleryFilter(root, () => null);
    expect(shownKinds(root)).toEqual(["tables"]);
    expect(pressed(root)).toEqual(["tables"]);
  });

  it("follows the hash when it changes under the page", () => {
    const root = renderWall();
    teardown = setupGalleryFilter(root, () => null);
    window.history.replaceState(null, "", "/examples/#kind=comparison");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    expect(shownKinds(root)).toEqual(["comparison", "comparison"]);
    expect(status(root)).toBe("Showing 2 comparison charts.");
  });

  it("does nothing on a page without the filter", () => {
    document.body.innerHTML = "<div data-gallery></div>";
    const root = document.querySelector<HTMLElement>("[data-gallery]") ?? document.body;
    expect(() => setupGalleryFilter(root, () => null)()).not.toThrow();
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

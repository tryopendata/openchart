/**
 * The "beyond charts" grid's tiles: which registered demo each shows, the docs
 * page it links to, its place in the uneven grid and its stage height. The first
 * tile is the dominant one. Every tile's data has a named source a newsroom
 * would cite, not "Illustrative data". kinds.test.ts checks the demo ids, the
 * docs pages and the sources.
 */

/**
 * A tile's place in the grid, which has one column under 640px, two to 899px
 * and three from 900px:
 * - `dominant`: the full row at two columns; two columns and two rows at three.
 * - `side`: one cell, beside the dominant tile at three columns.
 * - `bottom`: the full row at two columns, one cell at three.
 * - `bottom-wide`: the full row at two columns, two cells at three.
 * At every width the cells fill their rows, so no row is left with an empty cell.
 */
export type KindsTilePlace = "dominant" | "side" | "bottom" | "bottom-wide";

export type KindsTile = {
  /** A demo id from src/demos/. */
  demo: string;
  /** The docs page the tile links to. */
  href: string;
  /** The link text: what the reader goes on to read about. */
  link: string;
  place: KindsTilePlace;
  /**
   * The chart stage's height in px. The dominant tile treats it as a minimum and
   * grows to the two cells beside it; the bottom row's tiles share a height so
   * neither cell is left with empty space.
   */
  height: number;
  /**
   * Let the stage grow to its content instead of scrolling inside it, for a
   * table whose rows stack into cards on a narrow screen. The height is then a
   * minimum.
   */
  fitContent?: boolean;
};

/** Fits the data table's eight rows, search box and pager at three columns, with no inner scroll. */
const BOTTOM_ROW_HEIGHT = 640;

/** The two side tiles share a height, so they line up when they sit side by side at two columns. */
const SIDE_HEIGHT = 330;

/** In grid order: the dominant map, the two cells beside it, then the bottom row. */
export const kindsTiles: KindsTile[] = [
  {
    demo: "maps/symbol-color",
    href: "/docs/maps/symbol-map/",
    link: "Symbol maps",
    place: "dominant",
    height: 520,
  },
  {
    demo: "maps/tile-basic",
    href: "/docs/maps/tile-map/",
    link: "Tile maps",
    place: "side",
    height: SIDE_HEIGHT,
  },
  {
    demo: "comparison/barlist-basic",
    href: "/docs/comparison/bar-list/",
    link: "Bar lists",
    place: "side",
    height: SIDE_HEIGHT,
  },
  {
    demo: "flow/sankey-basic",
    href: "/docs/flow/sankey/",
    link: "Sankey diagrams",
    place: "bottom",
    height: BOTTOM_ROW_HEIGHT,
  },
  {
    demo: "tables/basic",
    href: "/docs/tables/data-table/",
    link: "Data tables",
    place: "bottom-wide",
    height: BOTTOM_ROW_HEIGHT,
    fitContent: true,
  },
];

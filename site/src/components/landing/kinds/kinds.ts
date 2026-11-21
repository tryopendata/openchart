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
   * The chart stage's minimum height in px. Each stage grows to the tallest tile
   * in its row (the dominant one to the two cells beside it), so captions and
   * links line up along the row; the minimum is what the chart needs to draw at
   * full size in its cell.
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
    // Tall enough that the tiles are drawn large in a one-third-width cell.
    height: 420,
  },
  {
    demo: "comparison/barlist-basic",
    href: "/docs/comparison/bar-list/",
    link: "Bar lists",
    place: "side",
    // All eight bars: below about 300px the bar list drops the rows that do not fit.
    height: 320,
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

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
 * - `full`: the full row at every width, for a graphic that needs the room
 *   (a sankey's labelled columns, a table's columns).
 * At every width the cells fill their rows, so no row is left with an empty cell.
 */
export type KindsTilePlace = "dominant" | "side" | "full";

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
   * The minimum height in the one-column layout under 640px, for a chart that
   * draws much shorter at phone width (a map scales with its width). Defaults to
   * `height`.
   */
  narrowHeight?: number;
  /**
   * Let the stage grow to its content instead of scrolling inside it, for a
   * table whose rows stack into cards on a narrow screen. The height is then a
   * minimum.
   */
  fitContent?: boolean;
  /**
   * Under 640px, lay the figure out at this minimum width (px) and scroll it
   * sideways inside the tile, for a chart whose labelled columns cannot fit a
   * phone. The tile is unchanged from 640px up.
   */
  scrollBelow?: number;
};

/** In grid order: the dominant map, the two cells beside it, then the two full-width rows. */
export const kindsTiles: KindsTile[] = [
  {
    demo: "maps/symbol-color",
    href: "/docs/maps/symbol-map/",
    link: "Symbol maps",
    place: "dominant",
    height: 520,
    narrowHeight: 380,
  },
  {
    demo: "maps/tile-basic",
    href: "/docs/maps/tile-map/",
    link: "Tile maps",
    place: "side",
    // Tall enough that the tiles are drawn large in a one-third-width cell.
    height: 420,
    narrowHeight: 340,
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
    place: "full",
    // Four labelled columns of nodes need the whole measure to keep their labels apart.
    height: 620,
    narrowHeight: 560,
    scrollBelow: 680,
  },
  {
    demo: "tables/basic",
    href: "/docs/tables/data-table/",
    link: "Data tables",
    place: "full",
    height: 480,
    fitContent: true,
  },
];

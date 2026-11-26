/**
 * The vocabulary section's featured figures, set at full size under the wall:
 * which registered demo each shows, the docs page it links to, its place in the
 * uneven grid and its stage height. The first figure is the dominant one. Every
 * figure's data has a named source a newsroom would cite, not "Illustrative
 * data". featured.test.ts checks the demo ids, the docs pages and the sources.
 */

/**
 * A figure's place in the grid, which has one column under 640px, two to 899px
 * and three from 900px:
 * - `dominant`: the full row at two columns; two columns and two rows at three.
 * - `side`: the full row at two columns; at three, the column beside the
 *   dominant figure for the height of both its rows.
 * - `full`: the full row at every width, for a graphic that needs the room
 *   (a sankey's labelled columns).
 * At every width the cells fill their rows, so no row is left with an empty cell.
 */
export type FeaturedFigurePlace = "dominant" | "side" | "full";

export type FeaturedFigure = {
  /** A demo id from src/demos/. */
  demo: string;
  /** The docs page the figure links to. */
  href: string;
  /** The link text: what the reader goes on to read about. */
  link: string;
  place: FeaturedFigurePlace;
  /**
   * The chart stage's minimum height in px. Each stage grows to the tallest
   * figure in its row (the side one to the dominant figure's two rows), so
   * captions and links line up along the row; the minimum is what the chart
   * needs to draw at full size in its cell.
   */
  height: number;
  /**
   * The minimum height in the one-column layout under 640px, for a chart that
   * draws much shorter at phone width (a map scales with its width). Defaults to
   * `height`.
   */
  narrowHeight?: number;
  /**
   * Under 640px, lay the figure out at this minimum width (px) and scroll it
   * sideways inside the figure, for a chart whose labelled columns cannot fit a
   * phone. The figure is unchanged from 640px up.
   */
  scrollBelow?: number;
};

/** In grid order: the dominant symbol map, the tile map beside it, then the full-width sankey. */
export const featuredFigures: FeaturedFigure[] = [
  {
    // The docs page's symbol map with a land fill that reads on the dark page.
    demo: "landing/featured-map",
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
    demo: "flow/sankey-basic",
    href: "/docs/flow/sankey/",
    link: "Sankey diagrams",
    place: "full",
    // Four labelled columns of nodes need the whole measure to keep their labels apart.
    height: 620,
    narrowHeight: 560,
    scrollBelow: 680,
  },
];

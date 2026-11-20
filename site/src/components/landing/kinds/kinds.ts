/**
 * The "beyond charts" grid's tiles: which registered demo each shows, the docs
 * page it links to, and its place in the uneven grid. The first tile is the
 * dominant one. kinds.test.ts checks every demo id and docs page exists.
 */

/** A tile's place: the dominant 2-by-2 tile, a single cell, or a cell two columns wide. */
export type KindsTileSize = "dominant" | "single" | "wide";

export type KindsTile = {
  /** A demo id from src/demos/. */
  demo: string;
  /** The docs page the tile links to. */
  href: string;
  /** The link text: what the reader goes on to read about. */
  link: string;
  size: KindsTileSize;
};

/** In grid order: the dominant map, the two cells beside it, then the bottom row. */
export const kindsTiles: KindsTile[] = [
  {
    demo: "maps/choropleth-basic",
    href: "/docs/maps/choropleth/",
    link: "Choropleth maps",
    size: "dominant",
  },
  {
    demo: "maps/tile-categorical",
    href: "/docs/maps/tile-map/",
    link: "Tile maps",
    size: "single",
  },
  {
    demo: "comparison/barlist-basic",
    href: "/docs/comparison/bar-list/",
    link: "Bar lists",
    size: "single",
  },
  {
    demo: "flow/sankey-basic",
    href: "/docs/flow/sankey/",
    link: "Sankey diagrams",
    size: "single",
  },
  { demo: "tables/basic", href: "/docs/tables/data-table/", link: "Data tables", size: "wide" },
];

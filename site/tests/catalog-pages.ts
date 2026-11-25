/**
 * The Visualizations catalog: every page the docs promise, by section, in
 * sidebar order. The build and browser tests read this list, so a page missing
 * from the build fails by name.
 *
 * `flow/graph-3d` is absent on purpose: the 3D graph needs optional peer
 * packages (three, 3d-force-graph, three-spritetext) that the site does not install.
 */
export const catalogPages = {
  comparison: ["bar", "column", "grouped-stacked", "lollipop", "bar-list", "range"],
  "change-over-time": [
    "line",
    "area",
    "stacked-area",
    "slope-bump",
    "race",
    "playback",
    "sparkline",
    "calendar",
  ],
  "part-to-whole": ["pie-donut", "stacked-100", "waffle", "parliament"],
  distribution: ["histogram", "density", "beeswarm", "tick-strip", "error-bars"],
  correlation: ["scatter", "bubble", "bubble-playback", "heatmap", "trendlines"],
  flow: ["sankey", "graph"],
  maps: ["choropleth", "symbol-map", "tile-map", "geographic-labels"],
  tables: ["data-table", "column-types", "row-inspection"],
  composition: ["layers", "facets", "dashboard-tiles"],
} as const satisfies Record<string, readonly string[]>;

/** Every catalog page id, "<section>/<slug>". */
export const catalogPageIds: string[] = Object.entries(catalogPages).flatMap(([section, slugs]) =>
  slugs.map((slug) => `${section}/${slug}`),
);

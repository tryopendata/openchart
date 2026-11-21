/**
 * Where links in the repository's published docs go when their target is not a
 * published repo page: docs files the site replaces with its own pages
 * (aliases), and Ladle gallery stories the site shows on a catalog page. The
 * docs keep their GitHub-relative and Ladle links, so they read the same on
 * GitHub; repo-markdown.ts rewrites them at build time from these maps.
 */

/**
 * Docs-relative file to the site URL that replaces it. A link to one of these
 * files goes to the URL with its anchor dropped, since the site page has
 * different headings.
 */
export const repoDocAliases: Readonly<Record<string, string>> = {
  "chart-types.md": "/docs/#area-visualizations",
  "tables.md": "/docs/tables/data-table/",
  "graphs.md": "/docs/flow/graph/",
  "sankey.md": "/docs/flow/sankey/",
  "maps.md": "/docs/maps/choropleth/",
  "geographic-labels.md": "/docs/maps/geographic-labels/",
};

/**
 * Ladle story to site page id. A key is a story id plus `#` and the gallery
 * anchor when one story file holds several examples, or the bare story id when
 * every example in it lands on the same page. The rewriter tries `id#hash`
 * first, then `id`.
 */
export const ladleStoryPages: Readonly<Record<string, string>> = {
  "charts--bar-and-column#simple-bars": "comparison/bar",
  "charts--bar-and-column#columns": "comparison/column",
  "charts--bar-and-column#grouped-columns": "comparison/grouped-stacked",
  "charts--bar-and-column#stacked-bars": "comparison/grouped-stacked",
  "charts--line-and-area#single-line": "change-over-time/line",
  "charts--line-and-area#multi-series-labels": "change-over-time/line",
  "charts--line-and-area#area": "change-over-time/area",
  "charts--pie-and-donut": "part-to-whole/pie-donut",
  "charts--scatter-and-distribution#basic-scatter": "correlation/scatter",
  "charts--scatter-and-distribution#bubble": "correlation/bubble",
  // The gallery's dot plot is a circle mark on a category axis, which the lollipop page covers.
  "charts--scatter-and-distribution#dot-plot": "comparison/lollipop",
  "tables--tables#basic": "tables/data-table",
  "tables--tables#heatmap-cells": "tables/column-types",
  "tables--tables#sparkline-cells": "tables/column-types",
  "graphs--graphs": "flow/graph",
  "features--theming#named-themes": "style/presets",
  "dashboards--dashboards": "composition/dashboard-tiles",
  "testing--fixtures--slope-market-share": "change-over-time/slope-bump",
  "testing--fixtures--slope-market-share-compact": "change-over-time/slope-bump",
  "testing--fixtures--bump-constructors": "change-over-time/slope-bump",
  "testing--fixtures--range-arrow": "comparison/range",
  "testing--fixtures--range-bar": "comparison/range",
  "testing--fixtures--range-dumbbell": "comparison/range",
};

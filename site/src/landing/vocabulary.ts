/**
 * The visual vocabulary wall's tiles: 24 existing demos filed by intent,
 * covering every Visualizations section. The wall shows them in this order, so
 * each intent's tiles sit together and the first of each run carries the
 * intent's name, the way a style sheet groups its entries.
 */
import type { SectionId } from "../config";

/** One tile on the wall. */
export type VocabularyTile = {
  /** An existing demo id, rendered through the demo system. */
  demo: string;
  /** The Visualizations section the chart is filed under; the wall's filter uses it. */
  intent: SectionId;
  /** The chart's name, shown in mono under the tile. */
  label: string;
  /** An existing docs page under `/docs/<intent>/`: the chart's own page or the nearest one in its section. */
  href: string;
};

/** The tiles in wall order: grouped by intent, in the order of the Visualizations sections. */
export const vocabularyTiles: VocabularyTile[] = [
  {
    demo: "comparison/column-basic",
    intent: "comparison",
    label: "Column",
    href: "/docs/comparison/column/",
  },
  {
    demo: "comparison/grouped-columns",
    intent: "comparison",
    label: "Grouped columns",
    href: "/docs/comparison/grouped-stacked/",
  },
  {
    demo: "comparison/barlist-basic",
    intent: "comparison",
    label: "Bar list",
    href: "/docs/comparison/bar-list/",
  },
  {
    demo: "comparison/range-dumbbell",
    intent: "comparison",
    label: "Dumbbell",
    href: "/docs/comparison/range/",
  },
  {
    demo: "change-over-time/line-basic",
    intent: "change-over-time",
    label: "Line",
    href: "/docs/change-over-time/line/",
  },
  {
    demo: "change-over-time/stacked-area-basic",
    intent: "change-over-time",
    label: "Stacked area",
    href: "/docs/change-over-time/stacked-area/",
  },
  {
    demo: "change-over-time/area-basic",
    intent: "change-over-time",
    label: "Area",
    href: "/docs/change-over-time/area/",
  },
  {
    demo: "part-to-whole/donut",
    intent: "part-to-whole",
    label: "Donut",
    href: "/docs/part-to-whole/pie-donut/",
  },
  {
    demo: "part-to-whole/waffle-units",
    intent: "part-to-whole",
    label: "Waffle",
    href: "/docs/part-to-whole/waffle/",
  },
  {
    demo: "part-to-whole/parliament-basic",
    intent: "part-to-whole",
    label: "Parliament",
    href: "/docs/part-to-whole/parliament/",
  },
  {
    demo: "distribution/histogram-bins",
    intent: "distribution",
    label: "Histogram",
    href: "/docs/distribution/histogram/",
  },
  {
    demo: "distribution/beeswarm-lanes",
    intent: "distribution",
    label: "Beeswarm",
    href: "/docs/distribution/beeswarm/",
  },
  {
    demo: "distribution/density-grouped",
    intent: "distribution",
    label: "Density",
    href: "/docs/distribution/density/",
  },
  {
    demo: "correlation/scatter-color",
    intent: "correlation",
    label: "Scatter",
    href: "/docs/correlation/scatter/",
  },
  {
    demo: "correlation/trendlines-grouped",
    intent: "correlation",
    label: "Trend line",
    href: "/docs/correlation/trendlines/",
  },
  {
    demo: "correlation/heatmap-basic",
    intent: "correlation",
    label: "Heatmap",
    href: "/docs/correlation/heatmap/",
  },
  { demo: "flow/sankey-basic", intent: "flow", label: "Sankey", href: "/docs/flow/sankey/" },
  { demo: "flow/graph-clusters", intent: "flow", label: "Network", href: "/docs/flow/graph/" },
  {
    demo: "maps/choropleth-basic",
    intent: "maps",
    label: "Choropleth",
    href: "/docs/maps/choropleth/",
  },
  {
    demo: "maps/symbol-basic",
    intent: "maps",
    label: "Symbol map",
    href: "/docs/maps/symbol-map/",
  },
  { demo: "tables/basic", intent: "tables", label: "Data table", href: "/docs/tables/data-table/" },
  {
    demo: "tables/sparkline-columns",
    intent: "tables",
    label: "Sparkline column",
    href: "/docs/tables/column-types/",
  },
  {
    demo: "composition/layer-bars-rule",
    intent: "composition",
    label: "Bars and a rule",
    href: "/docs/composition/layers/",
  },
  {
    demo: "composition/layer-dual-axis",
    intent: "composition",
    label: "Dual axis",
    href: "/docs/composition/layers/",
  },
];

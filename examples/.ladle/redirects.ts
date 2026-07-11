/**
 * Legacy-slug redirect map.
 *
 * Maps an old published `?story=` slug to its new gallery destination. Under
 * the big-bang rollout (see plans/ladle-gallery/00-overview.md, constraint
 * C4), the public site only changes at the final flip, so every deleted
 * story's slug must still resolve. Each PR that DELETES a story file adds its
 * entries here in the same commit, keeping the branch internally consistent.
 *
 * The provider reads `?story=` on mount; if it matches a key, it replaces the
 * URL with `?story=<story>` (plus `#<hash>` when set) and lets Ladle navigate.
 *
 * This starts EMPTY. The proving-ground pass (Bar & Column) adds the first
 * batch of entries for the story files it deletes.
 */
export type Redirect = { story: string; hash?: string };

const BAR_COLUMN = 'charts--bar-and-column';
const LINE_AREA = 'charts--line-and-area';
const PIE_DONUT = 'charts--pie-and-donut';
const SCATTER_DIST = 'charts--scatter-and-distribution';
const BUILDING_BLOCKS = 'charts--building-blocks';
const TABLES = 'tables--tables';
const GRAPHS = 'graphs--graphs';
const SANKEY_TILEMAPS = 'sankey---tile-maps--sankey-and-tile-maps';
const DASHBOARDS = 'dashboards--dashboards';

export const redirects: Record<string, Redirect> = {
  // charts/bar.stories.tsx
  'bar--simple-bars': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar--grouped-bars': { story: BAR_COLUMN, hash: 'grouped-columns' },
  'bar--negative-values': { story: BAR_COLUMN, hash: 'negative-values' },

  // charts/column.stories.tsx
  'column--simple-columns': { story: BAR_COLUMN, hash: 'columns' },
  'column--grouped-columns': { story: BAR_COLUMN, hash: 'grouped-columns' },
  'column--negative-values': { story: BAR_COLUMN, hash: 'diverging-columns' },
  'column--long-axis-labels': { story: BAR_COLUMN, hash: 'long-labels' },
  'column--responsive-demo': { story: BAR_COLUMN, hash: 'grouped-columns' },

  // charts/barlist.stories.tsx
  'barlist--basic': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--color-encoding': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--with-subtitle': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--custom-bar-style': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--dark-mode': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--compact': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--large-dataset': { story: BAR_COLUMN, hash: 'bar-list' },
  'barlist--no-chrome': { story: BAR_COLUMN, hash: 'bar-list' },

  // editorial/bar-horizontal.stories.tsx
  'bar-horizontal--population-bar': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar-horizontal--population-bar-compact': { story: BAR_COLUMN, hash: 'simple-bars' },
  'bar-horizontal--population-bar-wide': { story: BAR_COLUMN, hash: 'simple-bars' },

  // editorial/bar-stacked.stories.tsx
  'bar-stacked--household-spending': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'bar-stacked--household-spending-compact': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'bar-stacked--household-spending-wide': { story: BAR_COLUMN, hash: 'stacked-bars' },

  // editorial/column-diverging.stories.tsx
  'column-diverging--temperature-anomaly': { story: BAR_COLUMN, hash: 'diverging-columns' },
  'column-diverging--temperature-anomaly-compact': {
    story: BAR_COLUMN,
    hash: 'diverging-columns',
  },
  'column-diverging--temperature-anomaly-wide': { story: BAR_COLUMN, hash: 'diverging-columns' },

  // editorial/column-stacked.stories.tsx
  'column-stacked--energy-mix': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'column-stacked--energy-mix-compact': { story: BAR_COLUMN, hash: 'stacked-bars' },
  'column-stacked--energy-mix-wide': { story: BAR_COLUMN, hash: 'stacked-bars' },

  // ── Phase 02: Charts / Line & Area ──
  // charts/line.stories.tsx
  'line--single-line': { story: LINE_AREA, hash: 'single-line' },
  'line--multi-series': { story: LINE_AREA, hash: 'multi-series-labels' },
  'line--five-series': { story: LINE_AREA, hash: 'five-series-legend' },
  'line--area-chart': { story: LINE_AREA, hash: 'area' },
  'line--stacked-area': { story: LINE_AREA, hash: 'stacked-area' },
  'line--multi-series-area-overlap': { story: LINE_AREA, hash: 'area' },
  'line--multi-series-area-stacked': { story: LINE_AREA, hash: 'stacked-area' },
  'line--responsive-demo': { story: LINE_AREA, hash: 'multi-series-labels' },
  'line--interpolation-modes': { story: LINE_AREA, hash: 'interpolation' },
  'line--step-area': { story: LINE_AREA, hash: 'interpolation' },
  'line--editorial-single-line': { story: LINE_AREA, hash: 'single-line' },
  'line--editorial-single-line-light': { story: LINE_AREA, hash: 'single-line' },
  // editorial/line-multiseries.stories.tsx
  'line-multiseries--gdp-growth': { story: LINE_AREA, hash: 'multi-series-labels' },
  'line-multiseries--gdp-growth-compact': { story: LINE_AREA, hash: 'multi-series-labels' },
  'line-multiseries--gdp-growth-wide': { story: LINE_AREA, hash: 'multi-series-labels' },

  // ── Phase 02: Charts / Pie & Donut ──
  // charts/pie.stories.tsx
  'pie--basic-pie': { story: PIE_DONUT, hash: 'pie-inline-labels' },
  'pie--donut-chart': { story: PIE_DONUT, hash: 'donut-center-metric' },
  'pie--small-slice-grouping': { story: PIE_DONUT, hash: 'small-slice-grouping' },
  'pie--seven-categories': { story: PIE_DONUT, hash: 'many-categories' },
  // editorial/donut-comparison.stories.tsx
  'donut-comparison--electricity-mix': { story: PIE_DONUT, hash: 'comparison-donuts' },
  'donut-comparison--electricity-mix-compact': { story: PIE_DONUT, hash: 'comparison-donuts' },
  'donut-comparison--electricity-mix-wide': { story: PIE_DONUT, hash: 'comparison-donuts' },
  // editorial/donut-leaders.stories.tsx
  'donut-leaders--smartphone-market': { story: PIE_DONUT, hash: 'leader-line-labels' },
  'donut-leaders--smartphone-market-compact': { story: PIE_DONUT, hash: 'leader-line-labels' },
  'donut-leaders--smartphone-market-wide': { story: PIE_DONUT, hash: 'leader-line-labels' },
  'donut-leaders--browser-market': { story: PIE_DONUT, hash: 'pie-inline-labels' },

  // ── Phase 02: Charts / Scatter & Distribution ──
  // charts/scatter.stories.tsx
  'scatter--basic-scatter': { story: SCATTER_DIST, hash: 'basic-scatter' },
  'scatter--bubble-chart': { story: SCATTER_DIST, hash: 'bubble' },
  'scatter--color-grouping': { story: SCATTER_DIST, hash: 'color-grouping' },
  // charts/dot.stories.tsx
  'dot--simple-dot-plot': { story: SCATTER_DIST, hash: 'dot-plot' },
  'dot--colored-dots': { story: SCATTER_DIST, hash: 'dot-plot' },
  'dot--diverging-lollipop': { story: SCATTER_DIST, hash: 'lollipop' },
  // editorial/dot-dumbbell.stories.tsx
  'dot-dumbbell--life-expectancy': { story: SCATTER_DIST, hash: 'dumbbell' },
  'dot-dumbbell--life-expectancy-compact': { story: SCATTER_DIST, hash: 'dumbbell' },
  'dot-dumbbell--life-expectancy-wide': { story: SCATTER_DIST, hash: 'dumbbell' },
  // editorial/scatter-bubble.stories.tsx
  'scatter-bubble--emissions-vs-renewables': { story: SCATTER_DIST, hash: 'bubble' },
  'scatter-bubble--emissions-vs-renewables-compact': { story: SCATTER_DIST, hash: 'bubble' },
  'scatter-bubble--emissions-vs-renewables-wide': { story: SCATTER_DIST, hash: 'bubble' },
  // editorial/scatter-trend.stories.tsx
  'scatter-trend--wealth-health': { story: SCATTER_DIST, hash: 'trend-annotation' },
  'scatter-trend--wealth-health-compact': { story: SCATTER_DIST, hash: 'trend-annotation' },
  'scatter-trend--wealth-health-wide': { story: SCATTER_DIST, hash: 'trend-annotation' },

  // ── Phase 02: Charts / Building Blocks ──
  // charts/marks.stories.tsx
  'marks--text-mark': { story: BUILDING_BLOCKS, hash: 'text-mark' },
  'marks--rule-mark': { story: BUILDING_BLOCKS, hash: 'rule-mark' },
  'marks--tick-mark': { story: BUILDING_BLOCKS, hash: 'tick-mark' },
  // charts/dual-axis.stories.tsx
  'dual-axis--revenue-vs-enrollment': { story: BUILDING_BLOCKS, hash: 'dual-axis' },
  'dual-axis--weather-dual-axis': { story: BUILDING_BLOCKS, hash: 'dual-axis' },

  // ── Phase 03: Tables ──
  // editorial/table.stories.tsx
  'table--basic': { story: TABLES, hash: 'basic' },
  'table--basic-compact': { story: TABLES, hash: 'basic' },
  'table--flags': { story: TABLES, hash: 'flag-cells' },
  'table--flags-compact': { story: TABLES, hash: 'flag-cells' },
  'table--country-comparison': { story: TABLES, hash: 'flag-cells' },
  'table--heatmap': { story: TABLES, hash: 'heatmap-cells' },
  'table--election-results': { story: TABLES, hash: 'heatmap-cells' },
  'table--stock-sparklines': { story: TABLES, hash: 'sparkline-cells' },
  'table--revenue-columns': { story: TABLES, hash: 'sparkline-cells' },

  // ── Phase 03: Graphs ──
  // graph.stories.tsx
  'graph--basic-graph': { story: GRAPHS, hash: 'basic' },
  'graph--community-clusters': { story: GRAPHS, hash: 'communities' },
  'graph--encoded-graph': { story: GRAPHS, hash: 'encoded' },
  'graph--with-chrome': { story: GRAPHS, hash: 'chrome' },
  'graph--search-demo': { story: GRAPHS, hash: 'search' },
  'graph--scale1k-nodes': { story: GRAPHS, hash: 'scale' },
  'graph--scale5k-nodes': { story: GRAPHS, hash: 'scale' },
  'graph--scale10k-nodes': { story: GRAPHS, hash: 'scale' },
  'graph--scale20k-nodes': { story: GRAPHS, hash: 'scale' },
  // responsive-graph.stories.tsx
  'responsive-graph--mobile-portrait': { story: GRAPHS, hash: 'communities' },
  'responsive-graph--desktop-sizes': { story: GRAPHS, hash: 'communities' },
  'responsive-graph--resizable': { story: GRAPHS, hash: 'communities' },

  // ── Phase 03: Sankey & Tile Maps ──
  // charts/sankey.stories.tsx
  'sankey--energy-flow': { story: SANKEY_TILEMAPS, hash: 'energy-flow' },
  'sankey--budget-allocation': { story: SANKEY_TILEMAPS, hash: 'budget-allocation' },
  'sankey--user-journey': { story: SANKEY_TILEMAPS, hash: 'user-journey' },
  'sankey--custom-colors': { story: SANKEY_TILEMAPS, hash: 'link-coloring' },
  'sankey--dark-mode': { story: SANKEY_TILEMAPS, hash: 'energy-flow' },
  'sankey--animated': { story: SANKEY_TILEMAPS, hash: 'energy-flow' },
  'sankey--compact': { story: SANKEY_TILEMAPS, hash: 'energy-flow' },
  // charts/tilemap.stories.tsx
  'tilemap--unemployment-rate': { story: SANKEY_TILEMAPS, hash: 'quantitative' },
  'tilemap--partial-data': { story: SANKEY_TILEMAPS, hash: 'partial-data' },
  'tilemap--dark-mode': { story: SANKEY_TILEMAPS, hash: 'quantitative' },
  'tilemap--green-palette': { story: SANKEY_TILEMAPS, hash: 'palettes' },
  'tilemap--tabular-data': { story: SANKEY_TILEMAPS, hash: 'quantitative' },
  'tilemap--with-chrome': { story: SANKEY_TILEMAPS, hash: 'quantitative' },
  'tilemap--compact': { story: SANKEY_TILEMAPS, hash: 'quantitative' },
  'tilemap--categorical': { story: SANKEY_TILEMAPS, hash: 'categorical' },
  'tilemap--categorical-dark': { story: SANKEY_TILEMAPS, hash: 'categorical' },

  // ── Phase 03: Dashboards ──
  // sparkline.stories.tsx
  'sparkline--markets-dashboard': { story: DASHBOARDS, hash: 'sparkline-cards' },
  'sparkline--trend-colors': { story: DASHBOARDS, hash: 'sparkline-cards' },
  'sparkline--bar-variants': { story: DASHBOARDS, hash: 'sparkline-cards' },
  'sparkline--sizes': { story: DASHBOARDS, hash: 'sparkline-cards' },
  // financial.stories.tsx
  'financial--stock-price': { story: DASHBOARDS, hash: 'kpi-metrics' },
  'financial--benchmark-comparison': { story: DASHBOARDS, hash: 'crosshair-line' },
  'financial--sector-returns': { story: DASHBOARDS, hash: 'sector-returns' },
  'financial--risk-return': { story: DASHBOARDS, hash: 'crosshair-line' },
  'financial--earnings-season': { story: DASHBOARDS, hash: 'bar-list' },
};

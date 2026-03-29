/**
 * @opendata-ai/openchart-svelte
 *
 * Svelte 5 adapter for openchart. Provides <Chart />, <DataTable />,
 * and <Graph /> components that wrap the vanilla adapter with Svelte
 * lifecycle management using runes.
 *
 * Re-exports the full core type system and utilities so Svelte consumers
 * only need a single @opendata-ai/openchart-svelte dependency.
 */

// ---------------------------------------------------------------------------
// Core: full type system, theme, colors, locale, accessibility, helpers
// ---------------------------------------------------------------------------

export * from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Vanilla: export utilities (SVG/PNG/JPG/CSV)
// ---------------------------------------------------------------------------

export type { JPGExportOptions, PNGExportOptions } from '@opendata-ai/openchart-vanilla';
export { exportCSV, exportJPG, exportPNG, exportSVG } from '@opendata-ai/openchart-vanilla';

// ---------------------------------------------------------------------------
// Engine: compile API and types not covered by core
// ---------------------------------------------------------------------------

export type {
  ChartRenderer,
  CompiledGraphEdge,
  CompiledGraphNode,
  CompileResult,
  GraphCompilation,
  NormalizedChartSpec,
  NormalizedChrome,
  NormalizedGraphSpec,
  NormalizedSankeySpec,
  NormalizedSpec,
  NormalizedTableSpec,
  SimulationConfig,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
} from '@opendata-ai/openchart-engine';
export {
  clearRenderers,
  compile,
  compileChart,
  compileGraph,
  compileSankey,
  compileTable,
  getChartRenderer,
  normalizeSpec,
  registerChartRenderer,
  validateSpec,
} from '@opendata-ai/openchart-engine';

// Components
export { default as Chart } from './Chart.svelte';
export type { UseChartOptions, UseChartReturn } from './composables/useChart.svelte.js';
export { useChart } from './composables/useChart.svelte.js';
// Composables
export { useDarkMode } from './composables/useDarkMode.svelte.js';
export type { UseGraphOptions, UseGraphReturn } from './composables/useGraph.svelte.js';
export { useGraph } from './composables/useGraph.svelte.js';
export type { UseTableReturn } from './composables/useTable.svelte.js';
export { useTable } from './composables/useTable.svelte.js';
export type {
  UseTableStateOptions,
  UseTableStateReturn,
} from './composables/useTableState.svelte.js';
export { useTableState } from './composables/useTableState.svelte.js';
// Context
export { getVizDarkMode, getVizTheme, setVizDarkMode, setVizTheme } from './context.js';
export { default as DataTable } from './DataTable.svelte';
export { default as Graph } from './Graph.svelte';
export { default as Sankey } from './Sankey.svelte';
export { default as VizThemeProvider } from './ThemeProvider.svelte';
// Component prop types
export type {
  ChartProps,
  DataTableProps,
  GraphProps,
  SankeyProps,
  VisualizationProps,
  VizThemeProviderProps,
} from './types.js';
export { default as Visualization } from './Visualization.svelte';

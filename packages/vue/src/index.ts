/**
 * @opendata-ai/openchart-vue
 *
 * Vue 3 adapter for openchart. Provides <Chart />, <DataTable />, <Graph />,
 * and <VizThemeProvider /> components that wrap the vanilla adapter with
 * Vue lifecycle management.
 *
 * Re-exports the full core type system and utilities so Vue consumers
 * only need a single @opendata-ai/openchart-vue dependency.
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
export type { ChartProps } from './Chart';
export { Chart } from './Chart';
// Composables
export type { UseChartOptions, UseChartReturn } from './composables/useChart';
export { useChart } from './composables/useChart';
export { useDarkMode } from './composables/useDarkMode';
export type { GraphHandle, UseGraphReturn } from './composables/useGraph';
export { useGraph } from './composables/useGraph';
export type { UseTableReturn } from './composables/useTable';
export { useTable } from './composables/useTable';
export type { UseTableStateOptions, UseTableStateReturn } from './composables/useTableState';
export { useTableState } from './composables/useTableState';
// Context (injection keys and composables)
export { useVizDarkMode, useVizTheme, VizDarkModeKey, VizThemeKey } from './context';
export type { DataTableProps } from './DataTable';
export { DataTable } from './DataTable';
export type { GraphProps } from './Graph';
export { Graph } from './Graph';
export type { SankeyProps } from './Sankey';
export { Sankey } from './Sankey';
export type { VizThemeProviderProps } from './ThemeProvider';
export { VizThemeProvider } from './ThemeProvider';
export type { VisualizationProps } from './Visualization';
export { Visualization } from './Visualization';

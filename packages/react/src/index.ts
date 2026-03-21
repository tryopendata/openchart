/**
 * @opendata-ai/openchart-react
 *
 * React adapter for openchart. Provides <Chart /> and <DataTable />
 * components that wrap the vanilla adapter with React lifecycle management.
 *
 * Re-exports the full core type system and utilities so React consumers
 * only need a single @opendata-ai/openchart-react dependency.
 */

// ---------------------------------------------------------------------------
// Core: full type system, theme, colors, locale, accessibility, helpers
// ---------------------------------------------------------------------------

export * from '@opendata-ai/openchart-core';

// ---------------------------------------------------------------------------
// Vanilla: export utilities (SVG/PNG/JPG/CSV)
// ---------------------------------------------------------------------------

export type {
  JPGExportOptions,
  PNGExportOptions,
  SVGExportOptions,
} from '@opendata-ai/openchart-vanilla';
export {
  exportCSV,
  exportJPG,
  exportPNG,
  exportSVG,
  exportSVGWithFonts,
} from '@opendata-ai/openchart-vanilla';

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
  compileTable,
  getChartRenderer,
  normalizeSpec,
  registerChartRenderer,
  validateSpec,
} from '@opendata-ai/openchart-engine';

export type { ChartProps } from './Chart';
// Components
export { Chart } from './Chart';
export type { DataTableProps } from './DataTable';
export { DataTable } from './DataTable';
export type { GraphProps } from './Graph';
export { Graph } from './Graph';
export type { UseChartOptions, UseChartReturn } from './hooks';
// Hooks
export { useChart, useDarkMode } from './hooks';
export type { GraphHandle, UseGraphReturn } from './hooks/useGraph';
export { useGraph } from './hooks/useGraph';
export type { UseTableReturn } from './hooks/useTable';
export { useTable } from './hooks/useTable';
export type { UseTableStateOptions, UseTableStateReturn } from './hooks/useTableState';
export { useTableState } from './hooks/useTableState';
export type { VizThemeProviderProps } from './ThemeContext';
// Theme context
export { useVizDarkMode, useVizTheme, VizThemeProvider } from './ThemeContext';
export type { VisualizationProps } from './Visualization';
export { Visualization } from './Visualization';

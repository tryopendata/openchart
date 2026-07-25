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
  SpecSequenceOptions,
  SVGExportOptions,
} from '@opendata-ai/openchart-vanilla';
export {
  exportCSV,
  exportJPG,
  exportPNG,
  exportSpecSequence,
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
  NormalizedBarListSpec,
  NormalizedChartSpec,
  NormalizedChrome,
  NormalizedGeoMapSpec,
  NormalizedGraphSpec,
  NormalizedSankeySpec,
  NormalizedSpec,
  NormalizedTableSpec,
  NormalizedTileMapSpec,
  SimulationConfig,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
} from '@opendata-ai/openchart-engine';
export {
  clearRenderers,
  compile,
  compileBarList,
  compileChart,
  compileGeoMap,
  compileGraph,
  compileSankey,
  compileTable,
  compileTileMap,
  getChartRenderer,
  normalizeSpec,
  registerChartRenderer,
  validateSpec,
} from '@opendata-ai/openchart-engine';
export type { BarListHandle, BarListProps } from './BarList';
export { BarList } from './BarList';
export type { ChartHandle, ChartProps } from './Chart';
// Components
export { Chart } from './Chart';
export type { ChartStoryHandle, ChartStoryProps } from './ChartStory';
// Scrollytelling
export { ChartStory } from './ChartStory';
export type { DataTableProps } from './DataTable';
export { DataTable } from './DataTable';
export type { GeoMapHandle, GeoMapProps } from './GeoMap';
export { GeoMap } from './GeoMap';
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
export type { SankeyHandle, SankeyProps } from './Sankey';
export { Sankey } from './Sankey';
export type { VizThemeProviderProps } from './ThemeContext';
// Theme context
export { useVizDarkMode, useVizTheme, VizThemeProvider } from './ThemeContext';
export type { TileMapHandle, TileMapProps } from './TileMap';
export { TileMap } from './TileMap';
export type { VisualizationProps } from './Visualization';
export { Visualization } from './Visualization';

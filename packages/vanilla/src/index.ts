/**
 * @opendata-ai/openchart-vanilla
 *
 * Vanilla JS adapter for openchart. Renders ChartLayout and TableLayout
 * objects into real DOM elements using imperative SVG/HTML creation.
 *
 * Provides createChart() for mounting visualizations, ResizeObserver integration
 * for responsive behavior, tooltip management, and SVG/PNG/CSV export.
 */

// Re-export core types for convenience
export type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  TableLayout,
  TableSpec,
  VizSpec,
} from '@opendata-ai/openchart-engine';
export type { JPGExportOptions, PNGExportOptions } from './export';
// Export utilities
export { exportCSV, exportJPG, exportPNG, exportSVG } from './export';
// Graph simulation worker
export { createSimulationWorker } from './graph/simulation-worker-url';
export type { GraphInstance, GraphMountOptions } from './graph-mount';
// Graph mount API
export { createGraph } from './graph-mount';
export type { ChartInstance, ExportOptions, MountOptions } from './mount';
// Main mount API
export { createChart } from './mount';
// Cell renderers
export {
  renderBarCell,
  renderCategoryCell,
  renderCell,
  renderFlagCell,
  renderHeatmapCell,
  renderImageCell,
  renderSparklineCell,
  renderTextCell,
} from './renderers/table-cells';
// Resize observer
export { observeResize } from './resize-observer';
// SVG renderer (for advanced usage / custom rendering)
export { registerMarkRenderer, renderChartSVG } from './svg-renderer';
export type { KeyboardNavOptions } from './table-keyboard';
// Table keyboard navigation
export { attachKeyboardNav } from './table-keyboard';
export type { TableInstance, TableMountOptions, TableState } from './table-mount';
// Table mount API
export { createTable } from './table-mount';
// Table renderer (for advanced usage / custom rendering)
export { renderTable } from './table-renderer';
export type { TooltipManager } from './tooltip';
// Tooltip
export { createTooltipManager } from './tooltip';

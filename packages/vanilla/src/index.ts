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
export type { BarListInstance, BarListMountOptions } from './barlist-mount';
// BarList mount API
export { createBarList } from './barlist-mount';
export type { JPGExportOptions, PNGExportOptions, SVGExportOptions } from './export';
// Export utilities
export { exportCSV, exportJPG, exportPNG, exportSVG, exportSVGWithFonts } from './export';
// Graph simulation worker
export { createSimulationWorker } from './graph/simulation-worker-url';
export type { GraphInstance, GraphMountOptions } from './graph-mount';
// Graph mount API
export { createGraph } from './graph-mount';
export type { Camera, MapCameraOptions } from './map-camera';
export type { MapInstance, MapMarkEvent, MapMountOptions } from './map-mount';
// Map mount API
export { createMap } from './map-mount';
export type { ChartInstance, ExportOptions, MountOptions, UpdateOptions } from './mount';
// Main mount API
export { createChart } from './mount';
// Geometry helpers for mark path reconstruction
export { rectPathWithCorners } from './renderers/marks';
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
export type { SankeyInstance, SankeyMountOptions } from './sankey-mount';
// Sankey mount API
export { createSankey } from './sankey-mount';
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
export type { TextEditOverlayConfig } from './text-edit-overlay';
export { createTextEditOverlay } from './text-edit-overlay';
export type { TileMapInstance, TileMapMountOptions } from './tilemap-mount';
// TileMap mount API
export { createTileMap } from './tilemap-mount';
export type { TooltipManager } from './tooltip';
// Tooltip
export { createTooltipManager } from './tooltip';
export type { YouDrawItController, YouDrawItOptions } from './you-draw-it';
// You draw it (interactive draw-then-reveal)
export { createYouDrawIt } from './you-draw-it';

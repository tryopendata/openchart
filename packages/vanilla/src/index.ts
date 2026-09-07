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
export { materializeCanvasModeSVG, VECTOR_EXPORT_MAX_POINTS } from './export-canvas';
// Multi-spec ("keyframe") GIF export for spec-swap steppers. Loads the optional
// `gifenc` peer lazily, so importing this symbol does not pull gifenc into the bundle.
export type { SpecSequenceOptions } from './export-sequence';
export { exportSpecSequence } from './export-sequence';
export type { CameraFlightOptions } from './graph/camera';
// Graph renderer registry: the 3D subpath registers itself here on import.
export type {
  GraphRendererContext,
  GraphRendererFactory,
  GraphShell,
} from './graph/renderer-registry';
/**
 * `registerGraphRenderer` is the extension point: call it with a
 * `GraphRendererFactory` to supply your own renderer for a dimension count, the
 * way the `@opendata-ai/openchart-vanilla/graph-3d` subpath registers the WebGL
 * one on import. `createGraph()` looks the factory up at mount time and throws
 * `GRAPH_3D_NOT_REGISTERED_ERROR` when a `dimensions: 3` spec finds none.
 *
 * The lookup itself (`getGraphRenderer`) and the shell builder
 * (`createGraphShell`) stay internal: they are the mount path's own plumbing,
 * not surface a host is meant to drive.
 */
export {
  GRAPH_3D_NOT_REGISTERED_ERROR,
  registerGraphRenderer,
} from './graph/renderer-registry';
// Graph simulation worker
export { createSimulationWorker } from './graph/simulation-worker-url';
export type {
  GraphCamera,
  GraphFlyTarget,
  GraphHighlightTarget,
  GraphInstance,
  GraphLegendData,
  GraphMountOptions,
  GraphTooltipFormatter,
  GraphTooltipItem,
} from './graph-mount';
// Graph mount API
export { createGraph } from './graph-mount';
export type { Camera, GeoMapCameraOptions } from './map-camera';
export type { GeoMapInstance, GeoMapMarkEvent, GeoMapMountOptions } from './map-mount';
// Map mount API
export { createGeoMap } from './map-mount';
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
// Data-update transitions: the default mark cap, so apps deciding whether to
// raise animation.update.maxMarks can compare against it instead of hardcoding.
export { CANVAS_DEFAULT_UPDATE_MAX_MARKS, DEFAULT_UPDATE_MAX_MARKS } from './transition';
export type { YouDrawItController, YouDrawItOptions } from './you-draw-it';
// You draw it (interactive draw-then-reveal)
export { createYouDrawIt } from './you-draw-it';

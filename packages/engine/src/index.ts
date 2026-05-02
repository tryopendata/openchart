/**
 * @opendata-ai/openchart-engine
 *
 * Headless computation engine that takes a declarative spec and produces
 * structured layout objects (ChartLayout, TableLayout, GraphCompilation).
 *
 * The engine does pure math and data transformation. It knows nothing about
 * the DOM, React, or any rendering target.
 */

// ---------------------------------------------------------------------------
// Main compile API
// ---------------------------------------------------------------------------

export {
  compileBarList,
  compileChart,
  compileGraph,
  compileLayer,
  compileSankey,
  compileTable,
  compileTileMap,
} from './compile';

// ---------------------------------------------------------------------------
// Animation resolution
// ---------------------------------------------------------------------------

export { clampStaggerDelay, resolveAnimation } from './compiler/animation';

// ---------------------------------------------------------------------------
// Graph compilation types
// ---------------------------------------------------------------------------

export type {
  CompiledGraphEdge,
  CompiledGraphNode,
  GraphCompilation,
  SimulationConfig,
} from './graphs/types';

// ---------------------------------------------------------------------------
// Sankey compilation types
// ---------------------------------------------------------------------------

export type { NormalizedSankeySpec } from './sankey/types';

// ---------------------------------------------------------------------------
// TileMap compilation types
// ---------------------------------------------------------------------------

export type { NormalizedBarListSpec } from './barlist/types';

export type { NormalizedTileMapSpec } from './tilemap/types';

// ---------------------------------------------------------------------------
// Compiler pipeline (spec validation, normalization, generic compile)
// ---------------------------------------------------------------------------

export type {
  CompileResult,
  NormalizedChartSpec,
  NormalizedChrome,
  NormalizedGraphSpec,
  NormalizedSpec,
  NormalizedTableSpec,
  ValidationError,
  ValidationErrorCode,
  ValidationResult,
} from './compiler/index';
export {
  compile,
  normalizeSpec,
  validateSpec,
} from './compiler/index';

// ---------------------------------------------------------------------------
// Chart renderer plugin API
// ---------------------------------------------------------------------------

export type { ChartRenderer } from './charts/registry';
export {
  clearRenderers,
  getChartRenderer,
  registerChartRenderer,
} from './charts/registry';

// ---------------------------------------------------------------------------
// Data transforms
// ---------------------------------------------------------------------------

export {
  evaluatePredicate,
  isConditionalValueDef,
  resolveConditionalValue,
  runBin,
  runCalculate,
  runFilter,
  runTimeUnit,
  runTransforms,
} from './transforms';

// ---------------------------------------------------------------------------
// Re-export core types for convenience
// ---------------------------------------------------------------------------

export type {
  BarListLayout,
  BarListSpec,
  ChartLayout,
  ChartSpec,
  CompileOptions,
  CompileTableOptions,
  GraphLayout,
  GraphSpec,
  LayerSpec,
  SankeyLayout,
  SankeySpec,
  TableLayout,
  TableSpec,
  TileMapLayout,
  TileMapSpec,
  VizSpec,
} from '@opendata-ai/openchart-core';

/**
 * @openchart/engine
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

export { compileChart, compileGraph, compileTable } from './compile';

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
// Chart type registration (side-effect imports trigger self-registration)
// ---------------------------------------------------------------------------

import './charts/line/index';
import './charts/bar/index';
import './charts/column/index';
import './charts/scatter/index';
import './charts/pie/index';
import './charts/dot/index';

// ---------------------------------------------------------------------------
// Re-export core types for convenience
// ---------------------------------------------------------------------------

export type {
  ChartLayout,
  ChartSpec,
  CompileOptions,
  CompileTableOptions,
  GraphLayout,
  GraphSpec,
  TableLayout,
  TableSpec,
  VizSpec,
} from '@openchart/core';

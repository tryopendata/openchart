/**
 * Main compile API: the public entry points for the engine.
 *
 * Pipeline for charts (see ./compile/chart.ts for the phases):
 *   validate spec -> normalize -> resolve theme -> dark mode adapt ->
 *   filter data -> resolveLayoutPlan (measure real labels) ->
 *   compute dimensions (with plan) -> placeLegend ->
 *   compute scales -> compute axes (with pinned ticks) -> compute gridlines ->
 *   get chart renderer -> compute marks -> compute a11y -> return ChartLayout
 *
 * Table compiler handles full data pipeline (sort, search, pagination, visual enhancements).
 */

import type {
  BarListLayout,
  ChartLayout,
  CompileOptions,
  CompileTableOptions,
  DesignDiagnostic,
  GeoMapLayout,
  LayerSpec,
  SankeyLayout,
  TableLayout,
  TileMapLayout,
} from '@opendata-ai/openchart-core';
import { assertMarkOptions } from './compiler/mark-options';
// Side-effect import: registers all built-in chart renderers with the
// registry on module load. Tests that clear the registry can import
// `registerBuiltinRenderers` from `./charts/builtin` to restore defaults.
import './charts/builtin';
import { compileBarList as compileBarListImpl } from './barlist/compile-barlist';
import { compileChartInternal, resolveCompileTheme } from './compile/chart';
import { compileLayer as compileLayerImpl } from './compile/layer';
import { applySpecSize } from './compile/prepare';
import { emitSpecWarnings, expandSpecSugar } from './compile/spec-sugar';
import { compile as compileSpec } from './compiler/index';
import type { NormalizedTableSpec } from './compiler/types';
import { noteCapacityDiagnostic } from './design/diagnostics';
import { compileGeoMap as compileGeoMapImpl } from './geo/compile-geo-map';
import { compileGraph as compileGraphImpl } from './graphs/compile-graph';
import type { GraphCompilation } from './graphs/types';
import { isNoteOverflowDiagnostic } from './layout/budget';
import { compileSankey as compileSankeyImpl } from './sankey/compile-sankey';
import { compileTableLayout } from './tables/compile-table';
import { compileTileMap as compileTileMapImpl } from './tilemap/compile-tilemap';

// Spec sugar implementation lives in ./compile/spec-sugar; re-exported here so
// existing deep imports (`import { expandEncodingSugar } from '.../compile'`)
// keep working.
export { expandEncodingSugar, expandSpecSugar } from './compile/spec-sugar';

// ---------------------------------------------------------------------------
// Chart compilation
// ---------------------------------------------------------------------------

/**
 * Compile a chart spec into a ChartLayout.
 *
 * This is the main engine entry point. Takes a raw spec (any shape,
 * validated at runtime) and compile options, produces a fully resolved
 * ChartLayout with positions, colors, and marks ready for rendering.
 *
 * @param spec - Raw chart spec (validated and normalized internally).
 * @param optionsInput - Compile options (width, height, theme, darkMode).
 *   Top-level spec width/height, when present, override the option values.
 * @returns ChartLayout with all computed positions.
 * @throws Error if spec is invalid or not a chart type.
 */
export function compileChart(spec: unknown, optionsInput: CompileOptions): ChartLayout {
  assertMarkOptions(spec);
  return compileChartInternal(spec, optionsInput);
}

// ---------------------------------------------------------------------------
// Layer compilation
// ---------------------------------------------------------------------------

export function compileLayer(spec: LayerSpec, options: CompileOptions): ChartLayout {
  // Expand VL-idiom sugar on the layer spec and every child up front. Leaf
  // compiles re-run the (idempotent) expansion after encoding inheritance;
  // warning triggers are stripped or stamped here so each warns exactly once.
  const sugarWarnings: string[] = [];
  const expanded = expandSpecSugar(
    spec as unknown as Record<string, unknown>,
    sugarWarnings,
  ) as unknown as LayerSpec;
  emitSpecWarnings(sugarWarnings, options.onWarn);
  const resolvedOptions = applySpecSize(expanded, options);
  // Leaves can each report the overflow of the shared note band; keep one.
  let noteOverflow: DesignDiagnostic | undefined;
  const layout = compileLayerImpl(
    expanded,
    {
      ...resolvedOptions,
      onDiagnostic: options.onDiagnostic
        ? (diagnostic) => {
            // Report note exhaustion against the assembled figure, not intermediate leaves.
            if (diagnostic.code !== 'layout.note-capacity') options.onDiagnostic!(diagnostic);
            else if (isNoteOverflowDiagnostic(diagnostic)) noteOverflow ??= diagnostic;
          }
        : undefined,
    },
    compileChartInternal,
  );
  const diagnostic = noteCapacityDiagnostic(layout) ?? noteOverflow;
  if (diagnostic) options.onDiagnostic?.(diagnostic);
  return layout;
}

// ---------------------------------------------------------------------------
// Table compilation
// ---------------------------------------------------------------------------

/**
 * Compile a table spec into a TableLayout.
 *
 * Validates and normalizes the spec, resolves the theme, then delegates
 * to compileTableLayout for the full pipeline: column resolution, search,
 * sort, pagination, cell formatting, and visual enhancements.
 *
 * @param spec - Raw table spec.
 * @param options - Compile options with sort, search, pagination state.
 * @returns Fully resolved TableLayout.
 */
export function compileTable(spec: unknown, options: CompileTableOptions): TableLayout {
  const { spec: normalized, warnings: normalizeWarnings } = compileSpec(spec);
  emitSpecWarnings(normalizeWarnings, options.onWarn);

  const normType = 'type' in normalized ? normalized.type : undefined;
  if (normType !== 'table') {
    throw new Error(`compileTable received a non-table spec. Use compileChart instead.`);
  }

  const tableSpec = normalized as NormalizedTableSpec;

  // Resolve theme: merge spec-level theme with options-level overrides
  const theme = resolveCompileTheme(tableSpec.theme, options);

  // Resolve watermark: spec-level wins, then options, then default true
  const rawWatermark = (spec as Record<string, unknown>).watermark;
  const watermark = rawWatermark !== undefined ? tableSpec.watermark : (options.watermark ?? true);

  return compileTableLayout({ ...tableSpec, watermark }, options, theme);
}

// ---------------------------------------------------------------------------
// Graph compilation
// ---------------------------------------------------------------------------

/**
 * Compile a graph spec into a GraphCompilation.
 *
 * The graph pipeline resolves visual properties (size, color, stroke) for
 * nodes and edges, assigns communities, and builds legend/tooltip/a11y data.
 * Unlike charts, the output does NOT include x/y positions since the force
 * simulation in the adapter handles layout at runtime.
 *
 * @param spec - Raw graph spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns GraphCompilation with resolved visual properties and simulation config.
 * @throws Error if spec is invalid or not a graph type.
 */
export function compileGraph(spec: unknown, options: CompileOptions): GraphCompilation {
  return compileGraphImpl(spec, options);
}

// ---------------------------------------------------------------------------
// Sankey compilation
// ---------------------------------------------------------------------------

/**
 * Compile a sankey spec into a SankeyLayout.
 *
 * Takes a raw sankey spec, validates, normalizes, resolves theme and chrome,
 * runs the d3-sankey layout algorithm, builds node/link marks with colors and
 * labels, and returns a SankeyLayout ready for rendering.
 *
 * @param spec - Raw sankey spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns SankeyLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a sankey type.
 */
export function compileSankey(spec: unknown, options: CompileOptions): SankeyLayout {
  return compileSankeyImpl(spec, options);
}

// ---------------------------------------------------------------------------
// TileMap compilation
// ---------------------------------------------------------------------------

/**
 * Compile a tilemap spec into a TileMapLayout.
 *
 * Takes a raw tilemap spec, validates, normalizes, resolves theme and chrome,
 * computes tile positions, builds tile marks with colors and labels, and
 * returns a TileMapLayout ready for rendering.
 *
 * @param spec - Raw tilemap spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns TileMapLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a tilemap type.
 */
export function compileTileMap(spec: unknown, options: CompileOptions): TileMapLayout {
  return compileTileMapImpl(spec, options);
}

// ---------------------------------------------------------------------------
// Map compilation
// ---------------------------------------------------------------------------

/**
 * Compile a map spec into a GeoMapLayout.
 *
 * Takes a raw map spec, validates, normalizes, resolves theme and chrome,
 * projects geo features, joins data, builds feature marks with color fills,
 * and returns a GeoMapLayout ready for rendering.
 *
 * @param spec - Raw map spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns GeoMapLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a map type.
 */
export function compileGeoMap(spec: unknown, options: CompileOptions): GeoMapLayout {
  return compileGeoMapImpl(spec, options);
}

// ---------------------------------------------------------------------------
// BarList compilation
// ---------------------------------------------------------------------------

/**
 * Compile a barlist spec into a BarListLayout.
 *
 * Takes a raw barlist spec, validates, normalizes, resolves theme and chrome,
 * computes row layout with proportional bars, builds tooltips, and returns
 * a BarListLayout ready for rendering.
 *
 * @param spec - Raw barlist spec (validated and normalized internally).
 * @param options - Compile options (width, height, theme, darkMode).
 * @returns BarListLayout with computed positions and visual properties.
 * @throws Error if spec is invalid or not a barlist type.
 */
export function compileBarList(spec: unknown, options: CompileOptions): BarListLayout {
  return compileBarListImpl(spec, options);
}

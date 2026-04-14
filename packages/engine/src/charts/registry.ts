/**
 * Chart renderer registry.
 *
 * Each chart type (line, bar, column, scatter, pie, donut, dot) registers
 * a renderer that produces marks from normalized specs and resolved scales.
 * The registry pattern decouples chart-type logic from the compile pipeline.
 */

import type { LayoutStrategy, Mark, Rect, ResolvedTheme } from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A chart renderer function.
 *
 * Takes a normalized spec, resolved scales, chart area, layout strategy,
 * and the resolved theme for theme-aware styling (e.g. label colors).
 * Returns an array of marks to render.
 */
export type ChartRenderer = (
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
) => Mark[];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const renderers = new Map<string, ChartRenderer>();

/**
 * Register a chart renderer for a specific chart type.
 *
 * @param type - Chart type string (e.g. "line", "bar").
 * @param renderer - The renderer function.
 */
export function registerChartRenderer(type: string, renderer: ChartRenderer): void {
  renderers.set(type, renderer);
}

/**
 * Get the registered chart renderer for a type.
 *
 * @param type - Chart type string.
 * @returns The renderer, or undefined if no renderer is registered.
 */
export function getChartRenderer(type: string): ChartRenderer | undefined {
  return renderers.get(type);
}

/**
 * Clear all registered renderers. Useful for testing.
 *
 * Note: the built-in renderers (line, bar, column, ...) register as a
 * side-effect of importing `./builtin`. Once cleared, they do not come
 * back on their own — subsequent `compileChart(...)` calls will return
 * empty marks. Tests that call `clearRenderers()` should follow up with
 * `registerBuiltinRenderers()` from `./builtin` to restore the defaults.
 */
export function clearRenderers(): void {
  renderers.clear();
}

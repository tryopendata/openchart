/**
 * Chart renderer registry.
 *
 * Each chart type (line, bar, column, scatter, pie, donut, dot) registers
 * a renderer that produces marks from normalized specs and resolved scales.
 * The registry pattern decouples chart-type logic from the compile pipeline.
 */

import type {
  LayoutStrategy,
  Mark,
  MeasureTextFn,
  Rect,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';

import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import type { BarLabelPlan } from './bar/label-plan';
import { builtinRenderers } from './builtin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A chart renderer function.
 *
 * Takes a normalized spec, resolved scales, chart area, layout strategy,
 * the resolved theme for theme-aware styling (e.g. label colors), and the
 * full container width (used by geometry gates that must key off the
 * container, not the derived plot width). Returns an array of marks to render.
 */
export type ChartRenderer = (
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  theme: ResolvedTheme,
  containerWidth: number,
  labelPlan?: BarLabelPlan,
  measureText?: MeasureTextFn,
) => Mark[];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const renderers = new Map<string, ChartRenderer>();
let builtinsInstalled = false;

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
 * Get the registered chart renderer for a type, installing missing built-ins on the first lookup.
 *
 * @param type - Chart type string.
 * @returns The renderer, or undefined if no renderer is registered.
 */
export function getChartRenderer(type: string): ChartRenderer | undefined {
  if (!builtinsInstalled) {
    builtinsInstalled = true;
    for (const [builtinType, renderer] of Object.entries(builtinRenderers)) {
      if (!renderers.has(builtinType)) renderers.set(builtinType, renderer);
    }
  }
  return renderers.get(type);
}

/**
 * Clear all registered renderers and skip lazy installation on later lookups.
 */
export function clearRenderers(): void {
  renderers.clear();
  builtinsInstalled = true;
}

/** Restore all built-in renderers, overwriting any registrations for their types. */
export function registerBuiltinRenderers(): void {
  for (const [type, renderer] of Object.entries(builtinRenderers)) {
    renderers.set(type, renderer);
  }
  builtinsInstalled = true;
}

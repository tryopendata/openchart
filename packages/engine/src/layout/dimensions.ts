/**
 * Dimension computation for the chart layout: a thin view over the figure
 * budget (see ./budget.ts), kept for callers that only need the dimensions.
 */

import type { LayoutStrategy, LegendLayout, ResolvedTheme } from '@opendata-ai/openchart-core';
import type { InternalCompileOptions } from '../compile/internal-options';
import type { NormalizedChartSpec } from '../compiler/types';
import { type BudgetReserves, type FigureBudget, resolveFigureBudget } from './budget';
import type { LayoutPlan } from './plan';

/** The complete dimension layout for a chart. */
export type LayoutDimensions = FigureBudget;

/**
 * Compute chart dimensions, reserving space for chrome, legend, and axes.
 * Equivalent to `resolveFigureBudget`.
 */
export function computeDimensions(
  spec: NormalizedChartSpec,
  options: InternalCompileOptions,
  legendLayout: LegendLayout,
  theme: ResolvedTheme,
  strategy: LayoutStrategy | undefined,
  watermark: boolean,
  plan: LayoutPlan,
  reserves?: BudgetReserves,
): LayoutDimensions {
  return resolveFigureBudget(
    spec,
    options,
    legendLayout,
    theme,
    strategy,
    watermark,
    plan,
    reserves,
  );
}

import type { CompileOptions, LegendEntry, Rect } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import type { FigureBudget } from '../layout/budget';
import type { LayoutPlan } from '../layout/plan';

/**
 * A layer assembly's resolved plot, shared by every leaf it compiles so their
 * marks land in one coordinate space with one note band.
 */
export interface FrozenBudget {
  /** The plot rectangle every leaf draws into. */
  chartArea: Rect;
  /** Note band the assembly reserved below the plot. */
  noteReserve?: number;
}

/** Out-parameters a leaf compile reports back to its layer assembly. */
export interface LeafContext {
  /** The leaf's resolved figure budget (reference lanes, note band, plot). */
  budget?: FigureBudget;
  /** The layout plan the budget was resolved from (provisional plot height). */
  plan?: LayoutPlan;
  /** Eligible entries collected from transformed rows before per-leaf truncation. */
  categoricalLegend?: { entries: LegendEntry[]; config: NormalizedChartSpec['legend'] };
}

/**
 * Engine-internal compile options. Layer assembly passes these to leaf
 * compiles; they are not part of the public `CompileOptions` contract.
 */
export interface InternalCompileOptions extends CompileOptions {
  /**
   * Marks this compile as one leaf (or the primary spec) of a multi-leaf
   * layer. The canvas mark-layer resolution refuses canvas mode for layered
   * charts because the layer layout concatenates marks from several compiles.
   */
  layered?: boolean;
  /** Complete eligible categorical legend for an independent-layer figure. */
  categoricalLegend?: { entries: LegendEntry[]; config: NormalizedChartSpec['legend'] };
  /** Right-margin reserve for a dual-axis secondary y-axis. */
  rightAxisReserve?: number;
  /** Share the measured title band between independent y-axis headers. */
  axisHeaderWidthFraction?: number;
  /** Use the assembly's plot and note band instead of resolving a budget. */
  frozenBudget?: FrozenBudget;
  /** Receives the leaf's budget for the layer assembly. */
  leafContext?: LeafContext;
}

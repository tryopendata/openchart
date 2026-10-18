/** Decisions made before scales/placement; frame owns all resulting reservations. */
import type { MeasureTextFn, ResolvedTheme } from '@opendata-ai/openchart-core';
import { estimateTextWidth } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../../compiler/types';
import { finiteNumber } from '../../data/finite-number';
import { resolveFieldFormatter } from '../../format/field-format';
import { resolveRendererKey } from '../post-process';

export type BarLabelPlacement = 'adaptive' | 'inside' | 'outside' | 'column' | 'suppress';
export interface BarLabelPlan {
  placement: BarLabelPlacement;
  reserveLeft: number;
  reserveRight: number;
  reserveTop: number;
  reserveBottom: number;
  columnWidth: number;
  fallback?: 'column-to-outside' | 'labels-suppressed';
}
export interface BarLabelPlanOptions {
  /** Plot width before value-label reservations, after category/axis gutters. */
  availableWidth: number;
  availableHeight?: number;
  /** Actual candidate plot height measured by the shared frame, after every band. */
  plotHeightForPlan?: (plan: BarLabelPlan) => number;
  minPlotWidth?: number;
  minPlotHeight?: number;
  measureText?: MeasureTextFn;
  /** Shared figure measurement for aligned facet value columns. */
  columnWidth?: number;
}

export function planBarLabels(
  spec: NormalizedChartSpec,
  _theme: ResolvedTheme,
  options: BarLabelPlanOptions,
): BarLabelPlan {
  const requested = spec.labels.placement ?? 'adaptive';
  const empty: BarLabelPlan = {
    placement: requested,
    reserveLeft: 0,
    reserveRight: 0,
    reserveTop: 0,
    reserveBottom: 0,
    columnWidth: 0,
  };
  if (requested === 'adaptive' || requested === 'inside' || spec.labels.density === 'none')
    return empty;
  const horizontal = resolveRendererKey(spec.markType, spec.encoding, spec.markDef) === 'bar';
  const channel = horizontal ? spec.encoding.x : spec.encoding.y;
  if (!channel || !('field' in channel)) return empty;
  const field = channel.field;
  const values = spec.data
    .map((row) => finiteNumber(row[field]))
    .filter((value): value is number => value !== undefined);
  const format = resolveFieldFormatter({
    surfaceFormat: spec.labels.format,
    channelFormat: 'format' in channel ? channel.format : undefined,
    values,
  });
  const fontSize = spec.labels.fontSize ?? (horizontal ? 11 : 10);
  let maxWidth = 0;
  let maxHeight = fontSize * 1.2;
  let negativeWidth = 0;
  let positiveWidth = 0;
  let negative = false;
  let positive = false;
  for (const value of values) {
    const number = Number(value);
    const text = `${spec.labels.prefix ?? ''}${format(number)}${spec.labels.suffix ?? ''}`;
    const measured = options.measureText?.(text, fontSize, 600) ?? {
      width: estimateTextWidth(text, fontSize, 600),
      height: fontSize * 1.2,
    };
    maxWidth = Math.max(maxWidth, measured.width);
    maxHeight = Math.max(maxHeight, measured.height);
    if (number < 0) {
      negative = true;
      negativeWidth = Math.max(negativeWidth, measured.width);
    } else {
      positive = true;
      positiveWidth = Math.max(positiveWidth, measured.width);
    }
  }
  maxWidth = Math.max(maxWidth, options.columnWidth ?? 0);
  if (values.length === 0) return empty;
  const minWidth = options.minPlotWidth ?? 60;
  const minHeight = options.minPlotHeight ?? 60;
  const fits = (candidate: BarLabelPlan) =>
    options.availableWidth - candidate.reserveLeft - candidate.reserveRight >= minWidth &&
    (options.availableHeight === undefined ||
      options.availableHeight - candidate.reserveTop - candidate.reserveBottom >= minHeight) &&
    (options.plotHeightForPlan === undefined || options.plotHeightForPlan(candidate) >= minHeight);
  const column = {
    ...empty,
    placement: 'column' as const,
    reserveRight: maxWidth + 12,
    columnWidth: maxWidth,
  };
  if (requested === 'column' && fits(column)) return column;
  const outside = {
    ...empty,
    placement: 'outside' as const,
    reserveLeft: horizontal ? (negative ? negativeWidth + 6 : 0) : maxWidth / 2,
    reserveRight: horizontal ? (positive ? positiveWidth + 6 : 0) : maxWidth / 2,
    reserveTop: !horizontal && positive ? maxHeight + 8 : 0,
    reserveBottom: !horizontal && negative ? maxHeight + 8 : 0,
    ...(requested === 'column' ? { fallback: 'column-to-outside' as const } : {}),
  };
  return fits(outside)
    ? outside
    : { ...empty, placement: 'suppress', fallback: 'labels-suppressed' };
}

/** Keep axis text outside the value-label lane without changing scale/grid positions. */
export function offsetValueLabelAxes(
  axes: {
    x?: import('@opendata-ai/openchart-core').AxisLayout;
    y?: import('@opendata-ai/openchart-core').AxisLayout;
  },
  plan?: BarLabelPlan,
): void {
  if (!plan) return;
  if (axes.x && plan.reserveBottom > 0) {
    axes.x.start.y += plan.reserveBottom;
    axes.x.end.y += plan.reserveBottom;
    if (axes.x.titlePosition) axes.x.titlePosition.y += plan.reserveBottom;
  }
  if (axes.y && plan.reserveLeft > 0) {
    axes.y.start.x -= plan.reserveLeft;
    axes.y.end.x -= plan.reserveLeft;
    if (axes.y.titlePosition) axes.y.titlePosition.x -= plan.reserveLeft;
  }
}

export function emitValueLabelDiagnostic(
  plan: BarLabelPlan | undefined,
  options: Pick<
    import('@opendata-ai/openchart-core').CompileOptions,
    'width' | 'height' | 'onDiagnostic'
  >,
): void {
  if (!plan?.fallback) return;
  options.onDiagnostic?.({
    code: `layout.value-labels.${plan.fallback}`,
    severity: 'warning',
    status: 'failed',
    path: '/labels/placement',
    viewport: { width: options.width, height: options.height ?? 0 },
    origin: 'author',
    message:
      plan.fallback === 'column-to-outside'
        ? 'The value column cannot retain the minimum plot width; all values use outside placement.'
        : 'Value labels cannot fit while retaining the minimum plot size; values remain available in accessible data and tooltips.',
  });
}

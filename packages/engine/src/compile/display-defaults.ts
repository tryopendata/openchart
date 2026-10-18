/**
 * Display-mode defaults resolved before layout: sparkline visual defaults,
 * animation, crosshair, and the height-dependent watermark.
 *
 * Precedence everywhere: an explicit user value at any level (top-level or the
 * active breakpoint override) wins over a display-mode default.
 */

import type {
  AnimationSpec,
  CompileOptions,
  ResolvedAnimation,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import { getHeightClass } from '@opendata-ai/openchart-core';
import { resolveAnimation } from '../compiler/animation';
import {
  buildSparklineAreaGradient,
  computeTrendFromData,
  hasExplicitColor,
  trendColor,
} from '../compiler/sparkline-defaults';
import type { NormalizedChartSpec } from '../compiler/types';
import type { BreakpointOverride } from './breakpoint-overrides';

/** Sparkline line/area reveal duration when the author set none. */
const SPARK_DURATION = 1100;

/**
 * Inject sparkline-mode visual defaults that depend on the resolved theme.
 *
 * Trend-aware color (positive/negative/neutral), default endpoint dot,
 * default area gradient, and default pill cornerRadius for bars. Each
 * default backs off when the user has set the corresponding markDef
 * field. Bar marks do NOT get trend coloring — the design intent is a
 * single palette color across all bars.
 */
export function applySparklineDefaults(
  spec: NormalizedChartSpec,
  theme: ResolvedTheme,
): NormalizedChartSpec {
  const markType = spec.markType;
  const isLineFamily = markType === 'line' || markType === 'area';
  const isBar = markType === 'bar';
  if (!isLineFamily && !isBar) return spec;

  const yField = spec.encoding.y && 'field' in spec.encoding.y ? spec.encoding.y.field : undefined;
  const trend = computeTrendFromData(spec.data, yField);
  const color = trendColor(trend, theme);

  const encodingHasColor =
    !!spec.encoding.color && (spec.encoding.color as { field?: unknown }).field !== undefined;
  const explicit = hasExplicitColor(spec.markDef, encodingHasColor);

  const newMarkDef = { ...spec.markDef };

  if (isLineFamily) {
    if (!explicit.stroke) newMarkDef.stroke = color;
    if (markType === 'area' && !explicit.fill) {
      newMarkDef.fill = buildSparklineAreaGradient(color);
    }
    // Endpoint dot is wired in the line compute path. We skip the default
    // when the encoding has a color field, because the multi-series area
    // path (linesFromAreas()) ignores markDef.point — the dot would be set
    // on the spec but never rendered, and the line compute path's dot logic
    // is per-series, not "one dot for the chart."
    if (newMarkDef.point === undefined && !encodingHasColor) {
      newMarkDef.point = 'last';
    }
  }

  if (isBar) {
    // Pill cornerRadius is safe on stacked bars too — the column compute
    // path applies the radius only to the topmost segment via
    // `cornerRadiusSides`, leaving the seams between segments square so
    // they stay flush. Single-series bars get all four corners rounded
    // since there's nothing below them to align against.
    if (newMarkDef.cornerRadius === undefined) {
      newMarkDef.cornerRadius = 'pill';
    }
  }

  return { ...spec, markDef: newMarkDef };
}

/**
 * Sparkline mode: default labels off. Mark renderers draw value labels per
 * labels.density (default 'auto'), which fills tiny sparklines with text and
 * is never what you want. Explicit user labels at any level wins via
 * userExplicit.labels.
 */
export function applySparklineLabelDefault(chartSpec: NormalizedChartSpec): NormalizedChartSpec {
  if (chartSpec.display !== 'sparkline' || chartSpec.userExplicit.labels) return chartSpec;
  return { ...chartSpec, labels: { ...chartSpec.labels, density: 'none' } };
}

/**
 * Resolve the animation spec. The breakpoint override wins over the base spec
 * (matching chrome, labels, legend, and annotation override precedence).
 * Sparkline mode defaults animation off and, when it is on without a duration,
 * paces the line/area reveal at 1100ms (the CSS pairs it with an expo-out
 * easing curve).
 */
export function resolveChartAnimation(
  rawSpec: Record<string, unknown>,
  bp: BreakpointOverride | undefined,
  chartSpec: NormalizedChartSpec,
): ResolvedAnimation | undefined {
  let rawAnimationSpec = ((bp as Record<string, unknown> | undefined)?.animation ??
    rawSpec.animation) as AnimationSpec | undefined;
  if (rawAnimationSpec === undefined && chartSpec.display === 'sparkline') {
    // User-explicit (top OR bp) already short-circuits this branch.
    rawAnimationSpec = false;
  }
  // AnimationConfig nests duration under `enter`, so the default goes there.
  if (
    chartSpec.display === 'sparkline' &&
    rawAnimationSpec !== false &&
    rawAnimationSpec !== undefined
  ) {
    if (rawAnimationSpec === true) {
      rawAnimationSpec = { enter: { duration: SPARK_DURATION } } as AnimationSpec;
    } else if (typeof rawAnimationSpec === 'object') {
      const cfg = rawAnimationSpec as { enter?: unknown; annotationDelay?: number };
      const enter = cfg.enter;
      if (enter === undefined || enter === true) {
        rawAnimationSpec = {
          ...cfg,
          enter: { duration: SPARK_DURATION },
        } as AnimationSpec;
      } else if (
        typeof enter === 'object' &&
        enter !== null &&
        (enter as { duration?: number }).duration === undefined
      ) {
        rawAnimationSpec = {
          ...cfg,
          enter: { ...(enter as object), duration: SPARK_DURATION },
        } as AnimationSpec;
      }
    }
  }
  return resolveAnimation(rawAnimationSpec);
}

/**
 * Crosshair: explicit user value at any level wins. Default is ON for line
 * and area marks in full mode (the hover guideline + per-series tooltip is
 * the standard interaction pattern for time-series charts). Sparkline mode
 * defaults off. The value is plumbed through ChartLayout so the renderer
 * doesn't need to re-inspect the raw spec.
 */
export function resolveCrosshair(
  rawSpec: Record<string, unknown>,
  bp: BreakpointOverride | undefined,
  chartSpec: NormalizedChartSpec,
): boolean {
  const rawCrosshair = (bp?.crosshair ?? rawSpec.crosshair) as boolean | undefined;
  const isLineOrAreaMark = chartSpec.markType === 'line' || chartSpec.markType === 'area';
  const crosshairDefault = chartSpec.display === 'sparkline' ? false : isLineOrAreaMark;
  return chartSpec.userExplicit.crosshair ? rawCrosshair === true : crosshairDefault;
}

/**
 * Watermark at a given container height. It auto-hides in minimal and cramped
 * containers (height < 200px): there isn't room to spare for the brand band on
 * a tile that small, even though cramped (100-199px) now keeps a compact
 * title. Explicit user watermark at any level wins.
 */
export function watermarkResolver(
  baseWatermark: boolean,
  chartSpec: NormalizedChartSpec,
  options: CompileOptions,
): (height: number) => boolean {
  return (height) => {
    const heightClass = getHeightClass(height);
    return (heightClass === 'minimal' || heightClass === 'cramped') &&
      options.watermark === undefined &&
      !chartSpec.userExplicit.watermark
      ? false
      : baseWatermark;
  };
}

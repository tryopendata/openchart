/**
 * Continuous / binned color legend content computation.
 *
 * Resolves a quantitative color encoding into the geometry a gradient-bar
 * or binned-swatch legend needs: bar size, gradient stops or class swatches,
 * and formatted value labels. Everything here is bar-relative (origin at the
 * bar's left edge); `placeLegend` offsets into chart coordinates.
 *
 * Color resolution deliberately mirrors the mark path (`buildSequentialColorScale`
 * / `buildBinnedColorScale` in layout/scales.ts plus `applyColorScaleRange`):
 * an explicit `scale.range` wins, otherwise the theme's first sequential
 * palette applies. Because the sequential/diverging palettes are identical in
 * light and dark themes (only text/axis colors adapt), the legend matches the
 * dark-adapted mark ramp exactly with no extra work.
 */

import type {
  ContinuousLegendBin,
  ContinuousLegendTick,
  EncodingChannel,
  FieldFormatContext,
  GradientColorStop,
  ResolvedTheme,
} from '@opendata-ai/openchart-core';
import {
  computeFieldFormatContext,
  defaultNumberFormatter,
  resolveNumberFormatter,
} from '@opendata-ai/openchart-core';
import { scaleQuantile } from 'd3-scale';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Min/max over a numeric array via reduce, not `Math.min(...values)`. The spread
 * form passes every element as a function argument and throws a call-stack
 * RangeError once the array is large enough (a continuous-color field over a big
 * dataset), so the reduce keeps large color domains from crashing the legend.
 * Empty-array result matches the old `Math.min()`/`Math.max()` identity so the
 * `?? Math.min(...)` fallback callers keep their prior semantics.
 */
function extent(values: number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/** Height of the gradient bar / swatch row in pixels. */
export const CONTINUOUS_BAR_HEIGHT = 10;

/** Gap between the bar and the value label row. */
export const CONTINUOUS_LABEL_GAP = 4;

/** Preferred bar width bounds (FT/Datawrapper map-key convention). */
const BAR_WIDTH_MIN = 160;
const BAR_WIDTH_MAX = 220;

/** Default class count for quantile/quantize scales without an explicit range. */
export const DEFAULT_BIN_COUNT = 5;

/** Scale types that produce a binned swatch legend. */
const BINNED_SCALE_TYPES = new Set(['quantile', 'quantize', 'threshold']);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Pre-placement continuous legend content (bar-relative coordinates). */
export interface ContinuousLegendContent {
  /** Rendering mode, resolved from the color channel's scale type. */
  mode: 'gradient' | 'binned';
  /** Bar width in pixels. */
  barWidth: number;
  /** Bar height in pixels. */
  barHeight: number;
  /** Gradient color stops (empty in binned mode). */
  colorStops: GradientColorStop[];
  /** Class swatches with x relative to the bar's left edge (empty in gradient mode). */
  bins: ContinuousLegendBin[];
  /** Value labels with x relative to the bar's left edge. */
  ticks: ContinuousLegendTick[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sample `k` colors from a ramp, evenly spread by index. Returns the ramp
 * unchanged when it already has `k` stops. Shared by the mark color path
 * (applyColorScaleRange, buildBinnedColorScale) and the legend so class
 * colors can never drift between swatches and cells.
 */
export function sampleRampColors(colors: string[], k: number): string[] {
  if (k <= 0 || colors.length === 0) return [];
  if (colors.length === k) return [...colors];
  if (k === 1) return [colors[colors.length - 1]];
  const out: string[] = [];
  for (let i = 0; i < k; i++) {
    out.push(colors[Math.round((i * (colors.length - 1)) / (k - 1))]);
  }
  return out;
}

/** Numeric values of the color field, in data order. */
function numericFieldValues(spec: NormalizedChartSpec, field: string): number[] {
  const out: number[] = [];
  for (const row of spec.data) {
    const v = row[field];
    if (v == null) continue;
    const num = typeof v === 'number' ? v : Number(v);
    if (Number.isFinite(num)) out.push(num);
  }
  return out;
}

/** Format a legend value: channel format wins, then the house number style. */
function formatLegendValue(value: number, formatStr?: string, ctx?: FieldFormatContext): string {
  if (formatStr) {
    const fmt = resolveNumberFormatter(formatStr, ctx);
    if (fmt) return fmt(value);
  }
  return defaultNumberFormatter(ctx)(value);
}

/**
 * True when the resolved color list is one of the theme's diverging palettes
 * (e.g. `scale: { scheme: 'redBlue' }` after sugar expansion). Diverging ramps
 * get a midpoint label at the scale's center value.
 */
function isDivergingRamp(colors: string[], theme: ResolvedTheme): boolean {
  const norm = (stops: readonly string[]) => stops.map((c) => c.toLowerCase()).join('|');
  const key = norm(colors);
  // Match either direction: `scale: { reverse: true }` flips the stops, and a
  // reversed diverging ramp is still diverging -- it must keep its midpoint label.
  const flipped = norm([...colors].reverse());
  return Object.values(theme.colors.diverging).some((stops) => {
    const themeKey = norm(stops);
    return themeKey === key || themeKey === flipped;
  });
}

/**
 * Resolve the color list the marks will use, mirroring
 * `applyColorScaleRange`: explicit range wins, otherwise the theme's first
 * sequential palette (categorical endpoints as a last resort).
 */
function resolveRampColors(channel: EncodingChannel, theme: ResolvedTheme): string[] {
  const explicitRange = channel.scale?.range as string[] | undefined;
  if (explicitRange?.length) return explicitRange;
  return Object.values(theme.colors.sequential)[0] ?? theme.colors.categorical;
}

/** Clamp the bar width into the preferred band without exceeding available space. */
function resolveBarWidth(availableWidth: number): number {
  const preferred = Math.min(
    BAR_WIDTH_MAX,
    Math.max(BAR_WIDTH_MIN, Math.round(availableWidth * 0.4)),
  );
  return Math.max(0, Math.min(preferred, Math.floor(availableWidth)));
}

/** Class break values for a binned color scale, mirroring the mark scale. */
function resolveBinBreaks(channel: EncodingChannel, values: number[], binCount: number): number[] {
  const scaleType = channel.scale?.type;
  if (scaleType === 'threshold') {
    return (channel.scale?.domain as number[] | undefined) ?? [0.5];
  }
  if (scaleType === 'quantile') {
    const scale = scaleQuantile<number>()
      .domain(values)
      .range(Array.from({ length: binCount }, (_, i) => i));
    return scale.quantiles();
  }
  // quantize: evenly spaced breaks across the (possibly explicit) domain
  const explicitDomain = channel.scale?.domain as [number, number] | undefined;
  const [valuesMin, valuesMax] = extent(values);
  const domainMin = explicitDomain?.[0] ?? valuesMin;
  const domainMax = explicitDomain?.[1] ?? valuesMax;
  const breaks: number[] = [];
  for (let i = 1; i < binCount; i++) {
    breaks.push(domainMin + ((domainMax - domainMin) * i) / binCount);
  }
  return breaks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True when the spec's color channel resolves to a continuous/binned color scale. */
export function hasContinuousColorScale(spec: NormalizedChartSpec): boolean {
  const colorEnc = spec.encoding.color;
  if (!colorEnc || 'condition' in colorEnc || !('field' in colorEnc)) return false;
  return colorEnc.type === 'quantitative';
}

/**
 * Compute continuous legend content from raw numeric values and a color
 * channel config. Reusable by both chart specs and map specs.
 *
 * Label policy: min/max only for sequential ramps, min/neutral/max for
 * diverging ramps; binned scales get one boundary label per class break.
 *
 * @returns null when values is empty or bar width resolves to 0.
 */
export function computeContinuousLegendContentForChannel(
  values: number[],
  channel: EncodingChannel,
  theme: ResolvedTheme,
  availableWidth: number,
): ContinuousLegendContent | null {
  if (values.length === 0) return null;

  const barWidth = resolveBarWidth(availableWidth);
  if (barWidth <= 0) return null;

  const scaleType = channel.scale?.type;
  const rampColors = resolveRampColors(channel, theme);
  const formatStr = channel.format;
  const ctx = computeFieldFormatContext(values);

  if (scaleType && BINNED_SCALE_TYPES.has(scaleType)) {
    const explicitRange = channel.scale?.range as string[] | undefined;
    const binCount =
      scaleType === 'threshold'
        ? ((channel.scale?.domain as number[] | undefined) ?? [0.5]).length + 1
        : (explicitRange?.length ?? DEFAULT_BIN_COUNT);
    const breaks = resolveBinBreaks(channel, values, binCount);
    const colors = sampleRampColors(rampColors, binCount);
    const binWidth = barWidth / binCount;

    const bins: ContinuousLegendBin[] = colors.map((color, i) => ({
      x: i * binWidth,
      width: binWidth,
      color,
    }));
    const ticks: ContinuousLegendTick[] = breaks.map((value, i) => ({
      value,
      label: formatLegendValue(value, formatStr, ctx),
      x: (i + 1) * binWidth,
      anchor: 'middle' as const,
    }));

    return {
      mode: 'binned',
      barWidth,
      barHeight: CONTINUOUS_BAR_HEIGHT,
      colorStops: [],
      bins,
      ticks,
    };
  }

  // Gradient mode: sequential or diverging ramp.
  const [domainMin, domainMax] = extent(values);
  const explicitRange = channel.scale?.range as string[] | undefined;

  const stops =
    explicitRange && explicitRange.length > 2
      ? explicitRange
      : [rampColors[0], rampColors[rampColors.length - 1]];
  const colorStops: GradientColorStop[] = stops.map((color, i) => ({
    offset: stops.length > 1 ? i / (stops.length - 1) : 0,
    color,
  }));

  const ticks: ContinuousLegendTick[] = [
    {
      value: domainMin,
      label: formatLegendValue(domainMin, formatStr, ctx),
      x: 0,
      anchor: 'start' as const,
    },
  ];
  if (domainMax > domainMin) {
    if (isDivergingRamp(stops, theme)) {
      const neutral = (domainMin + domainMax) / 2;
      ticks.push({
        value: neutral,
        label: formatLegendValue(neutral, formatStr, ctx),
        x: barWidth / 2,
        anchor: 'middle' as const,
      });
    }
    ticks.push({
      value: domainMax,
      label: formatLegendValue(domainMax, formatStr, ctx),
      x: barWidth,
      anchor: 'end' as const,
    });
  }

  return {
    mode: 'gradient',
    barWidth,
    barHeight: CONTINUOUS_BAR_HEIGHT,
    colorStops,
    bins: [],
    ticks,
  };
}

/**
 * Compute continuous legend content from a spec's quantitative color encoding.
 * Thin wrapper around computeContinuousLegendContentForChannel.
 *
 * @returns null when the color encoding is not continuous or has no numeric data.
 */
export function computeContinuousLegendContent(
  spec: NormalizedChartSpec,
  theme: ResolvedTheme,
  availableWidth: number,
): ContinuousLegendContent | null {
  if (!hasContinuousColorScale(spec)) return null;
  const colorEnc = spec.encoding.color as EncodingChannel;
  const values = numericFieldValues(spec, colorEnc.field);
  return computeContinuousLegendContentForChannel(values, colorEnc, theme, availableWidth);
}

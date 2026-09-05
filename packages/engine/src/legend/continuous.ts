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
import { tickStep } from 'd3-array';
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

/** Height of the gradient bar in pixels. */
export const CONTINUOUS_BAR_HEIGHT = 10;

/**
 * Height of a binned swatch row. Taller than the gradient bar: a class swatch
 * is a color *sample* the reader compares against the map, and 10px of a
 * pale low class next to a hairline is not a sample.
 */
export const CONTINUOUS_BINNED_BAR_HEIGHT = 12;

/** Gap between the bar and the value label row. */
export const CONTINUOUS_LABEL_GAP = 4;

/** Preferred bar width bounds (FT/Datawrapper map-key convention). */
const BAR_WIDTH_MIN = 160;
const BAR_WIDTH_MAX = 220;

/** Default class count for quantile/quantize scales without an explicit range. */
export const DEFAULT_BIN_COUNT = 5;

/** Swatch edge, gap, and flanking-label gap for the compact `Less/More` key. */
export const COMPACT_SWATCH_SIZE = 11;
export const COMPACT_SWATCH_GAP = 2;
export const COMPACT_LABEL_GAP = 6;
const COMPACT_LESS_LABEL = 'Less';
const COMPACT_MORE_LABEL = 'More';

/** Scale types that produce a binned swatch legend. */
const BINNED_SCALE_TYPES = new Set(['quantile', 'quantize', 'threshold']);

/** Hard cap on classes, so a pathological domain/step pair can't spray swatches. */
const MAX_BINS = 12;

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
  /** The class scale the swatches were drawn from (binned mode only). */
  classScale?: ClassScale;
  /**
   * Bar x offset inside the legend block. Non-zero only for the compact
   * variant, where a "Less" label sits to the left of the first swatch.
   */
  barOffsetX?: number;
  /**
   * Label baseline offset from the bar's top edge. Defaults to the bar height
   * plus `CONTINUOUS_LABEL_GAP` (labels under the bar); the compact variant
   * centres its two labels on the swatch row instead.
   */
  labelBaselineOffset?: number;
  /** Which chart-area edge the block hangs off. Defaults to `'left'`. */
  align?: 'left' | 'right';
  /**
   * Total block width when it is wider than the bar (the compact variant's
   * flanking labels). Defaults to `barWidth`.
   */
  blockWidth?: number;
}

/**
 * A binned color scale shared by the marks and the legend.
 *
 * There is exactly one of these per binned color channel: the map's feature
 * fills and the legend's swatches both read it, so a swatch can never show a
 * color no feature has (which is what two independently-built `scaleQuantile`s
 * used to allow).
 */
export interface ClassScale {
  /** Ascending class breaks. One fewer than `colors`. */
  breaks: number[];
  /** One color per class, low to high. */
  colors: string[];
  /** Class index for a value, or -1 when the value is not finite. */
  binIndex(value: number): number;
  /** Class color for a value; the first color when the value is not finite. */
  color(value: number): string;
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

/** Trim binary-float noise off a computed break so labels read as round numbers. */
function tidyBreak(value: number): number {
  return Number(value.toPrecision(12));
}

/**
 * Evenly spaced breaks on ROUND numbers (the quantize default).
 *
 * `tickStep` picks the 1/2/5-times-a-power-of-ten step an axis would use, so
 * the class boundaries read as "20, 40, 60" rather than "17.4, 34.8, 52.2".
 * The class count therefore floats by one either way -- a nice break is worth
 * more to the reader than an exact class count.
 *
 * A diverging ramp over a domain that straddles zero is classed symmetrically
 * instead: an odd number of classes with the middle one centered on 0, so the
 * neutral color means "no change" rather than "somewhere near the middle".
 */
function niceQuantizeBreaks(
  domainMin: number,
  domainMax: number,
  binCount: number,
  diverging: boolean,
): number[] {
  if (!(domainMax > domainMin)) return [];

  if (diverging && domainMin < 0 && domainMax > 0) {
    const classes = binCount % 2 === 0 ? binCount + 1 : binCount;
    const perSide = (classes - 1) / 2;
    const magnitude = Math.max(Math.abs(domainMin), Math.abs(domainMax));
    const step = tickStep(0, magnitude, perSide + 0.5) || magnitude / (perSide + 0.5);
    if (!Number.isFinite(step) || step <= 0) return [];
    const breaks: number[] = [];
    for (let i = 0; i < perSide * 2; i++) {
      breaks.push(tidyBreak((i - perSide + 0.5) * step));
    }
    return breaks;
  }

  let step = tickStep(domainMin, domainMax, binCount);
  if (!Number.isFinite(step) || step <= 0) return [];

  // `tickStep` optimizes for tick spacing, not class count: on one domain it
  // hands back a step that yields four classes and on a slightly narrower one,
  // eight. Walk up the nice ladder (1 -> 2 -> 5 -> 10) until the classing fits
  // the count that was asked for, so a choropleth's key stays readable whatever
  // the data does.
  let breaks = quantizeBreaksForStep(domainMin, domainMax, step);
  for (let guard = 0; guard < 10 && breaks.length + 1 > binCount; guard++) {
    step = coarserNiceStep(step);
    breaks = quantizeBreaksForStep(domainMin, domainMax, step);
  }
  return breaks;
}

/** Interior multiples of `step` strictly inside (min, max). */
function quantizeBreaksForStep(domainMin: number, domainMax: number, step: number): number[] {
  const epsilon = step * 1e-9;
  const breaks: number[] = [];
  for (
    let b = Math.ceil(domainMin / step) * step;
    b < domainMax - epsilon && breaks.length < MAX_BINS;
    b += step
  ) {
    if (b > domainMin + epsilon) breaks.push(tidyBreak(b));
  }
  return breaks;
}

/** The next step up the 1 / 2 / 5 / 10 ladder. */
function coarserNiceStep(step: number): number {
  const power = Math.floor(Math.log10(step));
  const mantissa = step / 10 ** power;
  const next = mantissa < 1.5 ? 2 : mantissa < 3.5 ? 5 : 10;
  return tidyBreak(next * 10 ** power);
}

/** Class break values for a binned color scale, mirroring the mark scale. */
function resolveBinBreaks(
  channel: EncodingChannel,
  values: number[],
  binCount: number,
  diverging: boolean,
): number[] {
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
  // quantize (the default): evenly spaced, round breaks across the
  // (possibly explicit) domain.
  const explicitDomain = channel.scale?.domain as [number, number] | undefined;
  const [valuesMin, valuesMax] = extent(values);
  const domainMin = explicitDomain?.[0] ?? valuesMin;
  const domainMax = explicitDomain?.[1] ?? valuesMax;
  return niceQuantizeBreaks(domainMin, domainMax, binCount, diverging);
}

/** Class count a channel asks for: explicit range or threshold domain, else the default. */
function resolveBinCount(channel: EncodingChannel): number {
  if (channel.scale?.type === 'threshold') {
    return ((channel.scale?.domain as number[] | undefined) ?? [0.5]).length + 1;
  }
  const explicitRange = channel.scale?.range as string[] | undefined;
  return explicitRange?.length ?? DEFAULT_BIN_COUNT;
}

/**
 * Build the class scale for a binned color channel.
 *
 * `colors` is the ramp to sample class colors from; `binCount` is the class
 * count the channel asked for (the quantize path may return one class more or
 * fewer to land on round breaks).
 */
export function buildClassScale(
  values: number[],
  channel: EncodingChannel,
  colors: string[],
  binCount: number = DEFAULT_BIN_COUNT,
  options?: { diverging?: boolean },
): ClassScale {
  const breaks = resolveBinBreaks(channel, values, binCount, options?.diverging ?? false);
  const classColors = sampleRampColors(colors, breaks.length + 1);
  const binIndex = (value: number): number => {
    if (!Number.isFinite(value)) return -1;
    let i = 0;
    while (i < breaks.length && value >= breaks[i]) i++;
    return i;
  };
  return {
    breaks,
    colors: classColors,
    binIndex,
    color: (value: number) => classColors[Math.max(0, binIndex(value))] ?? classColors[0],
  };
}

/**
 * Build the class scale a channel resolves to against a theme: the ramp colors,
 * class count and diverging detection all come from the channel + theme, so
 * every caller (marks, legend) lands on the same scale from the same inputs.
 */
export function classScaleForChannel(
  values: number[],
  channel: EncodingChannel,
  theme: ResolvedTheme,
): ClassScale {
  const colors = resolveRampColors(channel, theme);
  return buildClassScale(values, channel, colors, resolveBinCount(channel), {
    diverging: isDivergingRamp(colors, theme),
  });
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
  classScale?: ClassScale,
): ContinuousLegendContent | null {
  if (values.length === 0) return null;

  const barWidth = resolveBarWidth(availableWidth);
  if (barWidth <= 0) return null;

  const scaleType = channel.scale?.type;
  const rampColors = resolveRampColors(channel, theme);
  const formatStr = channel.format;
  const ctx = computeFieldFormatContext(values);

  if (scaleType && BINNED_SCALE_TYPES.has(scaleType)) {
    // The marks' scale when the caller has one (maps build it first so the
    // swatches and the fills can never diverge), otherwise an identical one
    // built from the same channel + theme.
    const scale = classScale ?? classScaleForChannel(values, channel, theme);
    const colors = scale.colors;
    const binWidth = barWidth / colors.length;

    const bins: ContinuousLegendBin[] = colors.map((color, i) => ({
      x: i * binWidth,
      width: binWidth,
      color,
    }));
    const ticks: ContinuousLegendTick[] = scale.breaks.map((value, i) => ({
      value,
      label: formatLegendValue(value, formatStr, ctx),
      x: (i + 1) * binWidth,
      anchor: 'middle' as const,
    }));

    return {
      mode: 'binned',
      barWidth,
      barHeight: CONTINUOUS_BINNED_BAR_HEIGHT,
      colorStops: [],
      bins,
      ticks,
      classScale: scale,
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
 * Compact class key: `Less ▢▢▢▢▢ More`.
 *
 * The calendar variant. A day grid needs to say "darker is more" and nothing
 * else -- printing five break values under a contribution grid asks the reader
 * to do arithmetic they never wanted. Five small swatches with a word at each
 * end, tucked into the bottom-right corner the way GitHub draws it.
 */
export function computeCompactClassLegendContent(
  values: number[],
  channel: EncodingChannel,
  theme: ResolvedTheme,
  measure: (text: string, fontSize: number, fontWeight: number) => number,
): ContinuousLegendContent | null {
  if (values.length === 0) return null;

  // Diverging ramps are about sign, not magnitude: "Less/More" would describe
  // the wrong axis of the scale. Those fall back to the labelled class bar.
  if (isDivergingRamp(resolveRampColors(channel, theme), theme)) return null;

  const scale = classScaleForChannel(values, channel, theme);
  const colors = scale.colors;
  if (colors.length === 0) return null;

  const bins: ContinuousLegendBin[] = colors.map((color, i) => ({
    x: i * (COMPACT_SWATCH_SIZE + COMPACT_SWATCH_GAP),
    width: COMPACT_SWATCH_SIZE,
    color,
  }));
  const barWidth = colors.length * COMPACT_SWATCH_SIZE + (colors.length - 1) * COMPACT_SWATCH_GAP;

  const fontSize = theme.fonts.sizes.small;
  const fontWeight = theme.fonts.weights.normal;
  const lessWidth = measure(COMPACT_LESS_LABEL, fontSize, fontWeight);
  const moreWidth = measure(COMPACT_MORE_LABEL, fontSize, fontWeight);

  const [domainMin, domainMax] = extent(values);
  const ticks: ContinuousLegendTick[] = [
    {
      value: domainMin,
      label: COMPACT_LESS_LABEL,
      x: -COMPACT_LABEL_GAP,
      anchor: 'end' as const,
    },
    {
      value: domainMax,
      label: COMPACT_MORE_LABEL,
      x: barWidth + COMPACT_LABEL_GAP,
      anchor: 'start' as const,
    },
  ];

  return {
    mode: 'binned',
    barWidth,
    barHeight: COMPACT_SWATCH_SIZE,
    colorStops: [],
    bins,
    ticks,
    classScale: scale,
    barOffsetX: lessWidth + COMPACT_LABEL_GAP,
    // Optical centre of the cap height against the swatch row.
    labelBaselineOffset: COMPACT_SWATCH_SIZE / 2 + fontSize * 0.35,
    align: 'right',
    blockWidth: lessWidth + COMPACT_LABEL_GAP + barWidth + COMPACT_LABEL_GAP + moreWidth,
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

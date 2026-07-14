/**
 * Scale computation from encoding spec + data.
 *
 * Creates D3 scales that map data values to pixel positions.
 * Temporal -> scaleTime(), quantitative -> scaleLinear(),
 * nominal/ordinal -> scaleBand() or scaleOrdinal(), depending on context.
 */

import type {
  DataRow,
  Encoding,
  EncodingChannel,
  FieldFormatContext,
  Rect,
  ScaleType,
} from '@opendata-ai/openchart-core';
import { computeFieldFormatContext } from '@opendata-ai/openchart-core';
import { extent, max, min } from 'd3-array';
import type {
  ScaleBand,
  ScaleLinear,
  ScaleLogarithmic,
  ScaleOrdinal,
  ScalePoint,
  ScalePower,
  ScaleQuantile,
  ScaleQuantize,
  ScaleSymLog,
  ScaleThreshold,
  ScaleTime,
} from 'd3-scale';
import {
  scaleBand,
  scaleLinear,
  scaleLog,
  scaleOrdinal,
  scalePoint,
  scalePow,
  scaleQuantile,
  scaleQuantize,
  scaleSqrt,
  scaleSymlog,
  scaleThreshold,
  scaleTime,
  scaleUtc,
} from 'd3-scale';

import type { NormalizedChartSpec } from '../compiler/types';
import { DEFAULT_BIN_COUNT, sampleRampColors } from '../legend/continuous';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Continuous D3 scales (linear, time, log, pow, sqrt, symlog) that support .ticks() and .nice(). */
export type D3ContinuousScale =
  | ScaleLinear<number, number>
  | ScaleTime<number, number>
  | ScaleLogarithmic<number, number>
  | ScalePower<number, number>
  | ScaleSymLog<number, number>;

/** Discretizing D3 scales (quantile, quantize, threshold). */
export type D3DiscretizingScale =
  | ScaleQuantile<number>
  | ScaleQuantize<number>
  | ScaleThreshold<number, number>;

/** Categorical D3 scales (band, point, ordinal) that support .domain() as string[]. */
export type D3CategoricalScale =
  | ScaleBand<string>
  | ScalePoint<string>
  | ScaleOrdinal<string, string>;

/** Union of all D3 scale types used by the engine. */
export type D3Scale = D3ContinuousScale | D3CategoricalScale | D3DiscretizingScale;

/** A sequential color scale mapping numbers to color strings. */
export type D3SequentialColorScale = ScaleLinear<string, string>;

/** All resolved scale type identifiers. */
export type ResolvedScaleType = ScaleType | 'sequential';

/**
 * A resolved scale wrapping a d3 scale with type metadata.
 * We need to carry the scale type around so axes and marks know
 * how to interpret the domain/range. Consumers use the `type` discriminant
 * to determine which D3 methods are available on the scale.
 */
export interface ResolvedScale {
  /** The d3 scale function. Maps domain value -> pixel position or color. */
  scale: D3Scale;
  /** The scale type for downstream use. */
  type: ResolvedScaleType;
  /** The encoding channel this scale was derived from. */
  channel: EncodingChannel;
  /** Per-field formatting context (extent, allIntegers) from the ORIGINAL data. */
  formatContext?: FieldFormatContext;
}

/** All resolved scales for a chart. */
export interface ResolvedScales {
  x?: ResolvedScale;
  y?: ResolvedScale;
  color?: ResolvedScale;
  size?: ResolvedScale;
  /** Default color for single-series charts (first categorical palette color or markDef.fill gradient). */
  defaultColor?: string | import('@opendata-ai/openchart-core').GradientDef;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract all non-null values for a field from data. */
function fieldValues(data: DataRow[], field: string): unknown[] {
  return data.map((d) => d[field]).filter((v) => v != null);
}

/** Parse values to dates. */
function parseDates(values: unknown[]): Date[] {
  return values
    .map((v) => (v instanceof Date ? v : new Date(String(v))))
    .filter((d) => !Number.isNaN(d.getTime()));
}

/** Parse values to numbers. */
function parseNumbers(values: unknown[]): number[] {
  return values
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n) => Number.isFinite(n));
}

/** Get unique string values preserving order. */
function uniqueStrings(values: unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    const s = String(v);
    if (!seen.has(s)) {
      seen.add(s);
      result.push(s);
    }
  }
  return result;
}

/**
 * Apply sort order to categorical domain values.
 * - 'ascending': sort alphabetically/numerically ascending
 * - 'descending': sort descending
 * - null | undefined: preserve data order (no sorting)
 *
 * VL sort forms ('-y', value arrays, { field, op, order }) are resolved into
 * an explicit scale.domain by the pre-validation sugar expansion; any that
 * reach this point fall back to data order.
 */
export function applyCategoricalSort(values: string[], sort: EncodingChannel['sort']): string[] {
  if (sort !== 'ascending' && sort !== 'descending') return values;

  const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (sort === 'descending') sorted.reverse();
  return sorted;
}

// ---------------------------------------------------------------------------
// Helpers: apply common scale config
// ---------------------------------------------------------------------------

/** Apply clamp and reverse config to a continuous scale. */
function applyContinuousConfig(
  scale: { clamp(v: boolean): unknown; range(): number[]; range(r: number[]): unknown },
  channel: EncodingChannel,
): void {
  if (channel.scale?.clamp) {
    scale.clamp(true);
  }
  if (channel.scale?.reverse) {
    const [r0, r1] = scale.range() as number[];
    scale.range([r1, r0]);
  }
}

// ---------------------------------------------------------------------------
// Scale builders
// ---------------------------------------------------------------------------

function buildTimeScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseDates(fieldValues(data, channel.field));
  const domain = channel.scale?.domain
    ? [new Date(channel.scale.domain[0] as string), new Date(channel.scale.domain[1] as string)]
    : (extent(values) as [Date, Date]);

  const scale = scaleTime().domain(domain).range([rangeStart, rangeEnd]);

  // Temporal scales default to nice: false because date data typically starts
  // at clean boundaries and nice() rounds the domain outward, creating visible
  // gaps (e.g. data starting 2018-01-01 gets rounded to 2017-01-01).
  // Users can opt in with scale: { nice: true }.
  if (!channel.scale?.domain && channel.scale?.nice === true) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'time', channel };
}

function buildUtcScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseDates(fieldValues(data, channel.field));
  const domain = channel.scale?.domain
    ? [new Date(channel.scale.domain[0] as string), new Date(channel.scale.domain[1] as string)]
    : (extent(values) as [Date, Date]);

  const scale = scaleUtc().domain(domain).range([rangeStart, rangeEnd]);

  // Temporal scales default to nice: false (see buildTimeScale comment).
  if (!channel.scale?.domain && channel.scale?.nice === true) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'utc', channel };
}

function buildLinearScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));

  let domainMin: number;
  let domainMax: number;

  if (channel.scale?.domain) {
    const [d0, d1] = channel.scale.domain as [number, number];
    domainMin = d0;
    domainMax = d1;
  } else {
    domainMin = min(values) ?? 0;
    domainMax = max(values) ?? 1;

    // Include zero by default for quantitative scales
    if (channel.scale?.zero !== false) {
      domainMin = Math.min(0, domainMin);
      domainMax = Math.max(0, domainMax);
    }
  }

  const scale = scaleLinear().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

  if (!channel.scale?.domain && channel.scale?.nice !== false) {
    scale.nice();

    // nice() can round the domain min down to 0 even when zero: false.
    // Re-nice with more ticks to tighten the domain around the data range.
    if (channel.scale?.zero === false) {
      const [nicedMin, nicedMax] = scale.domain();
      if (nicedMin < domainMin || nicedMax > domainMax) {
        scale.domain([domainMin, domainMax]);
        scale.nice(20);
      }
    }
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'linear', channel };
}

function buildLogScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field)).filter((v) => v > 0);
  const domainMin = channel.scale?.domain
    ? (channel.scale.domain as [number, number])[0]
    : (min(values) ?? 1);
  const domainMax = channel.scale?.domain
    ? (channel.scale.domain as [number, number])[1]
    : (max(values) ?? 10);

  const scale = scaleLog().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

  if (channel.scale?.base !== undefined) {
    scale.base(channel.scale.base);
  }
  if (!channel.scale?.domain && channel.scale?.nice !== false) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'log', channel };
}

function buildPowScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));

  let domainMin: number;
  let domainMax: number;

  if (channel.scale?.domain) {
    [domainMin, domainMax] = channel.scale.domain as [number, number];
  } else {
    domainMin = min(values) ?? 0;
    domainMax = max(values) ?? 1;
    if (channel.scale?.zero !== false) {
      domainMin = Math.min(0, domainMin);
      domainMax = Math.max(0, domainMax);
    }
  }

  const scale = scalePow().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

  if (channel.scale?.exponent !== undefined) {
    scale.exponent(channel.scale.exponent);
  }
  if (!channel.scale?.domain && channel.scale?.nice !== false) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'pow', channel };
}

function buildSqrtScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));

  let domainMin: number;
  let domainMax: number;

  if (channel.scale?.domain) {
    [domainMin, domainMax] = channel.scale.domain as [number, number];
  } else {
    domainMin = min(values) ?? 0;
    domainMax = max(values) ?? 1;
    if (channel.scale?.zero !== false) {
      domainMin = Math.min(0, domainMin);
      domainMax = Math.max(0, domainMax);
    }
  }

  const scale = scaleSqrt().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

  if (!channel.scale?.domain && channel.scale?.nice !== false) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'sqrt', channel };
}

function buildSymlogScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));

  let domainMin: number;
  let domainMax: number;

  if (channel.scale?.domain) {
    [domainMin, domainMax] = channel.scale.domain as [number, number];
  } else {
    domainMin = min(values) ?? 0;
    domainMax = max(values) ?? 1;
    if (channel.scale?.zero !== false) {
      domainMin = Math.min(0, domainMin);
      domainMax = Math.max(0, domainMax);
    }
  }

  const scale = scaleSymlog().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]);

  if (channel.scale?.constant !== undefined) {
    scale.constant(channel.scale.constant);
  }
  if (!channel.scale?.domain && channel.scale?.nice !== false) {
    scale.nice();
  }
  applyContinuousConfig(scale, channel);

  return { scale, type: 'symlog', channel };
}

function buildQuantileScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));
  const range = channel.scale?.range
    ? (channel.scale.range as number[])
    : evenRange(rangeStart, rangeEnd, 4);

  const scale = scaleQuantile<number>().domain(values).range(range);

  return { scale: scale as unknown as D3Scale, type: 'quantile', channel };
}

function buildQuantizeScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));
  const domainMin = channel.scale?.domain
    ? (channel.scale.domain as [number, number])[0]
    : (min(values) ?? 0);
  const domainMax = channel.scale?.domain
    ? (channel.scale.domain as [number, number])[1]
    : (max(values) ?? 1);
  const range = channel.scale?.range
    ? (channel.scale.range as number[])
    : evenRange(rangeStart, rangeEnd, 4);

  const scale = scaleQuantize<number>().domain([domainMin, domainMax]).range(range);

  return { scale: scale as unknown as D3Scale, type: 'quantize', channel };
}

function buildThresholdScale(
  channel: EncodingChannel,
  _data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  // Threshold scales require explicit domain breakpoints
  const domainBreaks = channel.scale?.domain ? (channel.scale.domain as number[]) : [0.5];
  const range = channel.scale?.range
    ? (channel.scale.range as number[])
    : evenRange(rangeStart, rangeEnd, domainBreaks.length + 1);

  const scale = scaleThreshold<number, number>().domain(domainBreaks).range(range);

  return { scale: scale as unknown as D3Scale, type: 'threshold', channel };
}

/** Generate an evenly-spaced range of `count` values between start and end. */
function evenRange(start: number, end: number, count: number): number[] {
  if (count <= 1) return [start];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + step * i);
}

/**
 * Estimate d3 scaleBand bandwidth for a given plot width and category count,
 * mirroring buildBandScale's padding resolution. d3 sets both paddingInner and
 * paddingOuter to `padding`, then paddingInner/paddingOuter overrides adjust
 * each independently. step = width / (n - paddingInner + 2*paddingOuter);
 * bandwidth = step * (1 - paddingInner).
 */
/** d3 scaleBand padding resolution: `padding` sets both, overrides win. */
function resolveBandPadding(scaleConfig: EncodingChannel['scale'] | undefined): {
  paddingInner: number;
  paddingOuter: number;
} {
  const padding = scaleConfig?.padding ?? 0.35;
  return {
    paddingInner: scaleConfig?.paddingInner ?? padding,
    paddingOuter: scaleConfig?.paddingOuter ?? padding,
  };
}

export function estimateBandwidth(
  scaleConfig: EncodingChannel['scale'] | undefined,
  plotWidth: number,
  n: number,
): number {
  const { paddingInner } = resolveBandPadding(scaleConfig);
  return estimateBandStep(scaleConfig, plotWidth, n) * (1 - paddingInner);
}

/**
 * Estimate d3 scaleBand step (center-to-center band distance) for a given
 * plot width and category count, using the same padding resolution as
 * estimateBandwidth. The step — not the bandwidth — is the anchor spacing
 * that drives rotated-label collision checks.
 */
export function estimateBandStep(
  scaleConfig: EncodingChannel['scale'] | undefined,
  plotWidth: number,
  n: number,
): number {
  if (n <= 0) return 0;
  const { paddingInner, paddingOuter } = resolveBandPadding(scaleConfig);
  const denom = n - paddingInner + 2 * paddingOuter;
  if (denom <= 0) return 0;
  return plotWidth / denom;
}

/**
 * Gap between bands, as a fraction of the step. The 0.35 default is a *bar*
 * value: bars need air between them to read as separate quantities. Heatmap
 * cells are the opposite -- they tile, and the gap is a hairline gutter that
 * only exists to keep adjacent fills from bleeding into each other.
 */
const DEFAULT_BAND_PADDING = 0.35;
const HEATMAP_BAND_PADDING = 0.04;

function buildBandScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
  defaultPadding: number = DEFAULT_BAND_PADDING,
): ResolvedScale {
  const values = channel.scale?.domain
    ? (channel.scale.domain as string[])
    : applyCategoricalSort(uniqueStrings(fieldValues(data, channel.field)), channel.sort);

  const padding = channel.scale?.padding ?? defaultPadding;
  const scale = scaleBand().domain(values).range([rangeStart, rangeEnd]).padding(padding);

  if (channel.scale?.paddingInner !== undefined) {
    scale.paddingInner(channel.scale.paddingInner);
  }
  if (channel.scale?.paddingOuter !== undefined) {
    scale.paddingOuter(channel.scale.paddingOuter);
  }
  if (channel.scale?.reverse) {
    const [r0, r1] = scale.range();
    scale.range([r1, r0]);
  }

  return { scale, type: 'band', channel };
}

function buildPointScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = channel.scale?.domain
    ? (channel.scale.domain as string[])
    : applyCategoricalSort(uniqueStrings(fieldValues(data, channel.field)), channel.sort);

  // Point scales have a single padding knob (outer padding only -- there are no
  // bands, so paddingInner is meaningless). Accept `paddingOuter` as an alias so
  // a spec written for a band scale doesn't silently no-op when the mark is a
  // line; explicit `padding` wins if both are set.
  const padding = channel.scale?.padding ?? channel.scale?.paddingOuter ?? 0.5;
  const scale = scalePoint().domain(values).range([rangeStart, rangeEnd]).padding(padding);

  if (channel.scale?.reverse) {
    const [r0, r1] = scale.range();
    scale.range([r1, r0]);
  }

  return { scale, type: 'point', channel };
}

function buildOrdinalColorScale(
  channel: EncodingChannel,
  data: DataRow[],
  palette: string[],
): ResolvedScale {
  // Use explicit domain if provided, otherwise derive from data
  const explicitDomain = channel.scale?.domain as string[] | undefined;
  const values = explicitDomain
    ? explicitDomain.map(String)
    : applyCategoricalSort(uniqueStrings(fieldValues(data, channel.field)), channel.sort);

  // Use explicit range if provided, otherwise fall back to theme palette
  const explicitRange = channel.scale?.range as string[] | undefined;
  const colors = explicitRange ?? palette;

  const scale = scaleOrdinal<string>().domain(values).range(colors);

  return { scale, type: 'ordinal', channel };
}

function buildSequentialColorScale(
  channel: EncodingChannel,
  data: DataRow[],
  palette: string[],
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));
  const domainMin = min(values) ?? 0;
  const domainMax = max(values) ?? 1;

  // Use explicit range if provided, otherwise fall back to theme palette endpoints
  const explicitRange = channel.scale?.range as string[] | undefined;
  const colors = explicitRange ?? palette;

  // Explicit multi-stop ranges (e.g. a diverging scheme) interpolate piecewise
  // through every stop, with evenly-spaced domain pivots to match. Without an
  // explicit range the endpoints-only form is kept so applyColorScaleRange can
  // swap in the theme ramp endpoints post-hoc.
  const stops =
    explicitRange && explicitRange.length > 2
      ? explicitRange
      : [colors[0], colors[colors.length - 1]];
  const domain =
    stops.length > 2
      ? stops.map((_, i) => domainMin + ((domainMax - domainMin) * i) / (stops.length - 1))
      : [domainMin, domainMax];

  const scale = scaleLinear<string>().domain(domain).range(stops).clamp(true);

  // Cast: sequential color scale (number -> string) is structurally incompatible
  // with D3Scale (number -> number), but is only ever accessed via scales.color
  // where consumers already cast appropriately.
  return { scale: scale as unknown as D3Scale, type: 'sequential', channel };
}

/**
 * Build a binned color scale (quantile/quantize/threshold) for a quantitative
 * color encoding with an explicit `scale.type`. The range holds colors: an
 * explicit `scale.range` wins; otherwise a placeholder sampled from the
 * default palette that `applyColorScaleRange` replaces with the theme's
 * sequential ramp.
 */
function buildBinnedColorScale(
  channel: EncodingChannel,
  data: DataRow[],
  palette: string[],
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field));
  const explicitRange = channel.scale?.range as string[] | undefined;
  const scaleType = channel.scale?.type as 'quantile' | 'quantize' | 'threshold';

  if (scaleType === 'threshold') {
    // Threshold scales require explicit domain breakpoints; colors = breaks + 1.
    const breaks = (channel.scale?.domain as number[] | undefined) ?? [0.5];
    const colors = sampleRampColors(explicitRange ?? palette, breaks.length + 1);
    const scale = scaleThreshold<number, string>().domain(breaks).range(colors);
    return { scale: scale as unknown as D3Scale, type: 'threshold', channel };
  }

  const binCount = explicitRange?.length ?? DEFAULT_BIN_COUNT;
  const colors = explicitRange ?? sampleRampColors(palette, binCount);

  if (scaleType === 'quantile') {
    const scale = scaleQuantile<string>().domain(values).range(colors);
    return { scale: scale as unknown as D3Scale, type: 'quantile', channel };
  }

  const explicitDomain = channel.scale?.domain as [number, number] | undefined;
  const domainMin = explicitDomain?.[0] ?? min(values) ?? 0;
  const domainMax = explicitDomain?.[1] ?? max(values) ?? 1;
  const scale = scaleQuantize<string>().domain([domainMin, domainMax]).range(colors);
  return { scale: scale as unknown as D3Scale, type: 'quantize', channel };
}

// ---------------------------------------------------------------------------
// Positional scale selection
// ---------------------------------------------------------------------------

/**
 * Choose the right scale type for a positional channel (x or y).
 * Respects explicit scale.type overrides from the spec.
 */
function buildPositionalScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
  chartType: string,
  axis: 'x' | 'y',
): ResolvedScale {
  // Explicit scale type override
  if (channel.scale?.type) {
    switch (channel.scale.type) {
      case 'time':
        return buildTimeScale(channel, data, rangeStart, rangeEnd);
      case 'utc':
        return buildUtcScale(channel, data, rangeStart, rangeEnd);
      case 'linear':
        return buildLinearScale(channel, data, rangeStart, rangeEnd);
      case 'log':
        return buildLogScale(channel, data, rangeStart, rangeEnd);
      case 'pow':
        return buildPowScale(channel, data, rangeStart, rangeEnd);
      case 'sqrt':
        return buildSqrtScale(channel, data, rangeStart, rangeEnd);
      case 'symlog':
        return buildSymlogScale(channel, data, rangeStart, rangeEnd);
      case 'quantile':
        return buildQuantileScale(channel, data, rangeStart, rangeEnd);
      case 'quantize':
        return buildQuantizeScale(channel, data, rangeStart, rangeEnd);
      case 'threshold':
        return buildThresholdScale(channel, data, rangeStart, rangeEnd);
      case 'band':
        return buildBandScale(channel, data, rangeStart, rangeEnd);
      case 'point':
        return buildPointScale(channel, data, rangeStart, rangeEnd);
      case 'ordinal':
        return buildBandScale(channel, data, rangeStart, rangeEnd);
    }
  }

  // Infer from field type
  switch (channel.type) {
    case 'temporal':
      return buildTimeScale(channel, data, rangeStart, rangeEnd);
    case 'quantitative':
      return buildLinearScale(channel, data, rangeStart, rangeEnd);
    case 'nominal':
    case 'ordinal':
      // Bar and range charts use band scales for their categorical axis (both
      // orientations). Beeswarm lanes are band scales too: each category gets
      // a band whose center anchors one swarm, on whichever axis carries the
      // nominal channel.
      //
      // `rect` is the only mark that needs a band on *both* axes: a heatmap cell
      // is sized by the bandwidth of each axis, so it takes no `axis` guard. A
      // point scale would give it zero width and height (and it did: `rect` cells
      // rendered as invisible zero-area marks). It also tiles, so it takes the
      // hairline gutter rather than the bar-sized gap.
      if (chartType === 'rect') {
        return buildBandScale(channel, data, rangeStart, rangeEnd, HEATMAP_BAND_PADDING);
      }
      if (
        chartType === 'bar' ||
        chartType === 'beeswarm' ||
        chartType === 'range' ||
        ((chartType === 'circle' || chartType === 'lollipop') && axis === 'y')
      ) {
        return buildBandScale(channel, data, rangeStart, rangeEnd);
      }
      return buildPointScale(channel, data, rangeStart, rangeEnd);
    default:
      return buildLinearScale(channel, data, rangeStart, rangeEnd);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute D3 scales from encoding channels and data.
 *
 * @param spec - Normalized chart spec.
 * @param chartArea - The computed chart drawing area.
 * @param data - Data rows.
 * @returns ResolvedScales with d3 scale instances.
 */
export function computeScales(
  spec: NormalizedChartSpec,
  chartArea: Rect,
  data: DataRow[],
): ResolvedScales {
  const result: ResolvedScales = {};
  const encoding = spec.encoding as Encoding;

  // Marks that encode position (not length) default to zero: false so the
  // domain fits the data range. Line charts show trends — anchoring at zero
  // wastes space. Scatter/beeswarm encode raw observations whose spread is
  // the story. Text marks must match the point layer they label.
  if (
    spec.markType === 'point' ||
    spec.markType === 'line' ||
    spec.markType === 'beeswarm' ||
    spec.markType === 'range' ||
    spec.markType === 'text'
  ) {
    if (encoding.x?.type === 'quantitative' && encoding.x.scale?.zero === undefined) {
      if (!encoding.x.scale) {
        (encoding.x as { scale?: Record<string, unknown> }).scale = { zero: false };
      } else {
        (encoding.x.scale as Record<string, unknown>).zero = false;
      }
    }
    if (encoding.y?.type === 'quantitative' && encoding.y.scale?.zero === undefined) {
      if (!encoding.y.scale) {
        (encoding.y as { scale?: Record<string, unknown> }).scale = { zero: false };
      } else {
        (encoding.y.scale as Record<string, unknown>).zero = false;
      }
    }
  }

  if (encoding.x) {
    // For stacked bars, the x-domain needs the max category sum, not max individual value.
    // Without this, stacked bars would clip past the chart area.
    let xData = data;
    let xChannel = encoding.x;
    // Range charts span x to x2: the x-domain must cover both endpoint fields.
    // Synthetic rows map x2 values into the x field so buildLinearScale sees them.
    if (spec.markType === 'range' && encoding.x2 && encoding.x.type === 'quantitative') {
      const xField = encoding.x.field;
      const x2Field = encoding.x2.field;
      xData = [...data, ...data.map((row) => ({ [xField]: row[x2Field] }) as DataRow)];
    }
    const xStackEnabled =
      encoding.x.stack === true ||
      encoding.x.stack === 'zero' ||
      encoding.x.stack === 'normalize' ||
      encoding.x.stack === 'center';
    if (
      spec.markType === 'bar' &&
      encoding.color &&
      encoding.x.type === 'quantitative' &&
      xStackEnabled
    ) {
      if (encoding.x.stack === 'normalize') {
        // Normalize: domain is [0, 1], default to percentage axis
        const existingAxis = encoding.x.axis;
        const axis =
          existingAxis === false || existingAxis?.format
            ? existingAxis
            : { ...(typeof existingAxis === 'object' ? existingAxis : {}), format: '.0%' };
        xChannel = {
          ...encoding.x,
          scale: { ...encoding.x.scale, domain: [0, 1], nice: false },
          axis,
        };
      } else if (encoding.x.stack === 'center') {
        // Center: compute max half-sum for symmetric domain
        const yField = encoding.y?.field;
        const xField = encoding.x.field;
        if (yField) {
          const sums = new Map<string, number>();
          for (const row of data) {
            const cat = String(row[yField] ?? '');
            const val = Number(row[xField] ?? 0);
            if (Number.isFinite(val) && val > 0) {
              sums.set(cat, (sums.get(cat) ?? 0) + val);
            }
          }
          const maxSum = Math.max(...sums.values(), 0);
          const half = maxSum / 2;
          xChannel = {
            ...encoding.x,
            scale: { ...encoding.x.scale, domain: [-half, half], zero: true },
          };
        }
      } else {
        // Zero (default): domain extends to max category sum
        const yField = encoding.y?.field;
        const xField = encoding.x.field;
        if (yField) {
          const sums = new Map<string, number>();
          for (const row of data) {
            const cat = String(row[yField] ?? '');
            const val = Number(row[xField] ?? 0);
            if (Number.isFinite(val) && val > 0) {
              sums.set(cat, (sums.get(cat) ?? 0) + val);
            }
          }
          const maxSum = Math.max(...sums.values(), 0);
          // Create a synthetic row with the max stack sum so buildLinearScale sees it
          xData = [...data, { [xField]: maxSum } as DataRow];
        }
      }
    }

    result.x = buildPositionalScale(
      xChannel,
      xData,
      chartArea.x,
      chartArea.x + chartArea.width,
      spec.markType,
      'x',
    );
    if (result.x && encoding.x.type === 'quantitative' && encoding.x.field) {
      result.x.formatContext = computeFieldFormatContext(data.map((r) => r[encoding.x!.field]));
    }
  }

  if (encoding.y) {
    // For stacked vertical bars and stacked areas, the y-domain needs the max
    // category sum, not the max individual value. Without this, stacked marks
    // would clip above the chart area.
    // Vertical bar = x is categorical and y is quantitative (old 'column' chart type).
    let yData = data;
    let yChannel = encoding.y;
    // Range charts span y to y2 (vertical form): cover both endpoint fields.
    if (spec.markType === 'range' && encoding.y2 && encoding.y.type === 'quantitative') {
      const yField = encoding.y.field;
      const y2Field = encoding.y2.field;
      yData = [...data, ...data.map((row) => ({ [yField]: row[y2Field] }) as DataRow)];
    }
    const isVerticalBar =
      spec.markType === 'bar' &&
      (encoding.x?.type === 'nominal' || encoding.x?.type === 'ordinal') &&
      encoding.y.type === 'quantitative';
    // Both bar and area require explicit opt-in for stacked domain expansion.
    const stackProp = encoding.y.stack;
    const isExplicitlyStacked =
      stackProp === true ||
      stackProp === 'zero' ||
      stackProp === 'normalize' ||
      stackProp === 'center';
    const isAreaStacked = spec.markType === 'area' && isExplicitlyStacked;
    const isBarStacked = isVerticalBar && isExplicitlyStacked;

    // Sparkline tightening: drop the default `zero: true` baseline so the
    // y-domain hugs the actual data range. Without this, a series with
    // values in the 4000s renders as a near-flat line because most of the
    // chart area gets reserved for the gap between zero and the data.
    //
    // Applies to:
    //   - Line / area sparklines (always — variation is the whole point)
    //   - Vertical bar sparklines, but ONLY when no real stacking is in
    //     play. Two ways to opt OUT of bar tightening:
    //       1. Real stacking — color/group encoding plus a non-disabled
    //          stack — needs the zero baseline to keep segment arithmetic
    //          summing.
    //       2. Any explicit `encoding.y.stack` value signals the user
    //          wants stack semantics even on a single series; respect that.
    const hasStackingGroup = isBarStacked && encoding.color !== undefined;
    const userRequestedStack = isExplicitlyStacked;
    const isLineOrArea = spec.markType === 'line' || spec.markType === 'area';
    const sparklineTightenBar =
      isVerticalBar && !hasStackingGroup && !userRequestedStack && !isAreaStacked;
    const sparklineTightenLineArea = isLineOrArea && !isAreaStacked;
    if (
      spec.display === 'sparkline' &&
      (sparklineTightenBar || sparklineTightenLineArea) &&
      encoding.y.type === 'quantitative' &&
      encoding.y.scale?.zero === undefined
    ) {
      yChannel = {
        ...encoding.y,
        scale: { ...encoding.y.scale, zero: false },
      };
    }
    if ((isBarStacked || isAreaStacked) && encoding.color && encoding.y.type === 'quantitative') {
      if (encoding.y.stack === 'normalize') {
        // Normalize: domain is [0, 1] (VL convention), default to percentage axis
        const existingAxis = encoding.y.axis;
        const axis =
          existingAxis === false || existingAxis?.format
            ? existingAxis
            : { ...(typeof existingAxis === 'object' ? existingAxis : {}), format: '.0%' };
        yChannel = {
          ...encoding.y,
          scale: { ...encoding.y.scale, domain: [0, 1], nice: false },
          axis,
        };
      } else if (encoding.y.stack === 'center') {
        // Center: compute max half-sum for symmetric domain
        const xField = encoding.x?.field;
        const yField = encoding.y.field;
        if (xField) {
          const sums = new Map<string, number>();
          for (const row of data) {
            const cat = String(row[xField] ?? '');
            const val = Number(row[yField] ?? 0);
            if (Number.isFinite(val) && val > 0) {
              sums.set(cat, (sums.get(cat) ?? 0) + val);
            }
          }
          const maxSum = Math.max(...sums.values(), 0);
          const half = maxSum / 2;
          yChannel = {
            ...encoding.y,
            scale: { ...encoding.y.scale, domain: [-half, half], zero: true },
          };
        }
      } else {
        // Zero (default): domain extends to max category sum
        const xField = encoding.x?.field;
        const yField = encoding.y.field;
        if (xField) {
          const sums = new Map<string, number>();
          for (const row of data) {
            const cat = String(row[xField] ?? '');
            const val = Number(row[yField] ?? 0);
            if (Number.isFinite(val) && val > 0) {
              sums.set(cat, (sums.get(cat) ?? 0) + val);
            }
          }
          const maxSum = Math.max(...sums.values(), 0);
          // Create a synthetic row with the max stack sum so buildLinearScale sees it
          yData = [...data, { [yField]: maxSum } as DataRow];
        }
      }
    }

    // Y axis: range is inverted (SVG y goes down, data y goes up)
    result.y = buildPositionalScale(
      yChannel,
      yData,
      chartArea.y + chartArea.height,
      chartArea.y,
      spec.markType,
      'y',
    );
    if (result.y && encoding.y.type === 'quantitative' && encoding.y.field) {
      result.y.formatContext = computeFieldFormatContext(data.map((r) => r[encoding.y!.field]));
    }
  }

  if (encoding.color) {
    const defaultPalette = [
      '#1b7fa3',
      '#c44e52',
      '#6a9f58',
      '#d47215',
      '#507e79',
      '#9a6a8d',
      '#c4636b',
      '#9c755f',
      '#a88f22',
      '#858078',
    ];

    // Only build color scales for field-based encodings, not conditional value defs
    if ('field' in encoding.color) {
      if (encoding.color.type === 'quantitative') {
        const colorScaleType = encoding.color.scale?.type;
        if (
          colorScaleType === 'quantile' ||
          colorScaleType === 'quantize' ||
          colorScaleType === 'threshold'
        ) {
          // Binned color scale: discrete classes for value-based coloring
          result.color = buildBinnedColorScale(encoding.color, data, defaultPalette);
        } else {
          // Sequential color scale for value-based coloring
          result.color = buildSequentialColorScale(encoding.color, data, defaultPalette);
        }
      } else {
        // Categorical color scale for nominal/ordinal grouping
        result.color = buildOrdinalColorScale(encoding.color, data, defaultPalette);
      }
    }
  }

  return result;
}

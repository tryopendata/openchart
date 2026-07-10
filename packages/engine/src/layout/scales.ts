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
  Rect,
  ScaleType,
} from '@opendata-ai/openchart-core';
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
 */
function applyCategoricalSort(
  values: string[],
  sort: 'ascending' | 'descending' | null | undefined,
): string[] {
  if (!sort) return values;

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

function buildBandScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = channel.scale?.domain
    ? (channel.scale.domain as string[])
    : applyCategoricalSort(uniqueStrings(fieldValues(data, channel.field)), channel.sort);

  const padding = channel.scale?.padding ?? 0.35;
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

  const scale = scaleLinear<string>()
    .domain([domainMin, domainMax])
    .range([colors[0], colors[colors.length - 1]])
    .clamp(true);

  // Cast: sequential color scale (number -> string) is structurally incompatible
  // with D3Scale (number -> number), but is only ever accessed via scales.color
  // where consumers already cast appropriately.
  return { scale: scale as unknown as D3Scale, type: 'sequential', channel };
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
      // Bar charts use band scales for their categorical axis (both orientations)
      if (
        chartType === 'bar' ||
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

  // Scatter/bubble charts should NOT include zero by default (tight domain fits data range)
  if (spec.markType === 'point') {
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
  }

  if (encoding.y) {
    // For stacked vertical bars and stacked areas, the y-domain needs the max
    // category sum, not the max individual value. Without this, stacked marks
    // would clip above the chart area.
    // Vertical bar = x is categorical and y is quantitative (old 'column' chart type).
    let yData = data;
    let yChannel = encoding.y;
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
        // Sequential color scale for value-based coloring
        result.color = buildSequentialColorScale(encoding.color, data, defaultPalette);
      } else {
        // Categorical color scale for nominal/ordinal grouping
        result.color = buildOrdinalColorScale(encoding.color, data, defaultPalette);
      }
    }
  }

  return result;
}

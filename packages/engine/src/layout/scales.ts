/**
 * Scale computation from encoding spec + data.
 *
 * Creates D3 scales that map data values to pixel positions.
 * Temporal -> scaleTime(), quantitative -> scaleLinear(),
 * nominal/ordinal -> scaleBand() or scaleOrdinal(), depending on context.
 */

import type { DataRow, Encoding, EncodingChannel, Rect } from '@opendata-ai/openchart-core';
import { extent, max, min } from 'd3-array';
import type {
  ScaleBand,
  ScaleLinear,
  ScaleLogarithmic,
  ScaleOrdinal,
  ScalePoint,
  ScaleTime,
} from 'd3-scale';
import { scaleBand, scaleLinear, scaleLog, scaleOrdinal, scalePoint, scaleTime } from 'd3-scale';

import type { NormalizedChartSpec } from '../compiler/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Continuous D3 scales (linear, time, log) that support .ticks() and .nice(). */
export type D3ContinuousScale =
  | ScaleLinear<number, number>
  | ScaleTime<number, number>
  | ScaleLogarithmic<number, number>;

/** Categorical D3 scales (band, point, ordinal) that support .domain() as string[]. */
export type D3CategoricalScale =
  | ScaleBand<string>
  | ScalePoint<string>
  | ScaleOrdinal<string, string>;

/** Union of all D3 scale types used by the engine. */
export type D3Scale = D3ContinuousScale | D3CategoricalScale;

/** A sequential color scale mapping numbers to color strings. */
export type D3SequentialColorScale = ScaleLinear<string, string>;

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
  type: 'linear' | 'time' | 'band' | 'ordinal' | 'point' | 'log' | 'sequential';
  /** The encoding channel this scale was derived from. */
  channel: EncodingChannel;
}

/** All resolved scales for a chart. */
export interface ResolvedScales {
  x?: ResolvedScale;
  y?: ResolvedScale;
  color?: ResolvedScale;
  size?: ResolvedScale;
  /** Default color for single-series charts (first categorical palette color). */
  defaultColor?: string;
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

  if (channel.scale?.nice !== false) {
    scale.nice();
  }

  return { scale, type: 'time', channel };
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

  if (channel.scale?.nice !== false) {
    scale.nice();
  }

  return { scale, type: 'linear', channel };
}

function buildLogScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = parseNumbers(fieldValues(data, channel.field)).filter((v) => v > 0);
  const domainMin = min(values) ?? 1;
  const domainMax = max(values) ?? 10;

  const scale = scaleLog().domain([domainMin, domainMax]).range([rangeStart, rangeEnd]).nice();

  return { scale, type: 'log', channel };
}

function buildBandScale(
  channel: EncodingChannel,
  data: DataRow[],
  rangeStart: number,
  rangeEnd: number,
): ResolvedScale {
  const values = channel.scale?.domain
    ? (channel.scale.domain as string[])
    : uniqueStrings(fieldValues(data, channel.field));

  const scale = scaleBand().domain(values).range([rangeStart, rangeEnd]).padding(0.35);

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
    : uniqueStrings(fieldValues(data, channel.field));

  const scale = scalePoint().domain(values).range([rangeStart, rangeEnd]).padding(0.5);

  return { scale, type: 'point', channel };
}

function buildOrdinalColorScale(
  channel: EncodingChannel,
  data: DataRow[],
  palette: string[],
): ResolvedScale {
  const values = uniqueStrings(fieldValues(data, channel.field));

  const scale = scaleOrdinal<string>().domain(values).range(palette);

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

  const scale = scaleLinear<string>()
    .domain([domainMin, domainMax])
    .range([palette[0], palette[palette.length - 1]])
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
      case 'linear':
        return buildLinearScale(channel, data, rangeStart, rangeEnd);
      case 'log':
        return buildLogScale(channel, data, rangeStart, rangeEnd);
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
      // Bar/column charts use band scales for their categorical axis
      if (
        (chartType === 'bar' && axis === 'y') ||
        (chartType === 'column' && axis === 'x') ||
        (chartType === 'dot' && axis === 'y')
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
  if (spec.type === 'scatter') {
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
    if (spec.type === 'bar' && encoding.color && encoding.x.type === 'quantitative') {
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

    result.x = buildPositionalScale(
      encoding.x,
      xData,
      chartArea.x,
      chartArea.x + chartArea.width,
      spec.type,
      'x',
    );
  }

  if (encoding.y) {
    // For stacked columns and stacked areas, the y-domain needs the max category
    // sum, not the max individual value. Without this, stacked marks would clip
    // above the chart area.
    let yData = data;
    if (
      (spec.type === 'column' || spec.type === 'area') &&
      encoding.color &&
      encoding.y.type === 'quantitative'
    ) {
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

    // Y axis: range is inverted (SVG y goes down, data y goes up)
    result.y = buildPositionalScale(
      encoding.y,
      yData,
      chartArea.y + chartArea.height,
      chartArea.y,
      spec.type,
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

    if (encoding.color.type === 'quantitative') {
      // Sequential color scale for value-based coloring
      result.color = buildSequentialColorScale(encoding.color, data, defaultPalette);
    } else {
      // Categorical color scale for nominal/ordinal grouping
      result.color = buildOrdinalColorScale(encoding.color, data, defaultPalette);
    }
  }

  return result;
}

/**
 * Sparkline default resolution.
 *
 * When `display: 'sparkline'` is set on a chart spec, the engine fills in
 * "smart" defaults so a minimal spec (mark + data + encoding) renders the
 * polished mock-quality output without manual color, gradient, or endpoint
 * configuration. Every default backs off when the user has set the
 * corresponding field explicitly.
 *
 * Two public helpers:
 * - {@link computeTrend} reads a value series and decides up/down/neutral
 *   using a least-squares slope with a relative deadband. Naive
 *   `last - first` would mislabel noisy series; this is more honest.
 * - {@link resolveSparklineFill} picks the trend color, respecting the
 *   precedence ladder: explicit `markDef.fill` > `encoding.color` >
 *   theme override > sparkline trend default.
 */

import type { DataRow, GradientDef, MarkDef, ResolvedTheme } from '@opendata-ai/openchart-core';

/** Trend classification for a single value series. */
export type Trend = 'up' | 'down' | 'neutral';

/**
 * Relative slope below this magnitude reads as "no meaningful trend" and
 * falls into the neutral bucket. 0.0005 = 0.05% of the series mean per step,
 * which means a 20-point series needs roughly a 1% net change to register
 * as a real trend. Tuned so financial sparklines (which often show 2-10%
 * swings) reliably pick up trend color, while heavy noise around a flat
 * mean still classifies as neutral.
 */
const TREND_DEADBAND = 0.0005;

/**
 * Decide whether a numeric series trends up, down, or neutral.
 *
 * Uses ordinary least-squares slope across the series, normalized by the
 * absolute mean so the deadband applies consistently to series of any
 * magnitude. Non-finite values are dropped before fitting; series with
 * fewer than two finite points return 'neutral'.
 */
export function computeTrend(values: readonly number[]): Trend {
  const finite: number[] = [];
  for (const v of values) {
    if (Number.isFinite(v)) finite.push(v);
  }
  if (finite.length < 2) return 'neutral';

  const n = finite.length;
  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += finite[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - meanX;
    num += dx * (finite[i] - meanY);
    den += dx * dx;
  }
  if (den === 0) return 'neutral';

  const slope = num / den;
  const scale = Math.abs(meanY) || 1;
  const relSlope = slope / scale;
  if (Math.abs(relSlope) < TREND_DEADBAND) return 'neutral';
  return relSlope > 0 ? 'up' : 'down';
}

/** Map a trend classification to a color from the resolved theme. */
export function trendColor(trend: Trend, theme: ResolvedTheme): string {
  if (trend === 'up') return theme.colors.positive;
  if (trend === 'down') return theme.colors.negative;
  return theme.colors.categorical[0];
}

/**
 * Pull the y-channel values out of a data array and classify the trend.
 * Returns 'neutral' if the field is missing or the series is too short.
 */
export function computeTrendFromData(data: readonly DataRow[], yField: string | undefined): Trend {
  if (!yField) return 'neutral';
  const values: number[] = [];
  for (const row of data) {
    const v = Number(row[yField]);
    if (Number.isFinite(v)) values.push(v);
  }
  return computeTrend(values);
}

/**
 * Channel-by-channel report of whether a spec's color is "user-explicit"
 * for that channel — the trend default backs off only for the channels
 * the user has set.
 *
 * Precedence ladder (most explicit first):
 * 1. `markDef.fill` / `markDef.stroke` set on the spec — channel-specific
 * 2. `encoding.color` field encoding (the data drives color, not trend)
 *    backs off both channels because the color scale produces both
 * 3. Sparkline trend default (returned when both flags are false)
 */
export function hasExplicitColor(
  markDef: MarkDef | undefined,
  encodingHasColor: boolean,
): { fill: boolean; stroke: boolean } {
  if (encodingHasColor) return { fill: true, stroke: true };
  return {
    fill: markDef?.fill !== undefined,
    stroke: markDef?.stroke !== undefined,
  };
}

/**
 * Build the default area gradient for a sparkline area mark. Uses the
 * trend-derived base color and fades top→bottom from 20% to 0% opacity.
 *
 * Coordinate system is normalized [0,1] relative to the mark bounding box,
 * matching the existing `LinearGradient` shape used by user-authored
 * gradients (see `examples/src/sparkline.stories.tsx` for prior art).
 */
export function buildSparklineAreaGradient(baseColor: string): GradientDef {
  return {
    gradient: 'linear',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 1,
    stops: [
      { offset: 0, color: baseColor, opacity: 0.2 },
      { offset: 1, color: baseColor, opacity: 0 },
    ],
  };
}

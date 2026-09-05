/**
 * Tests for sparkline default resolution.
 *
 * Focus: the trend signal must be honest about noisy series and short
 * series. Naive `last - first` would mislabel `[100, 50, 200, 60, 101]`
 * as up; a regression slope with deadband correctly reads it as neutral.
 */

import type { MarkDef, ResolvedTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import {
  buildSparklineAreaGradient,
  computeTrend,
  computeTrendFromData,
  hasExplicitColor,
  trendColor,
} from '../sparkline-defaults';

const baseTheme = {
  colors: {
    categorical: ['#1b7fa3', '#aaa'],
    positive: '#16a34a',
    negative: '#dc2626',
  },
} as unknown as ResolvedTheme;

describe('computeTrend', () => {
  it('classifies clear up-trend as "up"', () => {
    expect(computeTrend([1, 2, 3, 4, 5])).toBe('up');
  });

  it('classifies clear down-trend as "down"', () => {
    expect(computeTrend([5, 4, 3, 2, 1])).toBe('down');
  });

  it('classifies flat series as "neutral"', () => {
    expect(computeTrend([10, 10, 10, 10])).toBe('neutral');
  });

  it('classifies noisy non-monotonic series with no meaningful net trend as "neutral"', () => {
    // Symmetric oscillation around the mean — the regression slope works
    // out to (almost) zero. Naive `last - first` heuristics would classify
    // this incorrectly; the regression sees no net direction.
    // Palindromic series — mirrors around the midpoint, so the regression
    // slope is mathematically zero regardless of the noise amplitude.
    expect(computeTrend([100, 105, 95, 102, 95, 105, 100])).toBe('neutral');
  });

  it('classifies a real trend with noise as the net direction', () => {
    // ~10% net rise over 20 steps with realistic chop — should still read up.
    const series = [
      100, 102, 99, 103, 101, 104, 103, 106, 104, 107, 105, 108, 107, 109, 108, 110, 109, 111, 110,
      112,
    ];
    expect(computeTrend(series)).toBe('up');
  });

  it('returns "neutral" for empty series', () => {
    expect(computeTrend([])).toBe('neutral');
  });

  it('returns "neutral" for single-point series', () => {
    expect(computeTrend([42])).toBe('neutral');
  });

  it('returns "neutral" when all values are non-finite', () => {
    expect(computeTrend([NaN, NaN, Infinity])).toBe('neutral');
  });

  it('skips non-finite values and classifies remaining', () => {
    expect(computeTrend([NaN, 1, 2, 3, 4, NaN])).toBe('up');
  });

  it('treats very small relative slope as "neutral" (deadband)', () => {
    // Slope is real but tiny relative to the mean.
    expect(computeTrend([1000, 1000.5, 1001, 1001.2])).toBe('neutral');
  });
});

describe('computeTrendFromData', () => {
  it('reads y values from data rows', () => {
    const data = [
      { date: 'a', value: 1 },
      { date: 'b', value: 2 },
      { date: 'c', value: 3 },
    ];
    expect(computeTrendFromData(data, 'value')).toBe('up');
  });

  it('returns "neutral" when yField is missing', () => {
    expect(computeTrendFromData([{ a: 1 }, { a: 2 }], undefined)).toBe('neutral');
  });

  it('coerces string numbers and skips non-numeric values', () => {
    const data = [{ v: '5' }, { v: 'not a number' }, { v: '4' }, { v: '3' }];
    expect(computeTrendFromData(data, 'v')).toBe('down');
  });
});

describe('trendColor', () => {
  it('returns positive for up', () => {
    expect(trendColor('up', baseTheme)).toBe('#16a34a');
  });
  it('returns negative for down', () => {
    expect(trendColor('down', baseTheme)).toBe('#dc2626');
  });
  it('returns palette[0] for neutral', () => {
    expect(trendColor('neutral', baseTheme)).toBe('#1b7fa3');
  });
});

describe('hasExplicitColor', () => {
  it('returns both false when markDef has no fill/stroke and no color encoding', () => {
    expect(hasExplicitColor({ type: 'line' }, false)).toEqual({ fill: false, stroke: false });
  });
  it('returns fill=true when markDef.fill is set, leaves stroke false', () => {
    expect(hasExplicitColor({ type: 'line', fill: '#ff00ff' } as MarkDef, false)).toEqual({
      fill: true,
      stroke: false,
    });
  });
  it('returns stroke=true when markDef.stroke is set, leaves fill false', () => {
    expect(hasExplicitColor({ type: 'line', stroke: '#ff00ff' } as MarkDef, false)).toEqual({
      fill: false,
      stroke: true,
    });
  });
  it('returns both true when both markDef.fill and markDef.stroke are set', () => {
    expect(
      hasExplicitColor({ type: 'line', fill: '#ff00ff', stroke: '#00ffff' } as MarkDef, false),
    ).toEqual({ fill: true, stroke: true });
  });
  it('returns both true when encoding.color is present (color scale drives both)', () => {
    expect(hasExplicitColor({ type: 'line' }, true)).toEqual({ fill: true, stroke: true });
  });
});

describe('buildSparklineAreaGradient', () => {
  it('builds a top-to-bottom gradient with 0.2 -> 0 opacity in the trend color', () => {
    const grad = buildSparklineAreaGradient('#16a34a');
    expect(grad).toEqual({
      gradient: 'linear',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 1,
      stops: [
        { offset: 0, color: '#16a34a', opacity: 0.2 },
        { offset: 1, color: '#16a34a', opacity: 0 },
      ],
    });
  });
});

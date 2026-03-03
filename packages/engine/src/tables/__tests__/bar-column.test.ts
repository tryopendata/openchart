import type { BarColumnConfig } from '@opendata-ai/openchart-core';
import { resolveTheme } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeBarCell, computeColumnMax, computeColumnMin } from '../bar-column';

const theme = resolveTheme();

describe('computeBarCell', () => {
  it('computes correct percentage for mid-range value', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(50, config, 100, 0, theme, false);
    expect(result.barPercent).toBeCloseTo(0.5);
    expect(result.barOffset).toBe(0);
    expect(result.isNegative).toBe(false);
  });

  it('computes 100% for max value', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(100, config, 100, 0, theme, false);
    expect(result.barPercent).toBeCloseTo(1);
  });

  it('computes 0% for zero value', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(0, config, 100, 0, theme, false);
    expect(result.barPercent).toBeCloseTo(0);
  });

  it('uses config maxValue when provided', () => {
    const config: BarColumnConfig = { maxValue: 200 };
    const result = computeBarCell(100, config, 50, 0, theme, false);
    // Should use config maxValue (200), not columnMax (50)
    expect(result.barPercent).toBeCloseTo(0.5);
  });

  it('clamps negative values to 0 when column has no negatives', () => {
    const config: BarColumnConfig = {};
    // columnMin=0 means no negative values in the column
    const result = computeBarCell(-10, config, 100, 0, theme, false);
    expect(result.barPercent).toBe(0);
  });

  it('clamps values above max to 1', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(150, config, 100, 0, theme, false);
    expect(result.barPercent).toBe(1);
  });

  it('uses custom color from config', () => {
    const config: BarColumnConfig = { color: '#ff0000' };
    const result = computeBarCell(50, config, 100, 0, theme, false);
    expect(result.barColor).toBe('#ff0000');
  });

  it('defaults to first categorical palette color', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(50, config, 100, 0, theme, false);
    expect(result.barColor).toBe(theme.colors.categorical[0]);
  });

  it('handles NaN value', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(NaN, config, 100, 0, theme, false);
    expect(result.barPercent).toBe(0);
  });

  it('handles Infinity value', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(Infinity, config, 100, 0, theme, false);
    expect(result.barPercent).toBe(0);
  });

  it('handles zero columnMax', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(50, config, 0, 0, theme, false);
    expect(result.barPercent).toBe(0);
  });

  // Negative value support
  it('renders negative value as bidirectional bar', () => {
    const config: BarColumnConfig = {};
    // Column range: -20 to 80, totalRange = 100, zeroPos = 0.2
    const result = computeBarCell(-10, config, 80, -20, theme, false);
    expect(result.isNegative).toBe(true);
    expect(result.barPercent).toBeCloseTo(0.1); // 10/100
    expect(result.barOffset).toBeCloseTo(0.1); // zeroPos(0.2) - barPercent(0.1)
  });

  it('renders positive value with offset when column has negatives', () => {
    const config: BarColumnConfig = {};
    // Column range: -20 to 80, totalRange = 100, zeroPos = 0.2
    const result = computeBarCell(40, config, 80, -20, theme, false);
    expect(result.isNegative).toBe(false);
    expect(result.barPercent).toBeCloseTo(0.4); // 40/100
    expect(result.barOffset).toBeCloseTo(0.2); // zeroPos
  });

  it('uses red color for negative bars by default', () => {
    const config: BarColumnConfig = {};
    const result = computeBarCell(-10, config, 80, -20, theme, false);
    expect(result.isNegative).toBe(true);
    expect(result.barColor).toBe('#c44e52');
  });

  it('uses custom color for negative bars when config.color is set', () => {
    const config: BarColumnConfig = { color: '#ff0000' };
    const result = computeBarCell(-10, config, 80, -20, theme, false);
    expect(result.barColor).toBe('#ff0000');
  });
});

describe('computeColumnMax', () => {
  it('finds the max numeric value in a column', () => {
    const data = [{ value: 10 }, { value: 50 }, { value: 30 }];
    expect(computeColumnMax(data, 'value')).toBe(50);
  });

  it('ignores non-numeric values', () => {
    const data = [{ value: 10 }, { value: 'hello' }, { value: null }, { value: 30 }];
    expect(computeColumnMax(data, 'value')).toBe(30);
  });

  it('returns 0 for empty data', () => {
    expect(computeColumnMax([], 'value')).toBe(0);
  });

  it('returns 0 when all values are non-numeric', () => {
    const data = [{ value: 'a' }, { value: 'b' }];
    expect(computeColumnMax(data, 'value')).toBe(0);
  });
});

describe('computeColumnMin', () => {
  it('finds the min numeric value in a column', () => {
    const data = [{ value: 10 }, { value: -5 }, { value: 30 }];
    expect(computeColumnMin(data, 'value')).toBe(-5);
  });

  it('returns 0 for all-positive data', () => {
    const data = [{ value: 10 }, { value: 20 }];
    expect(computeColumnMin(data, 'value')).toBe(0);
  });

  it('returns 0 for empty data', () => {
    expect(computeColumnMin([], 'value')).toBe(0);
  });
});

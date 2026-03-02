import type { SparklineColumnConfig } from '@opendata-ai/core';
import { resolveTheme } from '@opendata-ai/core';
import { describe, expect, it } from 'vitest';
import { computeSparkline, computeSparklineForRow } from '../sparkline';

const theme = resolveTheme();

describe('computeSparkline', () => {
  it('normalizes line points to 0-1 range', () => {
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparkline([10, 20, 30, 40, 50], config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('line');
    expect(result!.points).toHaveLength(5);

    // First point at min should be y=0, last at max should be y=1
    expect(result!.points[0].y).toBeCloseTo(0);
    expect(result!.points[4].y).toBeCloseTo(1);

    // X values evenly distributed
    expect(result!.points[0].x).toBeCloseTo(0);
    expect(result!.points[4].x).toBeCloseTo(1);
  });

  it('produces bar data for bar type', () => {
    const config: SparklineColumnConfig = { type: 'bar' };
    const result = computeSparkline([0, 50, 100], config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('bar');
    expect(result!.bars).toHaveLength(3);

    // Normalized: 0->0, 50->0.5, 100->1
    expect(result!.bars[0]).toBeCloseTo(0);
    expect(result!.bars[1]).toBeCloseTo(0.5);
    expect(result!.bars[2]).toBeCloseTo(1);
  });

  it('produces column data for column type', () => {
    const config: SparklineColumnConfig = { type: 'column' };
    const result = computeSparkline([10, 20, 30], config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.type).toBe('column');
    expect(result!.bars).toHaveLength(3);
  });

  it('returns null for empty values', () => {
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparkline([], config, theme, false);
    expect(result).toBeNull();
  });

  it('handles all equal values (flat line)', () => {
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparkline([5, 5, 5], config, theme, false);

    expect(result).not.toBeNull();
    // When range is 0, all y values should be 0.5
    expect(result!.points[0].y).toBeCloseTo(0.5);
    expect(result!.points[1].y).toBeCloseTo(0.5);
  });

  it('handles single value', () => {
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparkline([42], config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.points).toHaveLength(1);
    expect(result!.points[0].x).toBeCloseTo(0.5);
    expect(result!.points[0].y).toBeCloseTo(0.5);
  });

  it('uses custom color from config', () => {
    const config: SparklineColumnConfig = { type: 'line', color: '#ff0000' };
    const result = computeSparkline([1, 2, 3], config, theme, false);
    expect(result!.color).toBe('#ff0000');
  });

  it('defaults to first categorical palette color', () => {
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparkline([1, 2, 3], config, theme, false);
    expect(result!.color).toBe(theme.colors.categorical[0]);
  });
});

describe('computeSparklineForRow', () => {
  it('extracts values from array field', () => {
    const row = { trend: [10, 20, 30] };
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparklineForRow(row, 'trend', config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
  });

  it('uses valuesField to extract from different field', () => {
    const row = { label: 'Test', data: [5, 15, 25] };
    const config: SparklineColumnConfig = { type: 'line', valuesField: 'data' };
    const result = computeSparklineForRow(row, 'label', config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(3);
  });

  it('returns null when field value is not an array', () => {
    const row = { trend: 'not an array' };
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparklineForRow(row, 'trend', config, theme, false);
    expect(result).toBeNull();
  });

  it('filters out non-numeric values from array', () => {
    const row = { trend: [10, 'bad', null, 30] };
    const config: SparklineColumnConfig = { type: 'line' };
    const result = computeSparklineForRow(row, 'trend', config, theme, false);

    expect(result).not.toBeNull();
    expect(result!.count).toBe(2); // only 10 and 30
  });
});

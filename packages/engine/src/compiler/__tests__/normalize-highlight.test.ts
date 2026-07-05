import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compile } from '../index';
import { normalizeSpec } from '../normalize';
import type { NormalizedChartSpec } from '../types';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const data = [
  { date: '2020', country: 'Germany', value: 100 },
  { date: '2020', country: 'France', value: 90 },
  { date: '2020', country: 'Italy', value: 80 },
  { date: '2021', country: 'Germany', value: 110 },
  { date: '2021', country: 'France', value: 95 },
  { date: '2021', country: 'Italy', value: 85 },
];

function makeSpec(highlight?: string | string[]): ChartSpec {
  const colorChannel: Record<string, unknown> = {
    field: 'country',
    type: 'nominal',
  };
  if (highlight !== undefined) {
    colorChannel.highlight = highlight;
  }
  return {
    mark: 'line',
    data,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: colorChannel,
    },
  } as ChartSpec;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('normalizeSpec — highlight', () => {
  it('normalizes a single string highlight to an array', () => {
    const result = normalizeSpec(makeSpec('Germany')) as NormalizedChartSpec;
    expect(result.highlight).toEqual(['Germany']);
  });

  it('preserves an array highlight as-is', () => {
    const result = normalizeSpec(makeSpec(['Germany', 'France'])) as NormalizedChartSpec;
    expect(result.highlight).toEqual(['Germany', 'France']);
  });

  it('defaults to an empty array when no highlight is specified', () => {
    const result = normalizeSpec(makeSpec()) as NormalizedChartSpec;
    expect(result.highlight).toEqual([]);
  });

  it('defaults to an empty array when there is no color encoding', () => {
    const spec: ChartSpec = {
      mark: 'line',
      data,
      encoding: {
        x: { field: 'date', type: 'temporal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };
    const result = normalizeSpec(spec) as NormalizedChartSpec;
    expect(result.highlight).toEqual([]);
  });

  it('warns when a highlight value does not appear in data', () => {
    const { warnings } = compile(makeSpec(['Spain']));
    const highlightWarning = warnings.find((w) => w.includes('Spain') && w.includes('highlight'));
    expect(highlightWarning).toBeDefined();
  });

  it('does not warn when all highlight values appear in data', () => {
    const { warnings } = compile(makeSpec(['Germany', 'France']));
    const highlightWarning = warnings.find((w) => w.includes('highlight'));
    expect(highlightWarning).toBeUndefined();
  });
});

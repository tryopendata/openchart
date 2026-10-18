import { describe, expect, it } from 'vitest';
import type { NormalizedChartSpec } from '../../compiler/types';
import { endpointSourceRows } from '../source';

function input(data: Record<string, unknown>[]): NormalizedChartSpec {
  return {
    markType: 'area',
    data,
    encoding: {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'value', type: 'quantitative' },
      color: { field: 'series', type: 'nominal' },
    },
  } as NormalizedChartSpec;
}

describe('endpoint source rows agree with compiled stack presence', () => {
  it('uses the area pivot key for equal dates represented by distinct objects', () => {
    const rows = endpointSourceRows(
      input([
        { date: new Date('2020-01-01'), value: 5, series: 'A' },
        { date: new Date('2020-01-01'), value: 10, series: 'B' },
        { date: new Date('2021-01-01'), value: 0.17, series: 'A' },
        { date: new Date('2021-01-01'), value: null, series: 'B' },
      ]),
    );
    expect(rows.get('A')?.map((row) => row.value)).toEqual([5]);
    expect(rows.get('B')?.map((row) => row.value)).toEqual([10]);
  });
  it('does not reserve endpoint strings for invalid or missing x observations', () => {
    const rows = endpointSourceRows(
      input([
        { date: '2020-01-01', value: 5, series: 'A' },
        { date: new Date('invalid'), value: 100000, series: 'A' },
        { date: 'invalid', value: 200000, series: 'A' },
        { date: null, value: 300000, series: 'A' },
      ]),
    );
    expect(rows.get('A')?.map((row) => row.value)).toEqual([5]);
  });
});

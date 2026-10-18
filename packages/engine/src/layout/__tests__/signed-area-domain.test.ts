import type { AreaMark, ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';
import { normalizeSpec } from '../../compiler/normalize';
import { computeScales } from '../scales';

const area = { x: 20, y: 30, width: 500, height: 300 };
function source(values: (number | string)[], offset?: 'zero' | 'normalize' | 'center'): ChartSpec {
  return {
    mark: 'area',
    data: values.map((value, i) => ({ x: 'one', series: String.fromCharCode(65 + i), value })),
    encoding: {
      x: { field: 'x', type: 'ordinal' },
      y: { field: 'value', type: 'quantitative', stack: offset, scale: { nice: false } },
      color: { field: 'series', type: 'nominal' },
    },
    endpointLabels: { anchor: 'band' },
  };
}
function domain(spec: ChartSpec): number[] {
  const normalized = normalizeSpec(spec);
  return computeScales(normalized as never, area, spec.data as never).y!.scale.domain() as number[];
}
describe('signed area domains follow the actual cumulative stack boundaries', () => {
  it.each([
    undefined,
    'zero',
  ] as const)('covers all-negative cumulative values with %s offset', (offset) => {
    expect(domain(source([-20, -30], offset))).toEqual([-50, 0]);
  });
  it('includes mixed-sign prefix extrema, not only the final sum', () => {
    expect(domain(source([10, -20, -30, 5]))).toEqual([-40, 10]);
  });
  it('covers all-negative centered bands', () => {
    expect(domain(source([-20, -30], 'center'))).toEqual([-25, 25]);
  });
  it('uses centered prefix extrema for mixed signed bands', () => {
    expect(domain(source([10, -20, -30, 5], 'center'))).toEqual([-22.5, 27.5]);
  });
  it('normalized signed bands may cross both zero and one', () => {
    const result = domain(source([10, -20, -30, 5], 'normalize'));
    expect(result[0]).toBeCloseTo(-2 / 7);
    expect(result[1]).toBeCloseTo(8 / 7);
  });
  it('keeps D3 zero-total normalize semantics instead of introducing a diverging offset', () => {
    expect(domain(source([10, -10], 'normalize'))).toEqual([0, 10]);
  });
  it.each([
    'zero',
    'center',
    'normalize',
  ] as const)('preserves an explicit authored domain for %s', (offset) => {
    const spec = source([-20, -30], offset);
    spec.encoding!.y = { ...spec.encoding!.y, scale: { domain: [-200, 200], nice: false } };
    expect(domain(spec)).toEqual([-200, 200]);
  });
  it('reads numeric strings and retains last-row-wins duplicate x/series semantics', () => {
    const spec = source(['-20', '-30']);
    spec.data = [{ x: 'one', series: 'A', value: '1000' }, ...(spec.data as never[])];
    expect(domain(spec)).toEqual([-50, 0]);
  });
  it.each([
    undefined,
    'zero',
    'center',
    'normalize',
  ] as const)('keeps every compiled signed boundary and band anchor inside the plot for %s', (offset) => {
    const layout = compileChart(source([10, -20, -30, 5], offset), { width: 680, height: 400 });
    for (const mark of layout.marks.filter((mark): mark is AreaMark => mark.type === 'area'))
      for (const point of [...mark.topPoints, ...mark.bottomPoints]) {
        expect(point.y).toBeGreaterThanOrEqual(layout.area.y - 1e-8);
        expect(point.y).toBeLessThanOrEqual(layout.area.y + layout.area.height + 1e-8);
      }
    for (const entry of layout.endpointLabels?.entries ?? []) {
      expect(entry.dataY).toBeGreaterThanOrEqual(layout.area.y - 1e-8);
      expect(entry.dataY).toBeLessThanOrEqual(layout.area.y + layout.area.height + 1e-8);
    }
  });
});

it('preserves the normalized zero-stack envelope', () => {
  expect(domain(source([0, 0], 'normalize'))).toEqual([0, 1]);
});

it('discovers stack order after the same numeric x sorting used by area geometry', () => {
  const spec: ChartSpec = {
    ...source([1, 2]),
    data: [
      { x: 2, series: 'A', value: 10 },
      { x: 1, series: 'B', value: -20 },
      { x: 1, series: 'A', value: 5 },
      { x: 2, series: 'B', value: -30 },
    ],
  };
  spec.encoding!.x = { field: 'x', type: 'quantitative' };
  expect(domain(spec)).toEqual([-30, 0]);
});

it('uses the existing stringified x pivot identity for numeric/string duplicate keys', () => {
  const spec: ChartSpec = {
    ...source([1, 2]),
    data: [
      { x: 1, series: 'A', value: '1000' },
      { x: '1', series: 'A', value: '-20' },
      { x: 1, series: 'B', value: '-30' },
    ],
  };
  spec.encoding!.x = { field: 'x', type: 'quantitative' };
  expect(domain(spec)).toEqual([-50, 0]);
});

it('excludes an explicitly missing shared boundary while preserving absent-row zero geometry', () => {
  const spec: ChartSpec = {
    ...source([1, 2]),
    data: [
      { x: 'one', series: 'A', value: 5 },
      { x: 'one', series: 'B', value: -10 },
      { x: 'two', series: 'A', value: 5 },
      { x: 'two', series: 'C', value: -20 },
      { x: 'missing', series: 'A', value: 1000 },
      { x: 'missing', series: 'B', value: null },
    ],
  };
  expect(domain(spec)).toEqual([-15, 5]);
});

it('keeps a solo sparkline tightly scaled and a constant color out of the stack path', () => {
  const spec: ChartSpec = {
    mark: 'area',
    display: 'sparkline',
    data: [
      { x: 1, value: 4001 },
      { x: 2, value: 4002 },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative', scale: { nice: false } },
      color: { value: '#123456' },
    },
  };
  expect(domain(spec)).toEqual([4001, 4002]);
});

it.each([
  'zero',
  'center',
  'normalize',
] as const)('retains positive-only domains for %s', (offset) => {
  expect(domain(source([10, 20], offset))).toEqual(
    offset === 'center' ? [-15, 15] : offset === 'normalize' ? [0, 1] : [0, 30],
  );
});

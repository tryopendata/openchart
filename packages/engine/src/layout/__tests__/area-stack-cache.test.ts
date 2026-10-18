import type { DataRow } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { computeAreaMarks } from '../../charts/line/area';
import { compileChart } from '../../compile';
import { buildRenderSpec } from '../../compile/render-spec';
import { normalizeSpec } from '../../compiler/normalize';
import type { NormalizedChartSpec } from '../../compiler/types';
import type { AreaStackGeometry } from '../../data/area-stack';
import { computeAreaStack, createAreaStackCache } from '../../data/area-stack';
import { computeScales } from '../scales';

const data = [
  { x: 1, series: 'A', value: 10 },
  { x: 1, series: 'B', value: -20 },
];
it('reuses stack geometry and bounds only inside the supplied lifecycle context', () => {
  const cache = createAreaStackCache();
  const first = computeAreaStack(data, 'x', 'value', 'series', 'quantitative', 'zero', cache);
  expect(computeAreaStack(data, 'x', 'value', 'series', 'quantitative', 'zero', cache)).toBe(first);
  expect(first.extent).toEqual([-10, 10]);
  expect(computeAreaStack(data, 'x', 'value', 'series', 'quantitative', 'center', cache)).not.toBe(
    first,
  );
  expect(
    computeAreaStack([...data], 'x', 'value', 'series', 'quantitative', 'zero', cache),
  ).not.toBe(first);
  expect(
    computeAreaStack(data, 'x', 'value', 'series', 'quantitative', 'zero', createAreaStackCache()),
  ).not.toBe(first);
});

it('does not retain stale stack values between compiles of a mutated authored input', () => {
  const spec = {
    mark: 'area',
    data: data.map((row) => ({ ...row })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative', scale: { nice: false } },
      color: { field: 'series', type: 'nominal' },
    },
  };
  const first = compileChart(spec, { width: 680, height: 400 });
  spec.data[1].value = -40;
  const second = compileChart(spec, { width: 680, height: 400 });
  expect(second.axes.y!.ticks.map((tick) => tick.value)).not.toEqual(
    first.axes.y!.ticks.map((tick) => tick.value),
  );
  expect(spec.data[1].value).toBe(-40);
});

it.each([
  'zero',
  'center',
  'normalize',
] as const)('reuses one actual pivot/stack across repeated scale planning and rendering for %s', (offset) => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({
    x: Math.floor(index / 4),
    value: (index % 3 === 0 ? -1 : 1) * (20 + 10 * Math.sin(index / 20)),
    series: 'ABCD'[index % 4],
  }));
  const source = {
    mark: 'area',
    data: rows,
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative', stack: offset },
      color: { field: 'series', type: 'nominal' },
    },
  };
  const normalized = normalizeSpec(source as never) as NormalizedChartSpec;
  const spec = buildRenderSpec(normalized);
  expect(spec).not.toBe(normalized);
  expect(normalized).not.toHaveProperty('areaStackCache');
  class CountingCache extends WeakMap<DataRow[], Map<string, AreaStackGeometry>> {
    builds = 0;
    override set(key: DataRow[], value: Map<string, AreaStackGeometry>) {
      this.builds++;
      return super.set(key, value);
    }
  }
  const cache = new CountingCache();
  spec.areaStackCache = cache;
  const area = { x: 20, y: 20, width: 900, height: 300 };
  for (let pass = 0; pass < 5; pass++) computeScales(spec, area, spec.data);
  const scales = computeScales(spec, area, spec.data);
  const cachedMarks = computeAreaMarks(spec, scales, area);
  expect(cache.builds).toBe(1);
  const uncached = { ...spec, areaStackCache: undefined };
  const freshScales = computeScales(uncached, area, uncached.data);
  expect(freshScales.y!.scale.domain()).toEqual(scales.y!.scale.domain());
  expect(computeAreaMarks(uncached, freshScales, area)).toEqual(cachedMarks);
});

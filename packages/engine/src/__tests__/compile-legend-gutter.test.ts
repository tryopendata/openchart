import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

const series: ChartSpec = {
  mark: 'line',
  data: ['North', 'South'].flatMap((region, index) => [
    { year: '2024', value: 10 + index * 5, region },
    { year: '2025', value: 20 + index * 5, region },
  ]),
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
  endpointLabels: true,
};

for (const position of ['right', 'bottom-right'] as const) {
  it.each([
    'chart',
    'shared',
    'independent',
  ] as const)(`places ${position} legend in its reserved gutter for %s`, (kind) => {
    const spec: ChartSpec = {
      ...series,
      legend: { show: true, position },
      annotations: [
        { type: 'text', id: 'a', x: '2024', y: 15, text: 'First note' },
        { type: 'text', id: 'b', x: '2025', y: 25, text: 'Second note' },
      ],
    };
    const options = { width: 1000, height: 450 };
    const layered: LayerSpec = {
      layer: [series, series],
      legend: spec.legend,
      annotations: spec.annotations,
      ...(kind === 'independent' ? { resolve: { scale: { y: 'independent' as const } } } : {}),
    };
    const layout = kind === 'chart' ? compileChart(spec, options) : compileLayer(layered, options);
    const column = layout.endpointLabels!;
    expect(column.entries.length).toBeGreaterThan(0);
    const legend = layout.legend;
    expect(legend.bounds.width).toBeGreaterThan(0);
    expect(legend.bounds.x).toBeGreaterThanOrEqual(column.bounds.x + column.bounds.width + 7.99);
    expect(legend.bounds.x + legend.bounds.width).toBeLessThanOrEqual(options.width);
    if ('entryPositions' in legend) {
      expect(legend.entryPositions!.every((entry) => entry.x >= legend.bounds.x)).toBe(true);
    }
  });
}

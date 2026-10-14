import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileLayer } from '../compile';

const dimensions = { width: 640, height: 420 };

function pointLayer(name: string, value: number, format: string, zIndex: number): ChartSpec {
  return {
    mark: 'point',
    data: [{ id: 'same-key', name, x: 1, value }],
    zIndex,
    encoding: {
      key: { field: 'id', type: 'nominal' },
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'value', type: 'quantitative' },
      tooltip: [{ field: 'value', type: 'quantitative', title: name, format }],
    },
  };
}

describe('layered observation identity', () => {
  it.each([
    'shared',
    'independent',
  ] as const)('excludes missing observations from %s layer scale domains', (scale) => {
    const leaf = (missing: boolean): ChartSpec => ({
      mark: 'point',
      data: [
        { x: 10, y: 20 },
        { x: 20, y: 40 },
        ...(missing
          ? [
              { x: null, y: null },
              { x: '', y: '' },
            ]
          : []),
      ],
      encoding: {
        x: { field: 'x', type: 'quantitative', scale: { zero: false } },
        y: { field: 'y', type: 'quantitative', scale: { zero: false } },
      },
    });
    const compile = (missing: boolean) =>
      compileLayer(
        { layer: [leaf(missing), leaf(missing)], resolve: { scale: { y: scale } } },
        dimensions,
      );
    const before = compile(false);
    const after = compile(true);
    expect(after.marks).toHaveLength(before.marks.length);
    expect(after.marks.map((mark) => mark.type === 'point' && [mark.cx, mark.cy])).toEqual(
      before.marks.map((mark) => mark.type === 'point' && [mark.cx, mark.cy]),
    );
  });

  it.each([
    'shared',
    'independent',
  ] as const)('keeps each leaf tooltip and format attached to the painted mark with %s scales', (scale) => {
    const layout = compileLayer(
      {
        layer: [pointLayer('Revenue', 1250, '$,.0f', 1), pointLayer('Share', 0.25, '.0%', 0)],
        resolve: { scale: { y: scale } },
      },
      dimensions,
    );
    const rows = layout.marks.map((mark, index) => ({
      name: 'data' in mark && !Array.isArray(mark.data) ? mark.data.name : undefined,
      content: layout.tooltipDescriptors.get(`${mark.type}-${index}`),
    }));
    expect(rows).toEqual([
      {
        name: 'Share',
        content: expect.objectContaining({ fields: [{ label: 'Share', value: '25%' }] }),
      },
      {
        name: 'Revenue',
        content: expect.objectContaining({ fields: [{ label: 'Revenue', value: '$1,250' }] }),
      },
    ]);
    expect(layout.tooltipDescriptors.size).toBe(2);
  });

  it('keeps leaf keys distinct and stable across nested-layer paint order and viewport changes', () => {
    const first = pointLayer('First', 10, '.0f', 1);
    const second = pointLayer('Second', 20, '.0f', 0);
    const spec: LayerSpec = { layer: [{ layer: [first] }, second] };
    const before = compileLayer(spec, dimensions);
    const after = compileLayer(
      { ...spec, layer: [{ layer: [{ ...first, zIndex: -1 }] }, second] },
      { width: 320, height: 420 },
    );
    const keysByName = (layout: typeof before) =>
      new Map(
        layout.marks.map((mark) => [
          'data' in mark && !Array.isArray(mark.data) ? mark.data.name : undefined,
          mark.key,
        ]),
      );
    expect(new Set(before.marks.map((mark) => mark.key)).size).toBe(2);
    expect(keysByName(after)).toEqual(keysByName(before));
    expect(after.tooltipDescriptors.get('point-0')?.fields[0].label).toBe('First');
    expect(after.tooltipDescriptors.get('point-1')?.fields[0].label).toBe('Second');
    const single = compileLayer({ layer: [{ layer: [first] }] }, dimensions);
    expect(single.marks[0].key).toBe(keysByName(before).get('First'));
  });

  it.each([
    'line',
    'area',
  ] as const)('preserves distinct %s leaf identities and point formats when series names repeat', (mark) => {
    const leaf = (name: string, value: number, format: string): ChartSpec => ({
      mark,
      data: [
        { id: 'a', name, series: 'Shared', x: 1, value },
        { id: 'b', name, series: 'Shared', x: 2, value: value * 2 },
      ],
      encoding: {
        key: { field: 'id', type: 'nominal' },
        x: { field: 'x', type: 'ordinal' },
        y: { field: 'value', type: 'quantitative', stack: null },
        color: { field: 'series', type: 'nominal' },
        tooltip: [{ field: 'value', type: 'quantitative', title: name, format }],
      },
    });
    const layout = compileLayer(
      { layer: [leaf('Money', 10, '$.0f'), leaf('Rate', 0.1, '.0%')] },
      dimensions,
    );
    expect(new Set(layout.marks.map((item) => item.key)).size).toBe(layout.marks.length);
    const series = layout.marks.filter((item) => item.type === mark);
    expect(series).toHaveLength(2);
    expect(series.map((item) => item.seriesKey)).toEqual(['Shared', 'Shared']);
    expect(series.map((item) => item.dataPoints?.[0].tooltip?.fields)).toEqual([
      [{ label: 'Money', value: '$10' }],
      [{ label: 'Rate', value: '10%' }],
    ]);
    expect(series[0].pointKeys?.[0]).not.toBe(series[1].pointKeys?.[0]);
  });
});

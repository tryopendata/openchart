import type { ChartLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileLayer } from '../../compile';

const options = { width: 680, height: 320, onWarn: () => {} };
function axisPosition(layout: ChartLayout, axis: 'x' | 'y', value: number) {
  const tick = layout.axes[axis]?.ticks.find((tick) => tick.value === value);
  if (!tick) throw new Error(`Missing authored ${axis} tick ${value}`);
  return tick.position;
}

describe('shared axes and mark coordinates', () => {
  it('maps median, upper bound and first-test tick onto the displayed time-to-green axis', () => {
    const data = [{ row: 'all', median: 14, p75: 26, firstTest: 6 }];
    const layout = compileLayer(
      {
        data,
        layer: [
          {
            data,
            mark: { type: 'range', style: 'bar' },
            encoding: {
              x: { field: 'median', type: 'quantitative', axis: { values: [6, 14, 20, 26] } },
              x2: { field: 'p75', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
          {
            data,
            mark: 'tick',
            encoding: {
              x: { field: 'firstTest', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
        ],
      },
      options,
    );
    const bar = layout.marks.find((mark) => mark.type === 'rect');
    const tick = layout.marks.find((mark) => mark.type === 'tick');
    if (bar?.type !== 'rect' || tick?.type !== 'tick')
      throw new Error('Missing time-to-green marks');
    expect(bar.x).toBeCloseTo(axisPosition(layout, 'x', 14), 8);
    expect(bar.x + bar.width).toBeCloseTo(axisPosition(layout, 'x', 26), 8);
    expect(tick.x).toBeCloseTo(axisPosition(layout, 'x', 6), 8);
  });
  it('maps inferred errorbar bounds and point estimates onto one quantitative axis', () => {
    const data = [{ row: 'A', lower: 0.2, upper: 0.9, value: 0.5 }];
    const layout = compileLayer(
      {
        data,
        layer: [
          {
            data,
            mark: 'errorbar',
            encoding: {
              x: { field: 'lower', type: 'quantitative', axis: { values: [0.2, 0.5, 0.9] } },
              x2: { field: 'upper', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
          {
            data,
            mark: 'point',
            encoding: {
              x: { field: 'value', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
        ],
      },
      options,
    );
    const whisker = layout.marks.find((mark) => mark.type === 'rule');
    const point = layout.marks.find((mark) => mark.type === 'point');
    if (whisker?.type !== 'rule' || point?.type !== 'point')
      throw new Error('Missing interval marks');
    expect(whisker.x1).toBeCloseTo(axisPosition(layout, 'x', 0.2), 8);
    expect(whisker.x2).toBeCloseTo(axisPosition(layout, 'x', 0.9), 8);
    expect(point.cx).toBeCloseTo(axisPosition(layout, 'x', 0.5), 8);
  });
  for (const stack of ['zero', 'normalize'] as const)
    it(`uses compiled ${stack} stack extents for the axis and every leaf`, () => {
      const data = [
        { day: 'one', preset: 'A', value: 40 },
        { day: 'one', preset: 'B', value: 60 },
      ];
      const reference = stack === 'normalize' ? 0.8 : 50;
      const top = stack === 'normalize' ? 1 : 100;
      const layout = compileLayer(
        {
          layer: [
            {
              data,
              mark: 'bar',
              encoding: {
                x: { field: 'day', type: 'nominal' },
                y: {
                  field: 'value',
                  type: 'quantitative',
                  stack,
                  axis: { values: [0, reference, top] },
                },
                color: { field: 'preset', type: 'nominal' },
              },
            },
            {
              data: [{ day: 'one', reference }],
              mark: 'point',
              encoding: {
                x: { field: 'day', type: 'nominal' },
                y: { field: 'reference', type: 'quantitative' },
              },
            },
          ],
        },
        options,
      );
      const bars = layout.marks.filter((mark) => mark.type === 'rect');
      const point = layout.marks.find((mark) => mark.type === 'point');
      if (point?.type !== 'point') throw new Error('Missing reference');
      expect(bars).toHaveLength(2);
      expect(Math.min(...bars.map((bar) => bar.y))).toBeCloseTo(axisPosition(layout, 'y', top), 8);
      expect(Math.max(...bars.map((bar) => bar.y + bar.height))).toBeCloseTo(
        axisPosition(layout, 'y', 0),
        8,
      );
      expect(point.cy).toBeCloseTo(axisPosition(layout, 'y', reference), 8);
    });
  it('uses transformed aggregate values rather than raw row values for the shared domain', () => {
    const data = [
      { row: 'A', value: 10 },
      { row: 'A', value: 20 },
    ];
    const layout = compileLayer(
      {
        layer: [
          {
            data,
            mark: 'bar',
            transform: [
              { aggregate: [{ op: 'sum', field: 'value', as: 'total' }], groupby: ['row'] },
            ],
            encoding: {
              x: { field: 'total', type: 'quantitative', axis: { values: [0, 25, 30] } },
              y: { field: 'row', type: 'nominal' },
            },
          },
          {
            data: [{ row: 'A', reference: 25 }],
            mark: 'tick',
            encoding: {
              x: { field: 'reference', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
        ],
      },
      options,
    );
    const bar = layout.marks.find((mark) => mark.type === 'rect');
    const tick = layout.marks.find((mark) => mark.type === 'tick');
    if (bar?.type !== 'rect' || tick?.type !== 'tick') throw new Error('Missing aggregate marks');
    expect(bar.x + bar.width).toBeCloseTo(axisPosition(layout, 'x', 30), 8);
    expect(tick.x).toBeCloseTo(axisPosition(layout, 'x', 25), 8);
  });
  it('keeps an authored shared domain exact even when other leaf values are outside it', () => {
    const layout = compileLayer(
      {
        layer: [
          {
            data: [{ row: 'A', lower: 0.2, upper: 0.8 }],
            mark: 'errorbar',
            encoding: {
              x: {
                field: 'lower',
                type: 'quantitative',
                scale: { domain: [0, 1] },
                axis: { values: [0, 0.2, 0.8, 1] },
              },
              x2: { field: 'upper', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
          {
            data: [{ row: 'A', value: 4 }],
            mark: 'point',
            encoding: {
              x: { field: 'value', type: 'quantitative' },
              y: { field: 'row', type: 'nominal' },
            },
          },
        ],
      },
      options,
    );
    const whisker = layout.marks.find((mark) => mark.type === 'rule');
    if (whisker?.type !== 'rule') throw new Error('Missing whisker');
    expect(layout.xInvert?.topData).toBe(0);
    expect(layout.xInvert?.bottomData).toBe(1);
    expect(whisker.x1).toBeCloseTo(axisPosition(layout, 'x', 0.2), 8);
    expect(whisker.x2).toBeCloseTo(axisPosition(layout, 'x', 0.8), 8);
  });
  it('shares the primary inline-axis inset with point peers as well as its domain', () => {
    const data = [
      { day: '2026-10-10', value: 2 },
      { day: '2026-10-20', value: 4 },
    ];
    const encoding = {
      x: {
        field: 'day',
        type: 'temporal' as const,
        scale: { domain: ['2026-10-01', '2026-10-31'] },
        axis: { values: ['2026-10-10', '2026-10-20'] },
      },
      y: { field: 'value', type: 'quantitative' as const, scale: { domain: [0, 10] } },
    };
    const layout = compileLayer(
      {
        layer: [
          { data, mark: 'line', encoding },
          { data, mark: 'point', encoding },
        ],
      },
      options,
    );
    const line = layout.marks.find((mark) => mark.type === 'line');
    const points = layout.marks.filter((mark) => mark.type === 'point');
    if (line?.type !== 'line') throw new Error('Missing line');
    for (const [index, row] of data.entries()) {
      const tick = layout.axes.x?.ticks.find(
        (tick) => new Date(tick.value as string).getTime() === new Date(row.day).getTime(),
      );
      if (!tick) throw new Error('Missing date tick');
      expect(line.points[index].x).toBeCloseTo(tick.position, 8);
      expect(points[index].cx).toBeCloseTo(tick.position, 8);
    }
  });
});

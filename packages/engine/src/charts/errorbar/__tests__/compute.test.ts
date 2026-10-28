import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../../../compile';
import { compile as compileSpec } from '../../../compiler';
import { computeScales } from '../../../layout/scales';
import { computeErrorbarMarks } from '../compute';
import { ERRORBAR_CAP_LENGTH } from '../constants';

const data = [
  { category: 'A', lower: 0, upper: 1, value: 0.5, text: '0-100% n=40' },
  { category: 'B', lower: null, upper: 1, value: null, text: 'hidden' },
];
const horizontal = {
  x: { field: 'lower', type: 'quantitative' },
  x2: { field: 'upper' },
  y: { field: 'category', type: 'nominal' },
  description: { field: 'text' },
};
const options = { width: 680, height: 320, onWarn: () => {} };
describe('explicit errorbars', () => {
  for (const axisTick of [12, 14])
    for (const width of [330, 360, 680])
      for (const vertical of [false, true])
        it(`centers finite ${vertical ? 'vertical' : 'horizontal'} bounds and decorative caps at ${width}/${axisTick}`, () => {
          const encoding = vertical
            ? {
                y: horizontal.x,
                y2: horizontal.x2,
                x: horizontal.y,
                description: horizontal.description,
              }
            : horizontal;
          const layout = compileChart(
            { data, mark: { type: 'errorbar', ticks: true }, encoding },
            { ...options, width, theme: { fonts: { sizes: { axisTick } } } },
          );
          expect(layout.marks).toHaveLength(3);
          const [whisker, ...caps] = layout.marks;
          expect(whisker.type).toBe('rule');
          if (whisker.type !== 'rule') throw new Error('Missing whisker');
          expect(whisker.markType).toBe('errorbar');
          expect(whisker.authoredDescription).toBe(data[0].text);
          expect(whisker.identity).toEqual({ category: 'A' });
          expect(vertical ? whisker.x1 : whisker.y1).toBe(vertical ? whisker.x2 : whisker.y2);
          expect(
            Math.abs(vertical ? whisker.y1 - whisker.y2 : whisker.x1 - whisker.x2),
          ).toBeGreaterThan(0);
          for (const cap of caps) {
            expect(cap.type).toBe('tick');
            if (cap.type !== 'tick') throw new Error('Missing cap');
            expect(cap.length).toBe(ERRORBAR_CAP_LENGTH);
            expect(cap.aria.decorative).toBe(true);
            expect(cap.markType).toBeUndefined();
            expect(cap.x).toBeGreaterThanOrEqual(layout.area.x);
            expect(cap.x).toBeLessThanOrEqual(layout.area.x + layout.area.width);
            expect(cap.y).toBeGreaterThanOrEqual(layout.area.y);
            expect(cap.y).toBeLessThanOrEqual(layout.area.y + layout.area.height);
          }
        });
  it('unions the upper endpoint into the inferred quantitative domain and omits caps by default', () => {
    const layout = compileChart(
      {
        data: [{ category: 'A', lower: 2, upper: 100, text: '2 to 100' }],
        mark: 'errorbar',
        encoding: horizontal,
      },
      options,
    );
    expect(layout.marks).toHaveLength(1);
    const mark = layout.marks[0];
    if (mark.type !== 'rule') throw new Error('Missing whisker');
    expect(mark.x2).toBeLessThanOrEqual(layout.area.x + layout.area.width);
    expect(mark.x2).toBeGreaterThan(mark.x1);
  });
  it('aligns the estimate with the whisker and preserves paint order in a layer', () => {
    const layout = compileLayer(
      {
        data,
        layer: [
          { mark: 'errorbar', encoding: horizontal },
          {
            mark: 'point',
            encoding: { x: { field: 'value', type: 'quantitative' }, y: horizontal.y },
          },
        ],
      },
      options,
    );
    const whisker = layout.marks.find((mark) => mark.type === 'rule');
    const point = layout.marks.find((mark) => mark.type === 'point');
    if (whisker?.type !== 'rule' || point?.type !== 'point')
      throw new Error('Missing interval layer');
    expect(whisker.y1).toBeCloseTo(point.cy, 8);
    expect(layout.marks.indexOf(whisker)).toBeLessThan(layout.marks.indexOf(point));
    expect(whisker.x1).toBeGreaterThanOrEqual(layout.area.x);
    expect(whisker.x2).toBeLessThanOrEqual(layout.area.x + layout.area.width);
  });
  for (const encoding of [
    { x: horizontal.x, y: horizontal.y },
    { ...horizontal, y2: { field: 'upper' } },
    { ...horizontal, y: { field: 'value', type: 'quantitative' } },
    { ...horizontal, x: { field: 'category', type: 'nominal' } },
  ])
    it('rejects missing, ambiguous or non-quantitative bounds and numeric categories', () => {
      expect(() => compileChart({ data, mark: 'errorbar', encoding }, options)).toThrow(/errorbar/);
    });
  it('leaves errorbar strokes outside sparkline trend coloring', () => {
    const spec = { data: [data[0]], mark: 'errorbar', encoding: horizontal };
    const regular = compileChart(spec, options);
    const spark = compileChart({ ...spec, display: 'sparkline' }, options);
    expect(spark.marks[0].type === 'rule' && spark.marks[0].stroke).toBe(
      regular.marks[0].type === 'rule' && regular.marks[0].stroke,
    );
  });
  it('clamps opacity, preserves zero, and falls back for nonfinite inputs', () => {
    for (const [opacity, expected] of [
      [0, 0],
      [-1, 0],
      [2, 1],
      [NaN, 0.35],
      [Infinity, 0.35],
    ] as const) {
      const layout = compileChart(
        {
          data: [{ ...data[0], opacity }],
          mark: 'errorbar',
          encoding: { ...horizontal, opacity: { field: 'opacity' } },
        },
        options,
      );
      expect(layout.marks[0].opacity).toBe(expected);
    }
  });
  it('skips invalid and nonfinite bounds and permits an entirely unpublished interval', () => {
    for (const [lower, upper] of [
      [null, null],
      [NaN, 1],
      [0, Infinity],
    ] as const) {
      const { spec } = compileSpec({ data: [data[0]], mark: 'errorbar', encoding: horizontal });
      if (!('markType' in spec)) throw new Error('Missing chart');
      const area = { x: 20, y: 20, width: 300, height: 200 };
      const scales = computeScales(spec, area, spec.data);
      expect(
        computeErrorbarMarks({ ...spec, data: [{ ...data[0], lower, upper }] }, scales, area),
      ).toHaveLength(0);
    }
  });
  it('supports temporal positions and reversed explicit value domains', () => {
    const layout = compileChart(
      {
        data: [{ day: '2026-10-25', lower: 0.1, upper: 0.9 }],
        mark: 'errorbar',
        encoding: {
          x: { field: 'day', type: 'temporal' },
          y: { field: 'lower', type: 'quantitative', scale: { domain: [1, 0] } },
          y2: { field: 'upper' },
        },
      },
      options,
    );
    const mark = layout.marks[0];
    if (mark.type !== 'rule') throw new Error('Missing temporal whisker');
    expect(Number.isFinite(mark.x1)).toBe(true);
    expect(mark.x1).toBe(mark.x2);
    expect(mark.y2).toBeGreaterThan(mark.y1);
  });
});

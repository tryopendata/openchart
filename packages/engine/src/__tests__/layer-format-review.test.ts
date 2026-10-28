import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

const options = { width: 680, height: 360, onWarn: () => {} };
const DAY = 86400000;

describe('independent-y temporal bar domain padding', () => {
  for (const intervals of [
    ['week', 'week'],
    ['day', 'week'],
    ['week', 'day'],
  ] as const) {
    it(`unions ${intervals.join('/')} edge padding without compounding it`, () => {
      const data = [
        { date: '2026-10-12', a: 10, b: 20 },
        { date: '2026-10-19', a: 20, b: 30 },
      ];
      const layer: ChartSpec[] = intervals.map((interval, i) => ({
        data,
        mark: 'bar',
        encoding: {
          x: { field: 'date', type: 'temporal', interval },
          y: { field: i === 0 ? 'a' : 'b', type: 'quantitative' },
        },
      }));
      for (const leaves of [layer, [...layer].reverse()]) {
        const spec: LayerSpec = { data, layer: leaves, resolve: { scale: { y: 'independent' } } };
        const layout = compileLayer(spec, options);
        const domain = [layout.xInvert!.topData, layout.xInvert!.bottomData];
        expect(domain).toEqual([
          +new Date('2026-10-12') - 3.5 * DAY,
          +new Date('2026-10-19') + 3.5 * DAY,
        ]);
        const bars = layout.marks.filter((mark) => mark.type === 'rect');
        expect(bars).toHaveLength(4);
        for (const [index, bar] of bars.entries()) {
          const interval = leaves[Math.floor(index / 2)].encoding.x?.interval;
          expect(bar.width).toBeCloseTo(
            (layout.area.width * 0.4) / (interval === 'day' ? 7 : 1),
            6,
          );
          expect(bar.x).toBeGreaterThanOrEqual(layout.area.x);
          expect(bar.x + bar.width).toBeLessThanOrEqual(layout.area.x + layout.area.width);
        }
      }
    });
  }
});

describe('normalized label format precedence', () => {
  for (const horizontal of [true, false]) {
    it(`honors value-channel format for ${horizontal ? 'horizontal' : 'vertical'} bars`, () => {
      const value = {
        field: 'value',
        type: 'quantitative' as const,
        stack: 'normalize' as const,
        format: '.2%',
      };
      const category = { field: 'category', type: 'nominal' as const };
      const spec: ChartSpec = {
        data: [
          { category: 'A', series: 'one', value: 1 },
          { category: 'A', series: 'two', value: 2 },
        ],
        mark: 'bar',
        encoding: {
          ...(horizontal ? { x: value, y: category } : { x: category, y: value }),
          color: { field: 'series', type: 'nominal' },
        },
        labels: { density: 'all' },
      };
      const texts = (spec: ChartSpec) =>
        compileChart(spec, options)
          .marks.filter((mark) => mark.type === 'rect')
          .map((mark) => mark.label?.text);
      expect(texts(spec)).toEqual(['33.33%', '66.67%']);
      expect(texts({ ...spec, labels: { density: 'all', format: '.1%' } })).toEqual([
        '33.3%',
        '66.7%',
      ]);
      const unformatted = { ...value, format: undefined };
      expect(
        texts({
          ...spec,
          encoding: { ...spec.encoding, ...(horizontal ? { x: unformatted } : { y: unformatted }) },
        }),
      ).toEqual(['33%', '67%']);
    });
  }
});

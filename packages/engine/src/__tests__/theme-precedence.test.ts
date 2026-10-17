import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';

const leaf: ChartSpec = {
  mark: 'line',
  data: [
    { x: 0, y: 1 },
    { x: 1, y: 3 },
  ],
  encoding: { x: { field: 'x', type: 'ordinal' }, y: { field: 'y', type: 'quantitative' } },
  chrome: { title: 'Title' },
};
describe('theme layer precedence', () => {
  for (const independent of [false, true]) {
    it(`merges parent, leaf, and host themes with ${independent ? 'independent' : 'shared'} axes`, () => {
      const spec: LayerSpec = {
        layer: [
          { ...leaf, theme: { fonts: { sizes: { title: 31 } }, colors: { text: '#123456' } } },
          leaf,
        ],
        theme: { fonts: { sizes: { title: 20, small: 14 } }, colors: { background: '#faf8f5' } },
        ...(independent ? { resolve: { scale: { y: 'independent' as const } } } : {}),
      };
      const result = compileLayer(spec, {
        width: 600,
        height: 400,
        theme: { fonts: { sizes: { axisTick: 17 } } },
      });
      expect(result.theme.fonts.sizes).toMatchObject({ title: 31, small: 14, axisTick: 17 });
      expect(result.theme.colors).toMatchObject({ text: '#123456', background: '#faf8f5' });
    });
  }
  it('honors host watermark overrides even for sparkline and breakpoint defaults', () => {
    expect(
      compileChart({ ...leaf, watermark: true }, { width: 600, height: 400, watermark: false })
        .watermark,
    ).toBe(false);
    expect(
      compileChart(
        { ...leaf, watermark: false, display: 'sparkline' },
        { width: 600, height: 180, watermark: true },
      ).watermark,
    ).toBe(true);
  });
});

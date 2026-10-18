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
const point = (fill: string) => ({ ...leaf, mark: 'point' as const, theme: themeWith(fill) });
const themeWith = (fill: string) => ({ colors: { categorical: [fill] } });
const pointFills = (layout: { marks: { type: string }[] }) => [
  ...new Set(
    layout.marks.filter((m) => m.type === 'point').map((m) => (m as { fill: string }).fill),
  ),
];

describe('theme layer precedence', () => {
  for (const independent of [false, true]) {
    it(`takes root chrome from the layer theme, not leaf 0, with ${independent ? 'independent' : 'shared'} axes`, () => {
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
      // Whole-object choice: none of leaf 0's theme reaches the root.
      expect(result.theme.fonts.sizes).toMatchObject({ title: 20, small: 14, axisTick: 17 });
      expect(result.theme.colors.background).toBe('#faf8f5');
      expect(result.theme.colors.text).not.toBe('#123456');
    });
  }

  it('falls back to the leaf 0 theme for the root when the layer has none', () => {
    const result = compileLayer(
      { layer: [{ ...leaf, theme: { fonts: { sizes: { title: 31 } } } }, leaf] },
      { width: 600, height: 400, theme: { fonts: { sizes: { axisTick: 17 } } } },
    );
    expect(result.theme.fonts.sizes).toMatchObject({ title: 31, axisTick: 17 });
  });

  it("deep-merges each leaf theme over the layer theme for that leaf's marks", () => {
    const layerTheme = { colors: { categorical: ['#111111'] }, fonts: { sizes: { title: 20 } } };
    const result = compileLayer(
      {
        theme: layerTheme,
        layer: [point('#00ff00'), point('#ff0000'), { ...leaf, mark: 'point' as const }],
      },
      { width: 600, height: 400 },
    );
    // Leaf 0 and leaf N both use their own palette; a theme-less leaf inherits the layer's.
    expect(pointFills(result)).toEqual(['#00ff00', '#ff0000', '#111111']);
    expect(result.theme.colors.categorical[0]).toBe('#111111');
    expect(result.theme.fonts.sizes.title).toBe(20);
  });

  it('deep-merges each dual-axis leaf theme over the layer theme for its marks and axis', () => {
    const tick = (size: number) => ({ fonts: { sizes: { axisTick: size } } });
    const result = compileLayer(
      {
        theme: { ...themeWith('#111111'), fonts: { sizes: { axisTick: 15, title: 20 } } },
        resolve: { scale: { y: 'independent' } },
        layer: [
          { ...point('#00ff00'), theme: { ...themeWith('#00ff00'), ...tick(9) } },
          point('#ff0000'),
        ],
      },
      { width: 600, height: 400 },
    );
    expect(pointFills(result)).toEqual(['#00ff00', '#ff0000']);
    expect(result.axes.y?.tickLabelStyle.fontSize).toBe(9);
    // Leaf 1 sets no axisTick, so its axis inherits the layer's.
    expect(result.axes.y2?.tickLabelStyle.fontSize).toBe(15);
    // Root chrome stays with the layer theme.
    expect(result.theme.fonts.sizes.title).toBe(20);
    expect(result.theme.colors.categorical[0]).toBe('#111111');
  });

  it('cascades the layer theme onto a leaf for keys the leaf does not set', () => {
    const result = compileLayer(
      {
        theme: { colors: { categorical: ['#111111'] } },
        layer: [{ ...leaf, mark: 'point' as const, theme: { fonts: { sizes: { small: 16 } } } }],
      },
      { width: 600, height: 400 },
    );
    expect(pointFills(result)).toEqual(['#111111']);
  });
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

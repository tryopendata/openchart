import type { ChartSpec, SizeLegendLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

const OPTIONS = { width: 800, height: 500 };

/** Gapminder-shaped: a bubble scatter keying BOTH color (nominal) and size (quantitative). */
const bubbles: ChartSpec = {
  mark: { type: 'point' },
  data: [
    { gdp: 1200, life: 55, pop: 300_000, region: 'Africa' },
    { gdp: 8000, life: 70, pop: 50_000_000, region: 'Asia' },
    { gdp: 45000, life: 81, pop: 8_000_000, region: 'Europe' },
    { gdp: 60000, life: 79, pop: 330_000_000, region: 'Americas' },
    { gdp: 30000, life: 77, pop: 1_400_000_000, region: 'Asia' },
  ],
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'life', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
    size: { field: 'pop', type: 'quantitative' },
  },
};

function sizeLegendOf(spec: ChartSpec, options = OPTIONS): SizeLegendLayout | undefined {
  const layout = compileChart(spec, options);
  return layout.legends.find((l): l is SizeLegendLayout => l.type === 'size');
}

describe('size legend', () => {
  /**
   * The whole point of the plural legend slot. A bubble chart keys continent
   * (color) and population (size); the single `legend` slot could only ever hold
   * one, so adding a size legend would have silently deleted the color legend.
   */
  it('renders alongside the color legend, not instead of it', () => {
    const layout = compileChart(bubbles, OPTIONS);

    expect(layout.legends).toHaveLength(2);
    const channels = layout.legends.map((l) => l.channel ?? 'color');
    expect(channels).toContain('color');
    expect(channels).toContain('size');

    // The primary slot still holds the color legend, for every existing consumer.
    expect(layout.legend.type === 'size').toBe(false);
  });

  it('is absent when nothing encodes size', () => {
    const noSize: ChartSpec = {
      ...bubbles,
      encoding: { ...bubbles.encoding, size: undefined },
    } as ChartSpec;
    expect(sizeLegendOf(noSize)).toBeUndefined();
  });

  /**
   * The key must resolve the SAME scale the marks resolve, or its circles are
   * not the size of the bubbles they claim to explain. Both call buildSizeScale.
   */
  it('draws circles at the radius the marks actually use', () => {
    const layout = compileChart(bubbles, OPTIONS);
    const legend = layout.legends.find((l): l is SizeLegendLayout => l.type === 'size');
    const points = layout.marks.filter((m) => m.type === 'point');

    const maxMarkRadius = Math.max(...points.map((p) => (p as { r: number }).r));
    const maxCircleRadius = Math.max(...(legend?.circles ?? []).map((c) => c.radius));

    // The largest keyed circle corresponds to the top of the domain, which is
    // the largest datum here -- so it matches the biggest bubble exactly.
    expect(maxCircleRadius).toBeCloseTo(maxMarkRadius, 5);
  });

  it('nests the circles on a shared baseline, largest first', () => {
    const circles = sizeLegendOf(bubbles)?.circles ?? [];
    expect(circles.length).toBeGreaterThan(1);

    // Largest first.
    for (let i = 1; i < circles.length; i++) {
      expect(circles[i].radius).toBeLessThan(circles[i - 1].radius);
    }
    // Concentric: every circle shares a bottom edge (cy + r is constant).
    const baselines = circles.map((c) => c.cy + c.radius);
    for (const b of baselines) expect(b).toBeCloseTo(baselines[0], 5);
  });

  it('reserves its own right-margin instead of overlapping the plot', () => {
    const withSize = compileChart(bubbles, OPTIONS);
    const withoutSize = compileChart(
      { ...bubbles, encoding: { ...bubbles.encoding, size: undefined } } as ChartSpec,
      OPTIONS,
    );

    // The plot narrows to make room -- it does not stay put and get drawn over.
    expect(withSize.area.width).toBeLessThan(withoutSize.area.width);

    const legend = withSize.legends.find((l): l is SizeLegendLayout => l.type === 'size');
    expect(legend).toBeDefined();
    // And the legend sits outside the plot's right edge.
    expect(legend?.bounds.x).toBeGreaterThanOrEqual(withSize.area.x + withSize.area.width);
  });

  /**
   * The size scale clamps, so with an explicit domain every datum past
   * `domain[1]` renders at max radius. Keying the data extent would label the
   * biggest circle with a value it doesn't actually correspond to.
   */
  it('keys the scale domain, not the data extent', () => {
    const capped: ChartSpec = {
      ...bubbles,
      encoding: {
        ...bubbles.encoding,
        size: { field: 'pop', type: 'quantitative', scale: { domain: [0, 100_000_000] } },
      },
    } as ChartSpec;

    const circles = sizeLegendOf(capped)?.circles ?? [];
    expect(circles.length).toBeGreaterThan(0);
    // Nothing keyed above the domain ceiling, even though a datum hits 1.4B.
    for (const c of circles) {
      expect(c.value).toBeLessThanOrEqual(100_000_000);
    }
  });

  it('drops out when the size domain is degenerate (every value identical)', () => {
    const flat: ChartSpec = {
      ...bubbles,
      data: bubbles.data.map((d) => ({ ...(d as object), pop: 5_000_000 })),
    } as ChartSpec;
    // No magnitude is encoded, so there is nothing to key.
    expect(sizeLegendOf(flat)).toBeUndefined();
  });

  it('is suppressed by legend: { show: false }', () => {
    expect(sizeLegendOf({ ...bubbles, legend: { show: false } })).toBeUndefined();
  });

  /**
   * Font size is not a keyed channel. No publication legends it, and a stack of
   * type at 12/24/48px reads as a font-sample sheet rather than a key.
   */
  it('is not emitted for a text mark, whose size is emphasis rather than a key', () => {
    const textSpec: ChartSpec = {
      mark: { type: 'text' },
      data: [...(bubbles.data as object[])] as ChartSpec['data'],
      encoding: {
        x: { field: 'gdp', type: 'quantitative' },
        y: { field: 'life', type: 'quantitative' },
        text: { field: 'region', type: 'nominal' },
        size: { field: 'pop', type: 'quantitative' },
      },
    } as ChartSpec;
    expect(sizeLegendOf(textSpec)).toBeUndefined();
  });

  it('rounds the keyed values instead of showing raw data extremes', () => {
    const circles = sizeLegendOf(bubbles)?.circles ?? [];
    // 1.4B is the domain top and is always keyed; the rest step down by halves
    // and nice-round, so no label is a long unrounded number.
    const labels = circles.map((c) => c.label);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.some((l) => /^\d+(\.\d)?[KMB]?$/.test(l))).toBe(true);
  });
});

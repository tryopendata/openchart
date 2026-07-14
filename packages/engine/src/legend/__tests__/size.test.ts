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

/** Beeswarm: same size channel, but a [2, 10] radius range -- a 20px-tall stack. */
const swarmSpec: ChartSpec = {
  mark: { type: 'beeswarm' },
  data: [...(bubbles.data as object[])] as ChartSpec['data'],
  encoding: {
    x: { field: 'gdp', type: 'quantitative' },
    y: { field: 'region', type: 'nominal' },
    size: { field: 'pop', type: 'quantitative' },
  },
} as ChartSpec;

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

    // A scatter's radii ([3, 30]) are already legible, so the key is drawn at the
    // marks' true sizes: the largest circle matches the biggest bubble exactly.
    expect(maxCircleRadius).toBeCloseTo(maxMarkRadius, 5);
  });

  /**
   * The one place the circles are allowed to depart from the marks. A beeswarm
   * sizes its dots [2, 10]; drawn literally, the key is a 20px smudge. Scale the
   * swatch up so it reads -- the labels still carry the true values.
   */
  it('enlarges the circles when the marks are too small to key legibly', () => {
    // Both the mark default ([2, 10]) and an explicit override ([2, 8]) -- the
    // beeswarm fixture sets the latter, and checking only the default missed it.
    const explicitRange: ChartSpec = {
      ...swarmSpec,
      encoding: {
        ...swarmSpec.encoding,
        size: { field: 'pop', type: 'quantitative', scale: { range: [2, 8] } },
      },
    } as ChartSpec;

    for (const spec of [swarmSpec, explicitRange]) {
      const circles = sizeLegendOf(spec)?.circles ?? [];
      expect(circles.length).toBeGreaterThanOrEqual(2);

      const maxRadius = Math.max(...circles.map((c) => c.radius));
      // Bigger than the beeswarm's own cap, and still ordered + distinguishable.
      expect(maxRadius).toBeGreaterThan(10);
      for (let i = 1; i < circles.length; i++) {
        expect(circles[i].radius).toBeLessThan(circles[i - 1].radius);
      }
    }
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
   * Clearing the plot is not enough: the color legend is in that same right
   * gutter. Both used to anchor to `chartArea.x + chartArea.width`, so the
   * graduated circles drew straight through the swatch labels -- reserving the
   * margin for both but placing them at the same origin. Caught on a rendered
   * bubble chart, not by a unit test, which is why this one exists.
   */
  it('stacks below the color legend in a shared right column, not on top of it', () => {
    const layout = compileChart(bubbles, OPTIONS);
    const size = layout.legends.find((l) => l.type === 'size');
    const color = layout.legends.find((l) => (l.channel ?? 'color') === 'color');
    expect(size).toBeDefined();
    expect(color).toBeDefined();
    if (!size || !color) return;

    const overlaps =
      size.bounds.x < color.bounds.x + color.bounds.width &&
      color.bounds.x < size.bounds.x + size.bounds.width &&
      size.bounds.y < color.bounds.y + color.bounds.height &&
      color.bounds.y < size.bounds.y + size.bounds.height;
    expect(overlaps).toBe(false);

    // Stacked, not side by side: the size legend starts below the color
    // legend's bottom edge, and the two share a left edge (one column).
    expect(size.bounds.y).toBeGreaterThanOrEqual(color.bounds.y + color.bounds.height);
    expect(size.bounds.x).toBe(color.bounds.x);
    // ...and the column still fits inside the SVG, horizontally and vertically.
    expect(size.bounds.x + size.bounds.width).toBeLessThanOrEqual(OPTIONS.width);
    expect(size.bounds.y + size.bounds.height).toBeLessThanOrEqual(OPTIONS.height);
  });

  /**
   * The point of stacking. Side by side, the two legends each carved their own
   * width out of the gutter (`color + size + 2*gap`) to draw two blocks that are
   * each only ~70px tall -- a 934px bubble chart spent ~213px of canvas on a key
   * that used a fraction of it. One shared column costs the wider of the two, and
   * the plot keeps the difference.
   */
  it('gives the plot back the width the second gutter column used to cost', () => {
    const withBoth = compileChart(bubbles, OPTIONS);
    const colorOnly = compileChart(
      { ...bubbles, encoding: { ...bubbles.encoding, size: undefined } } as ChartSpec,
      OPTIONS,
    );

    const size = withBoth.legends.find((l): l is SizeLegendLayout => l.type === 'size');
    const color = withBoth.legends.find((l) => (l.channel ?? 'color') === 'color');
    expect(size).toBeDefined();
    expect(color).toBeDefined();
    if (!size || !color) return;

    // Adding a size legend must not cost the plot a second column. It may still
    // narrow the plot (the size block can be wider than the color block), but by
    // at most the difference between them -- never by the size block's full width.
    const lostWidth = colorOnly.area.width - withBoth.area.width;
    expect(lostWidth).toBeLessThan(size.bounds.width);
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
    // 1.4B is the domain top and is always keyed; the interior values step down
    // through the domain and nice-round, so no label is a long unrounded number.
    const labels = circles.map((c) => c.label);
    expect(labels.length).toBeGreaterThan(1);
    expect(labels.some((l) => /^\d+(\.\d)?[KMB]?$/.test(l))).toBe(true);
  });

  /** CIRCLE_COUNT is 3. An unconditional "always key the top" prepend made it 4. */
  it('never keys more than three circles', () => {
    for (const domain of [
      [0, 1_400_000_000],
      [0.5, 3],
      [0, 6],
      [1, 1000],
    ] as [number, number][]) {
      const spec: ChartSpec = {
        ...bubbles,
        encoding: {
          ...bubbles.encoding,
          size: { field: 'pop', type: 'quantitative', scale: { domain } },
        },
      } as ChartSpec;
      const circles = sizeLegendOf(spec)?.circles ?? [];
      expect(circles.length).toBeLessThanOrEqual(3);
    }
  });

  /**
   * Stepping down from the top by halves collapsed on a narrow domain: for
   * [90, 100], both 50 and 25 fall below the floor and get dropped, leaving one
   * circle -- which keys nothing a reader didn't already assume.
   */
  it('still keys a graduated scale on a narrow domain', () => {
    for (const domain of [
      [90, 100],
      [7, 8],
    ] as [number, number][]) {
      const spec: ChartSpec = {
        ...bubbles,
        encoding: {
          ...bubbles.encoding,
          size: { field: 'pop', type: 'quantitative', scale: { domain } },
        },
      } as ChartSpec;
      const circles = sizeLegendOf(spec)?.circles ?? [];
      expect(circles.length).toBeGreaterThanOrEqual(2);
      // Strictly descending, so the circles are actually distinguishable.
      for (let i = 1; i < circles.length; i++) {
        expect(circles[i].radius).toBeLessThan(circles[i - 1].radius);
      }
    }
  });

  /** Circle *area* encodes magnitude; a negative magnitude has no area to encode. */
  it('is not emitted for a negative size domain', () => {
    const spec: ChartSpec = {
      ...bubbles,
      encoding: {
        ...bubbles.encoding,
        size: { field: 'pop', type: 'quantitative', scale: { domain: [-100, -10] } },
      },
    } as ChartSpec;
    expect(sizeLegendOf(spec)).toBeUndefined();
  });

  /** The block is a fixed ~90px and can't reflow; on a phone it eats the plot. */
  it('is suppressed below the compact width', () => {
    expect(sizeLegendOf(bubbles, { width: 380, height: 300 })).toBeUndefined();
    expect(sizeLegendOf(bubbles, { width: 800, height: 500 })).toBeDefined();
  });

  /** KEYED_SIZE_MARKS covers point AND beeswarm, but only point was exercised. */
  it('is emitted for a beeswarm, whose size channel is also keyed', () => {
    const legend = sizeLegendOf(swarmSpec);
    expect(legend).toBeDefined();
    expect((legend?.circles.length ?? 0) >= 2).toBe(true);
  });

  /**
   * A beeswarm's size range is [2, 10], so the whole circle stack is 20px tall.
   * Labels pinned to each circle's top edge piled on top of each other -- three
   * unreadable lines of text. Caught by the visual baseline, not by a unit test.
   */
  it('keeps labels legible when the circles are too small to space them', () => {
    for (const spec of [swarmSpec, bubbles]) {
      const circles = sizeLegendOf(spec)?.circles ?? [];
      expect(circles.length).toBeGreaterThanOrEqual(2);
      // Labels run top-down and never collide, whatever the radii.
      for (let i = 1; i < circles.length; i++) {
        expect(circles[i].labelY - circles[i - 1].labelY).toBeGreaterThanOrEqual(11);
      }
    }
  });
});

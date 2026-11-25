import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it } from 'vitest';
import { createChartSizer, FALLBACK_HEIGHT } from '../chart-sizing';

const spec: ChartSpec = {
  mark: 'point',
  data: [{ x: 0, y: 0 }],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};

const STRIP = 44;

/** A host whose box the test sets: 0 height means the host does not constrain height. */
function hostWithBox(width: number, initialHeight: number) {
  const container = document.createElement('div');
  document.body.append(container);
  let height = initialHeight;
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 }),
  });
  return {
    container,
    setHeight: (next: number) => {
      height = next;
    },
  };
}

const drawn = (width: number, height: number) =>
  ({ dimensions: { width, height } }) as unknown as ChartLayout;

afterEach(() => {
  document.body.replaceChildren();
});

describe('chart sizer with a reserved strip', () => {
  it('subtracts the reserved height from an explicit-height host', () => {
    const { container } = hostWithBox(600, 500);
    expect(createChartSizer(container, { reservedHeight: STRIP }).dimensions(spec).height).toBe(
      500 - STRIP,
    );
    expect(createChartSizer(container).dimensions(spec).height).toBe(500);
  });

  it('keeps an explicit-height host fixed after the chart and strip fill it', () => {
    const { container } = hostWithBox(600, 500);
    const sizer = createChartSizer(container, { reservedHeight: STRIP });
    sizer.dimensions(spec);
    sizer.rendered(drawn(600, 500 - STRIP));
    expect(sizer.shouldResize(600, 500)).toBe(false);
    expect(sizer.dimensions(spec).height).toBe(500 - STRIP);
  });

  it('holds the auto-height latch when the strip grows the host past the SVG', () => {
    const { container, setHeight } = hostWithBox(600, 0);
    const sizer = createChartSizer(container, { reservedHeight: STRIP });
    expect(sizer.dimensions(spec).height).toBe(FALLBACK_HEIGHT);
    sizer.rendered(drawn(600, 520));
    // The host wraps the 520px SVG plus the strip below it.
    setHeight(520 + STRIP);
    expect(sizer.shouldResize(600, 520 + STRIP)).toBe(false);
    expect(sizer.dimensions(spec).height).toBe(FALLBACK_HEIGHT);
  });

  it('still re-renders on a host-driven height change', () => {
    const { container, setHeight } = hostWithBox(600, 0);
    const sizer = createChartSizer(container, { reservedHeight: STRIP });
    sizer.dimensions(spec);
    sizer.rendered(drawn(600, 520));
    setHeight(700);
    expect(sizer.shouldResize(600, 700)).toBe(true);
  });
});

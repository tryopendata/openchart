import type { ChartLayout, ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { createChartSizer } from '../chart-sizing';

const spec: ChartSpec = {
  mark: 'point',
  data: [{ x: 0, y: 0 }],
  encoding: { x: { field: 'x', type: 'quantitative' }, y: { field: 'y', type: 'quantitative' } },
};

/** A host whose box the test sets, as a min-height host grown by the chart's own SVG would report it. */
function hostWithBox(width: number) {
  const container = document.createElement('div');
  document.body.append(container);
  let height = 0;
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

describe('chart sizer in a min-height host', () => {
  it('compiles against the host height, not the SVG that grew it', () => {
    const { container, setHeight } = hostWithBox(390);
    container.style.minHeight = '460px';
    setHeight(460);
    const sizer = createChartSizer(container);
    expect(sizer.dimensions(spec).height).toBe(460);
    sizer.rendered(drawn(390, 540));
    setHeight(540);
    expect(sizer.dimensions(spec).height).toBe(460);
    container.remove();
  });

  it('follows a min-height change while its own SVG still holds the host open', () => {
    const { container, setHeight } = hostWithBox(390);
    container.style.minHeight = '720px';
    setHeight(720);
    const sizer = createChartSizer(container);
    expect(sizer.dimensions(spec).height).toBe(720);
    sizer.rendered(drawn(390, 800));
    setHeight(800);
    // A breakpoint lowers the host's min-height; the 800px SVG keeps the box at 800.
    container.style.minHeight = '460px';
    expect(sizer.dimensions(spec).height).toBe(460);
    container.remove();
  });
});

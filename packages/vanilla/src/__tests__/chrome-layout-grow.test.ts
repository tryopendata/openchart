import type { ChartSpec } from '@opendata-ai/openchart-core';
import type { CompileOptions } from '@opendata-ai/openchart-engine';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { renderChartSVG } from '../svg-renderer';

// End-to-end coverage for chromeLayout: 'grow'. The engine grows the layout
// height, but the value that matters to a viewer is the rendered SVG's size.
// These tests drive compileChart -> renderChartSVG -> real SVG DOM so a
// regression that drops the grown height before the renderer (the exact failure
// mode this feature shipped with) is caught, not just the internal layout math.

const OPTS: CompileOptions = { width: 340, height: 500 };

// A long title that wraps to several lines on a narrow container, so the chrome
// height is a meaningful fraction of the budget.
const longTitleSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { r: 'A', p: 16 },
    { r: 'B', p: 41 },
    { r: 'C', p: 73 },
    { r: 'D', p: 84 },
  ],
  encoding: {
    x: { field: 'r', type: 'nominal' },
    y: { field: 'p', type: 'quantitative' },
  },
  chrome: {
    title:
      'A long headline that wraps to several lines on a narrow phone viewport and would compress the plot',
    subtitle: 'A supporting subtitle line that also wraps in the narrow layout here',
  },
};

function renderHeight(spec: ChartSpec, opts: CompileOptions): number {
  const container = createContainer();
  const layout = compileChart(spec, opts);
  const svg = renderChartSVG(layout, container);
  const viewBox = svg.getAttribute('viewBox');
  // viewBox is "0 0 <width> <height>"; the fourth token is the rendered height.
  return Number(viewBox!.split(' ')[3]);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('chromeLayout: grow (rendered SVG)', () => {
  it('renders a taller SVG than subtract for spec-level grow', () => {
    const subtract = renderHeight(longTitleSpec, OPTS);
    const grow = renderHeight({ ...longTitleSpec, chromeLayout: 'grow' }, OPTS);

    expect(subtract).toBe(500);
    expect(grow).toBeGreaterThan(subtract);
  });

  it('renders a taller SVG than subtract for option-level grow', () => {
    const subtract = renderHeight(longTitleSpec, OPTS);
    const grow = renderHeight(longTitleSpec, { ...OPTS, chromeLayout: 'grow' });

    expect(grow).toBeGreaterThan(subtract);
  });

  it('is a no-op when chromeLayout is omitted (default subtract)', () => {
    const omitted = renderHeight(longTitleSpec, OPTS);
    const explicit = renderHeight({ ...longTitleSpec, chromeLayout: 'subtract' }, OPTS);

    expect(omitted).toBe(explicit);
    expect(omitted).toBe(500);
  });
});

it('auto-height notes do not consume the top legend allowance', async () => {
  const { createAutoHeightContainer } = await import('../__test-fixtures__/dom');
  const { createChart } = await import('../mount');
  const spec: ChartSpec = {
    mark: 'point',
    chromeLayout: 'grow',
    animation: false,
    data: [
      { x: 0, y: 0, s: 'A' },
      { x: 10, y: 10, s: 'B' },
    ],
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      color: { field: 's', type: 'nominal' },
    },
    chrome: { title: 'Title' },
    legend: { position: 'top' },
  };
  const chart = createChart(createAutoHeightContainer(800), spec);
  const before = chart.layout;
  chart.update({
    ...spec,
    annotations: [
      { type: 'text', id: 'a', x: 1, y: 1, text: 'One', responsive: false },
      { type: 'text', id: 'b', x: 8, y: 8, text: 'Two', responsive: false },
    ],
  });
  const after = chart.layout;
  expect(after.area.height).toBeCloseTo(before.area.height, 5);
  expect(after.dimensions.height - before.dimensions.height).toBeCloseTo(
    after.chrome.noteBandHeight!,
    5,
  );
  chart.destroy();
});

it('auto-height facets consume engine growth once across updates', async () => {
  const { createAutoHeightContainer } = await import('../__test-fixtures__/dom');
  const { createChart } = await import('../mount');
  const spec: ChartSpec = {
    mark: 'point',
    chromeLayout: 'grow',
    animation: false,
    data: Array.from({ length: 6 }, (_, group) => [
      { x: 0, y: 0, group: String(group) },
      { x: 10, y: 10, group: String(group) },
    ]).flat(),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      facet: { field: 'group', type: 'nominal', columns: 1 },
    },
    chrome: { title: 'Six panels' },
  };
  const expected = compileChart(spec, { width: 390, height: 400 });
  const chart = createChart(createAutoHeightContainer(390), spec);
  expect(chart.layout.dimensions.height).toBeCloseTo(expected.dimensions.height);
  const initial = chart.layout.dimensions.height;
  chart.update(spec);
  expect(chart.layout.dimensions.height).toBe(initial);
  chart.destroy();
});

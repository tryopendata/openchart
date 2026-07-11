/**
 * Continuous color legend rendering: gradient bar for sequential color
 * scales, binned swatch row for threshold scales, opt-out via
 * legend: { show: false }, and shared-counter gradient IDs.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const heatmapSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', value: 4 },
    { month: 'Feb', value: 25 },
    { month: 'Mar', value: 47 },
    { month: 'Apr', value: 90 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'value', type: 'quantitative' },
  },
};

describe('continuous color legend rendering', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a gradient bar legend by default for sequential color', () => {
    const chart = createChart(container, heatmapSpec);

    const legend = container.querySelector('.oc-legend--continuous');
    expect(legend).not.toBeNull();

    const bar = legend!.querySelector('.oc-legend-gradient-bar');
    expect(bar).not.toBeNull();
    const fill = bar!.getAttribute('fill') ?? '';
    const match = fill.match(/^url\(#(oc-legend-gradient-\d+)\)$/);
    expect(match).not.toBeNull();

    // The referenced gradient def exists with stops.
    const grad = container.querySelector(`#${match![1]}`);
    expect(grad).not.toBeNull();
    expect(grad!.querySelectorAll('stop').length).toBeGreaterThanOrEqual(2);

    // Min and max labels render.
    const labels = Array.from(legend!.querySelectorAll('text')).map((t) => t.textContent);
    expect(labels).toContain('4');
    expect(labels).toContain('90');

    chart.destroy();
  });

  it('renders binned swatches for a threshold scale', () => {
    const spec: ChartSpec = {
      ...heatmapSpec,
      encoding: {
        ...heatmapSpec.encoding,
        color: {
          field: 'value',
          type: 'quantitative',
          scale: { type: 'threshold', domain: [20, 40, 60, 80] },
        },
      },
    };
    const chart = createChart(container, spec);

    const legend = container.querySelector('.oc-legend--continuous');
    expect(legend).not.toBeNull();
    expect(legend!.querySelectorAll('.oc-legend-bin')).toHaveLength(5);
    const labels = Array.from(legend!.querySelectorAll('text')).map((t) => t.textContent);
    expect(labels).toEqual(['20', '40', '60', '80']);

    chart.destroy();
  });

  it('is removed by legend: { show: false }', () => {
    const chart = createChart(container, { ...heatmapSpec, legend: { show: false } });
    expect(container.querySelector('.oc-legend--continuous')).toBeNull();
    chart.destroy();
  });
});

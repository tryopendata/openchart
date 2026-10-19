import type { ChartSpec } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { renderEndpointLabels } from '../renderers/endpoint-labels';

const input: ChartSpec = {
  mark: 'area',
  data: [
    { date: '2020-01-01', value: 20, series: 'A' },
    { date: '2021-01-01', value: 30, series: 'A' },
    { date: '2022-01-01', value: 40, series: 'A' },
    { date: '2020-01-01', value: 40, series: 'B' },
    { date: '2021-01-01', value: 50, series: 'B' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'series', type: 'nominal' },
  },
  endpointLabels: { anchor: 'band', placement: 'interior' },
};

describe('endpoint semantic rendering', () => {
  it('renders band names and qualified source endpoints without boundary circles', () => {
    const layout = compileChart(input, { width: 1024, height: 500 });
    const parent = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    renderEndpointLabels(parent, layout);
    expect(parent.querySelectorAll('.oc-area-interior-label').length).toBeGreaterThan(0);
    expect(parent.querySelectorAll('.oc-endpoint-marker')).toHaveLength(0);
    expect(parent.querySelectorAll('.oc-endpoint-date')).toHaveLength(2);
    const b = parent.querySelector('[data-endpoint-key="B"] .oc-endpoint-leader')!;
    const entry = layout.endpointLabels!.entries.find((item) => item.seriesKey === 'B')!;
    expect(Number(b.getAttribute('x2'))).toBe(entry.dataX);
    expect(Number(b.getAttribute('y2'))).toBe(entry.dataY);
    expect(parent.querySelector('[data-endpoint-key="B"]')?.getAttribute('aria-label')).toContain(
      '2021',
    );
  });
});

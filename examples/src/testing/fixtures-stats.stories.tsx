import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

export default { title: 'Testing / Static Stats Grammar' };
const rates = [
  {
    agent: 'claude',
    lower: 0.62,
    upper: 0.9,
    value: 0.8,
    text: 'Claude: 80%, interval 62–90%, n=40',
  },
  {
    agent: 'codex',
    lower: 0.7,
    upper: 0.96,
    value: 0.88,
    text: 'Codex: 88%, interval 70–96%, n=40',
  },
];
const interval: ChartSpec = {
  data: rates,
  mark: { type: 'errorbar', ticks: true },
  encoding: {
    x: { field: 'lower', type: 'quantitative', scale: { domain: [0, 1] } },
    x2: { field: 'upper', type: 'quantitative' },
    y: { field: 'agent', type: 'nominal' },
    description: { field: 'text' },
  },
  animation: false,
  watermark: false,
};
const estimate: ChartSpec = {
  data: rates,
  mark: { type: 'point', trendline: false },
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'agent', type: 'nominal' },
    description: { field: 'text' },
  },
  animation: false,
  watermark: false,
};
const layered: LayerSpec = {
  layer: [interval, estimate],
  a11y: { description: 'Each estimate retains its supplied interval and sample.' },
  animation: false,
  watermark: false,
};
export const HorizontalIntervals = () => <Chart spec={layered} style={{ height: 280 }} />;
export const VerticalIntervals = () => (
  <Chart
    spec={{
      data: rates,
      mark: { type: 'errorbar', ticks: true },
      encoding: {
        x: { field: 'agent', type: 'nominal' },
        y: { field: 'lower', type: 'quantitative', scale: { domain: [0, 1] } },
        y2: { field: 'upper', type: 'quantitative' },
        description: { field: 'text' },
      },
      animation: false,
      watermark: false,
    }}
    style={{ height: 280 }}
  />
);
export const RateCell = () => (
  <Chart
    spec={{ ...layered, display: 'sparkline', width: 120, height: 16, a11y: { hidden: true } }}
    style={{ height: 16 }}
  />
);
export const LonePublishedPoint = () => (
  <Chart
    spec={{
      data: [
        { day: '2026-10-11', value: null },
        { day: '2026-10-18', value: 0.85 },
        { day: '2026-10-25', value: null },
      ],
      mark: 'line',
      encoding: {
        x: { field: 'day', type: 'temporal' },
        y: { field: 'value', type: 'quantitative', scale: { domain: [0, 1] } },
        description: { value: '18 Oct: 85%, n=40' },
      },
      animation: false,
      watermark: false,
    }}
    style={{ height: 280 }}
  />
);
export const SegmentLabels = () => (
  <Chart
    spec={{
      data: [
        { dependency: 'runtime', major: 'v1', share: 85 },
        { dependency: 'runtime', major: 'v2', share: 15 },
      ],
      mark: 'bar',
      encoding: {
        x: { field: 'share', type: 'quantitative', stack: 'normalize' },
        y: { field: 'dependency', type: 'nominal' },
        color: { field: 'major', type: 'nominal' },
      },
      legend: { show: false },
      labels: { placement: 'inside', content: 'label value', format: 'percent' },
      animation: false,
      watermark: false,
    }}
    style={{ height: 220 }}
  />
);
export const RangeEndpointLabels = () => (
  <Chart
    spec={{
      data: [{ row: 'all', median: 14, p75: 26 }],
      mark: { type: 'range', style: 'bar' },
      encoding: {
        x: { field: 'median', type: 'quantitative', title: 'median', scale: { domain: [0, 35] } },
        x2: { field: 'p75', type: 'quantitative', title: 'p75' },
        y: { field: 'row', type: 'nominal' },
      },
      frame: { left: 48, right: 96 },
      labels: { density: 'all', content: 'label value', suffix: 'm' },
      animation: false,
      watermark: false,
    }}
    style={{ height: 220 }}
  />
);

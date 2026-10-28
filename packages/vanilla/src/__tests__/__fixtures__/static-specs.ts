import type {
  Annotation,
  BarListSpec,
  ChartSpec,
  DataRow,
  LayerSpec,
  ThemeConfig,
} from '@opendata-ai/openchart-core';

// RFC §8 fixtures are shared by the site contract, static goldens and gallery.
export function siteSpec<T extends ChartSpec | LayerSpec | BarListSpec>(spec: T): T {
  return spec;
}
export const siteTheme: ThemeConfig = { colors: { categorical: ['#0891b2', '#4170cb'] } };
export const finding = 'Published rates carry their interval and effective sample.';
export const span = ['2026-10-01', '2026-11-01'];
export const frame = { left: 48, right: 96 };
export const markers: Annotation[] = [
  {
    type: 'refline',
    x: '2026-10-20',
    label: '20 Oct 2026',
    style: 'dashed',
    labelPlacement: 'outside',
  },
];
export const agentDomain = ['claude', 'codex', 'cursor', 'opencode', 'other'];
export const rateRows = agentDomain
  .filter((agent) => agent !== 'codex')
  .map((agent, i) => ({
    agent,
    row: agent,
    lower: i === 0 ? 0 : 0.7,
    upper: i === 3 ? 1 : 0.95,
    value: i === 0 ? 0 : i === 3 ? 1 : 0.85,
    intervalText: `${i === 0 ? 0 : 70}-${i === 3 ? 100 : 95}% n=40`,
    rateText: `${agent}: 85% n=40`,
  }));
export function rateSpec(data: DataRow[] = rateRows, cell = true) {
  return siteSpec({
    data,
    layer: [
      {
        data,
        mark: { type: 'errorbar' },
        encoding: {
          x: {
            field: 'lower',
            type: 'quantitative',
            scale: { domain: [0, 1] },
            axis: { format: 'percent' },
          },
          x2: { field: 'upper', type: 'quantitative' },
          y: { field: 'agent', type: 'nominal', scale: { domain: agentDomain } },
          description: { field: 'intervalText', type: 'nominal' },
        },
      },
      {
        data,
        mark: 'point',
        encoding: {
          x: { field: 'value', type: 'quantitative' },
          y: { field: 'agent', type: 'nominal' },
          description: { field: 'rateText', type: 'nominal' },
        },
      },
    ],
    ...(cell
      ? { display: 'sparkline', width: 120, height: 16, a11y: { hidden: true } }
      : { frame: { left: 88 }, a11y: { description: finding } }),
    theme: siteTheme,
    watermark: false,
  });
}
export const historyRows = [
  { week: '2026-10-11', lower: 0.7, upper: 0.95, value: 0.85, pointText: '11 Oct: 85% n=40' },
  { week: '2026-10-18', lower: null, upper: null, value: null, pointText: '18 Oct: unpublished' },
  { week: '2026-10-25', lower: 0.75, upper: 0.98, value: 0.9, pointText: '25 Oct: 90% n=40' },
];
export const intervalRowText = 'Published Wilson interval';
export function historySpec(data: DataRow[] = historyRows) {
  const x = { field: 'week', type: 'temporal' as const, scale: { domain: span } };
  return siteSpec({
    data,
    layer: [
      {
        data,
        mark: 'area',
        encoding: {
          x,
          y: { field: 'lower', type: 'quantitative' },
          y2: { field: 'upper', type: 'quantitative' },
          opacity: { value: 0.2 },
          description: { value: intervalRowText },
        },
      },
      {
        data,
        mark: 'line',
        encoding: {
          x,
          y: { field: 'value', type: 'quantitative', scale: { domain: [0, 1] } },
          description: { value: 'Published green rate' },
        },
      },
      {
        data,
        mark: { type: 'point', trendline: false },
        encoding: {
          x,
          y: { field: 'value', type: 'quantitative', scale: { domain: [0, 1] } },
          description: { field: 'pointText', type: 'nominal' },
        },
      },
    ],
    annotations: markers,
    frame,
    a11y: { description: finding, table: false },
    theme: siteTheme,
    watermark: false,
  });
}
export const weeklyRows = [
  { day: '2026-10-25', preset: 'default', projects: 40, segmentText: 'default: 40 projects' },
  { day: '2026-10-25', preset: 'sandbox', projects: 25, segmentText: 'sandbox: 25 projects' },
];
export const longStep = 'x'.repeat(100);
export const stepRows = [
  { step: longStep, share: 0.35, group: 'steps', rowText: `${longStep}: 35%` },
  { step: 'environment', share: 0.1, group: 'env', rowText: 'environment: 10%' },
];
export function barlistSpec(data: DataRow[], extra: Partial<BarListSpec> = {}) {
  return siteSpec({
    type: 'barlist',
    data,
    encoding: {
      label: { field: 'step', type: 'nominal' },
      value: {
        field: 'share',
        type: 'quantitative',
        format: 'percent',
        scale: { domain: [0, 0.5] },
      },
      group: { field: 'group', type: 'nominal' },
      description: { field: 'rowText', type: 'nominal' },
    },
    sort: 'descending',
    height: 'auto',
    a11y: { description: finding },
    theme: siteTheme,
    watermark: false,
    ...extra,
  });
}
const timeRows = [{ row: 'all', median: 14, p75: 26, firstTest: 6 }];
export const siteSpecs = {
  rateCell: rateSpec([rateRows[1]]),
  countCell: siteSpec({
    data: [{ row: 'one', projects: 40, projectsText: '40 projects' }],
    mark: 'bar',
    display: 'sparkline',
    width: 120,
    height: 16,
    a11y: { hidden: true },
    encoding: {
      x: { field: 'projects', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'row', type: 'nominal' },
      description: { field: 'projectsText', type: 'nominal' },
    },
    watermark: false,
  }),
  sparkCell: siteSpec({
    data: [{ week: '2026-10-11', projects: 40, weekText: '11 Oct: 40 projects' }],
    mark: { type: 'line', stroke: '#0891b2' },
    display: 'sparkline',
    width: 120,
    height: 16,
    a11y: { hidden: true },
    encoding: {
      x: { field: 'week', type: 'temporal' },
      y: { field: 'projects', type: 'quantitative', scale: { domain: [0, 100] } },
      description: { field: 'weekText', type: 'nominal' },
    },
    watermark: false,
  }),
  byPreset: rateSpec(rateRows, false),
  byAgent: rateSpec(rateRows, false),
  timeToGreen: siteSpec({
    data: timeRows,
    layer: [
      {
        data: timeRows,
        mark: { type: 'range', style: 'bar' },
        encoding: {
          x: { field: 'median', type: 'quantitative', title: 'median' },
          x2: { field: 'p75', type: 'quantitative', title: 'p75' },
          y: { field: 'row', type: 'nominal' },
          description: { value: 'median 14 min to p75 26 min' },
        },
      },
      {
        data: timeRows,
        mark: 'tick',
        encoding: {
          x: { field: 'firstTest', type: 'quantitative' },
          y: { field: 'row', type: 'nominal' },
          description: { value: 'first passing test 6 min' },
        },
      },
    ],
    labels: { content: 'label value', suffix: 'm' },
    a11y: { description: finding },
    watermark: false,
  }),
  history: historySpec(),
  weekly: siteSpec({
    data: weeklyRows,
    mark: { type: 'bar', cornerRadius: 0 },
    encoding: {
      x: {
        field: 'day',
        type: 'temporal',
        interval: 'week',
        scale: { domain: span },
        axis: { format: '%b %-d' },
      },
      y: { field: 'projects', type: 'quantitative', stack: 'zero' },
      color: { field: 'preset', type: 'nominal', scale: { range: ['#0891b2', '#4170cb'] } },
      description: { field: 'segmentText', type: 'nominal' },
    },
    endpointLabels: true,
    annotations: markers,
    frame,
    a11y: { description: finding },
    watermark: false,
  }),
  stepFailures: barlistSpec(stepRows),
  keptAttach: barlistSpec(
    [
      { step: 'kept', share: 0.8, section: 'kept', rowText: 'kept: 80%' },
      { step: 'attach', share: 0.4, section: 'attach', rowText: 'attach: 40%' },
    ],
    {
      sort: null,
      encoding: {
        label: { field: 'step', type: 'nominal' },
        value: { field: 'share', type: 'quantitative', scale: { domain: [0, 1] } },
        group: { field: 'section', type: 'nominal' },
        description: { field: 'rowText', type: 'nominal' },
      },
    },
  ),
  lift: barlistSpec([{ step: 'A', share: 2, rowText: 'A: 2× as likely' }], {
    maxItems: 3,
    labels: { suffix: '× as likely' },
    annotations: [{ type: 'refline', x: 1 }],
    encoding: {
      label: { field: 'step', type: 'nominal' },
      value: { field: 'share', type: 'quantitative', scale: { domain: [0, 3] } },
      description: { field: 'rowText', type: 'nominal' },
    },
  }),
  majorShares: siteSpec({
    data: [
      { dependency: 'runtime', major: 'v1', share: 85, segmentText: 'v1 85%' },
      { dependency: 'runtime', major: 'v2', share: 15, segmentText: 'v2 15%' },
    ],
    mark: 'bar',
    encoding: {
      x: { field: 'share', type: 'quantitative', stack: 'normalize' },
      y: { field: 'dependency', type: 'nominal' },
      color: { field: 'major', type: 'nominal' },
      description: { field: 'segmentText', type: 'nominal' },
    },
    labels: { placement: 'inside', content: 'label value', format: 'percent' },
    a11y: { description: finding },
    watermark: false,
  }),
  shareOverTime: siteSpec({
    data: [
      { week: '2026-10-11', major: 'v1', share: 0.85, seriesText: 'v1 share' },
      { week: '2026-10-25', major: 'v1', share: 0.9, seriesText: 'v1 share' },
    ],
    mark: 'area',
    encoding: {
      x: { field: 'week', type: 'temporal' },
      y: { field: 'share', type: 'quantitative', stack: 'normalize' },
      color: { field: 'major', type: 'nominal' },
      description: { field: 'seriesText', type: 'nominal' },
    },
    endpointLabels: true,
    a11y: { description: finding },
    watermark: false,
  }),
};

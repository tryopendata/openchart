/**
 * Chrome-only rendering stories.
 *
 * Shows title, subtitle, source, and an empty chart area.
 * No mark renderers are registered yet (Phase 0), so the
 * chart area is blank. Chrome elements should render correctly.
 */

import type { ChartSpec } from '@openchart/core';
import { Chart } from '@openchart/react';

const spec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, country: 'US' },
    { date: '2021-01-01', value: 40, country: 'US' },
    { date: '2022-01-01', value: 30, country: 'US' },
    { date: '2020-01-01', value: 15, country: 'UK' },
    { date: '2021-01-01', value: 35, country: 'UK' },
    { date: '2022-01-01', value: 45, country: 'UK' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'GDP Growth Rate',
    subtitle: 'Annual percentage change, 2020-2022',
    source: 'Source: World Bank Open Data',
  },
};

export const ChromeWithTitleSubtitleSource = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={spec} />
  </div>
);

const minimalSpec: ChartSpec = {
  type: 'bar',
  data: [
    { name: 'Apples', value: 30 },
    { name: 'Bananas', value: 50 },
    { name: 'Cherries', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
  chrome: {
    title: 'Fruit Production',
  },
};

export const ChromeTitleOnly = () => (
  <div style={{ width: 600, height: 300 }}>
    <Chart spec={minimalSpec} />
  </div>
);

const fullChromeSpec: ChartSpec = {
  ...spec,
  chrome: {
    title: 'GDP Growth Rate',
    subtitle: 'Annual percentage change, 2020-2022',
    source: 'Source: World Bank Open Data',
    byline: 'By OpenData Team',
    footer: 'Note: Values are seasonally adjusted',
  },
};

export const ChromeAllElements = () => (
  <div style={{ width: 600, height: 450 }}>
    <Chart spec={fullChromeSpec} />
  </div>
);

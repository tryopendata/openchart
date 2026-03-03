/**
 * Dark mode stories.
 *
 * Dark mode is controlled by Ladle's theme toggle (gear icon, bottom-left).
 * Charts automatically pick up the dark mode setting from VizThemeProvider context.
 *
 * Individual charts can still override with an explicit darkMode prop.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

const spec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 10, region: 'North' },
    { date: '2021-01-01', value: 30, region: 'North' },
    { date: '2022-01-01', value: 25, region: 'North' },
    { date: '2020-01-01', value: 20, region: 'South' },
    { date: '2021-01-01', value: 15, region: 'South' },
    { date: '2022-01-01', value: 40, region: 'South' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
    color: { field: 'region', type: 'nominal' },
  },
  chrome: {
    title: 'Regional Performance',
    subtitle: 'North vs South, 2020-2022',
    source: 'Source: Internal reports',
  },
};

/** Follows Ladle's theme toggle for dark/light mode. */
export const Default = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={spec} />
  </div>
);

/** Always light, regardless of Ladle's theme toggle. */
export const ForcedLight = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={spec} darkMode="off" />
  </div>
);

/** Always dark, regardless of Ladle's theme toggle. */
export const ForcedDark = () => (
  <div style={{ width: 600, height: 400, background: '#1a1a2e' }}>
    <Chart spec={spec} darkMode="force" />
  </div>
);

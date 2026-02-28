/**
 * Parity test: Multi-series line chart with date axis and annotations.
 *
 * Demonstrates Infrographic-comparable quality for editorial line charts.
 * Uses real-world GDP growth data with recession annotation and reference line.
 */

import type { ChartSpec } from '@openchart/core';
import { Chart } from '@openchart/react';

// ---------------------------------------------------------------------------
// GDP Growth: Multi-series line with annotations
// ---------------------------------------------------------------------------

const gdpLineSpec: ChartSpec = {
  type: 'line',
  data: [
    // United States
    { date: '2018-01-01', gdp: 3.0, country: 'United States' },
    { date: '2018-07-01', gdp: 2.8, country: 'United States' },
    { date: '2019-01-01', gdp: 2.2, country: 'United States' },
    { date: '2019-07-01', gdp: 2.1, country: 'United States' },
    { date: '2020-01-01', gdp: 0.3, country: 'United States' },
    { date: '2020-07-01', gdp: -3.4, country: 'United States' },
    { date: '2021-01-01', gdp: 5.7, country: 'United States' },
    { date: '2021-07-01', gdp: 5.9, country: 'United States' },
    { date: '2022-01-01', gdp: 2.1, country: 'United States' },
    { date: '2022-07-01', gdp: 1.9, country: 'United States' },
    { date: '2023-01-01', gdp: 2.5, country: 'United States' },
    // Euro Area
    { date: '2018-01-01', gdp: 1.8, country: 'Euro Area' },
    { date: '2018-07-01', gdp: 1.6, country: 'Euro Area' },
    { date: '2019-01-01', gdp: 1.3, country: 'Euro Area' },
    { date: '2019-07-01', gdp: 1.2, country: 'Euro Area' },
    { date: '2020-01-01', gdp: -0.1, country: 'Euro Area' },
    { date: '2020-07-01', gdp: -6.4, country: 'Euro Area' },
    { date: '2021-01-01', gdp: 5.3, country: 'Euro Area' },
    { date: '2021-07-01', gdp: 5.2, country: 'Euro Area' },
    { date: '2022-01-01', gdp: 3.4, country: 'Euro Area' },
    { date: '2022-07-01', gdp: 2.3, country: 'Euro Area' },
    { date: '2023-01-01', gdp: 0.5, country: 'Euro Area' },
    // China
    { date: '2018-01-01', gdp: 6.8, country: 'China' },
    { date: '2018-07-01', gdp: 6.5, country: 'China' },
    { date: '2019-01-01', gdp: 6.1, country: 'China' },
    { date: '2019-07-01', gdp: 5.9, country: 'China' },
    { date: '2020-01-01', gdp: -6.8, country: 'China' },
    { date: '2020-07-01', gdp: 4.9, country: 'China' },
    { date: '2021-01-01', gdp: 8.1, country: 'China' },
    { date: '2021-07-01', gdp: 4.0, country: 'China' },
    { date: '2022-01-01', gdp: 3.0, country: 'China' },
    { date: '2022-07-01', gdp: 2.9, country: 'China' },
    { date: '2023-01-01', gdp: 5.2, country: 'China' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'gdp', type: 'quantitative', axis: { label: 'GDP Growth (%)' } },
    color: { field: 'country', type: 'nominal' },
  },
  annotations: [
    {
      type: 'range',
      x1: '2020-01-01',
      x2: '2020-12-01',
      label: 'COVID-19 recession',
      fill: '#ff6b6b',
      opacity: 0.1,
    },
    {
      type: 'refline',
      y: 0,
      label: 'Zero growth',
      style: 'dashed',
      stroke: '#999999',
    },
  ],
  chrome: {
    title: 'GDP Growth Divergence',
    subtitle: 'Annual GDP growth rate by major economy, 2018-2023',
    source: 'Source: World Bank, IMF World Economic Outlook',
  },
};

export const GDPGrowth = () => (
  <div style={{ width: 700, height: 440 }}>
    <Chart spec={gdpLineSpec} />
  </div>
);

export const GDPGrowthCompact = () => (
  <div style={{ width: 320, height: 300 }}>
    <Chart spec={gdpLineSpec} />
  </div>
);

export const GDPGrowthWide = () => (
  <div style={{ width: 1200, height: 500 }}>
    <Chart spec={gdpLineSpec} />
  </div>
);

export const GDPGrowthDarkMode = () => (
  <div style={{ width: 700, height: 440 }}>
    <Chart spec={gdpLineSpec} darkMode="force" />
  </div>
);

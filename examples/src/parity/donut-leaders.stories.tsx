/**
 * Parity test: Donut chart with leader line labels.
 *
 * Demonstrates Infrographic-comparable quality for editorial pie/donut charts.
 * Uses real-world global smartphone market share data.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Smartphone Market Share: Donut with leader lines
// ---------------------------------------------------------------------------

const donutSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 40 },
  data: [
    { brand: 'Apple', share: 23.0 },
    { brand: 'Samsung', share: 16.0 },
    { brand: 'Xiaomi', share: 14.0 },
    { brand: 'Transsion', share: 9.0 },
    { brand: 'vivo', share: 8.5 },
    { brand: 'OPPO', share: 8.0 },
    { brand: 'Others', share: 21.5 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'brand', type: 'nominal' },
  },
  chrome: {
    title: 'Apple reclaimed the top spot from Samsung in Q4',
    subtitle: 'Global smartphone market share by vendor, Q4 2024 (%)',
    source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  },
};

export const SmartphoneMarket = () => (
  <div className="story-chart" style={{ height: 500 }}>
    <Chart spec={donutSpec} />
  </div>
);

const compactDonutSpec: ChartSpec = {
  ...donutSpec,
  labels: { density: 'none' },
  chrome: {
    title: 'Apple Leads Phones',
    subtitle: 'Smartphone market share, Q4 2024 (%)',
    source: 'Source: IDC',
  },
};

export const SmartphoneMarketCompact = () => (
  <div style={{ width: 320, height: 380 }}>
    <Chart spec={compactDonutSpec} />
  </div>
);

export const SmartphoneMarketWide = () => (
  <div style={{ width: 1200, height: 600 }}>
    <Chart spec={donutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Browser Market Share: Pie (non-donut variant)
// ---------------------------------------------------------------------------

const pieSpec: ChartSpec = {
  mark: 'arc',
  data: [
    { browser: 'Chrome', share: 63.6 },
    { browser: 'Safari', share: 19.8 },
    { browser: 'Edge', share: 5.3 },
    { browser: 'Firefox', share: 2.9 },
    { browser: 'Samsung Internet', share: 2.6 },
    { browser: 'Opera', share: 2.4 },
    { browser: 'Others', share: 3.4 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'browser', type: 'nominal' },
  },
  chrome: {
    title: 'Chrome dominates with nearly two-thirds of the browser market',
    subtitle: 'Global desktop and mobile browser share, January 2024 (%)',
    source: 'Source: StatCounter Global Stats',
  },
};

export const BrowserMarket = () => (
  <div className="story-chart" style={{ height: 500 }}>
    <Chart spec={pieSpec} />
  </div>
);

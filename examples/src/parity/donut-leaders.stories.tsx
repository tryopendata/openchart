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
  type: 'donut',
  data: [
    { brand: 'Samsung', share: 20.0 },
    { brand: 'Apple', share: 24.1 },
    { brand: 'Xiaomi', share: 12.5 },
    { brand: 'OPPO', share: 8.8 },
    { brand: 'vivo', share: 8.1 },
    { brand: 'Transsion', share: 7.3 },
    { brand: 'Others', share: 19.2 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'brand', type: 'nominal' },
  },
  chrome: {
    title: 'Global Smartphone Market Share',
    subtitle: 'Market share by vendor, Q3 2023',
    source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  },
};

export const SmartphoneMarket = () => (
  <div style={{ width: 550, height: 500 }}>
    <Chart spec={donutSpec} />
  </div>
);

export const SmartphoneMarketCompact = () => (
  <div style={{ width: 320, height: 380 }}>
    <Chart spec={donutSpec} />
  </div>
);

export const SmartphoneMarketWide = () => (
  <div style={{ width: 1200, height: 600 }}>
    <Chart spec={donutSpec} />
  </div>
);

export const SmartphoneMarketDarkMode = () => (
  <div style={{ width: 550, height: 500 }}>
    <Chart spec={donutSpec} darkMode="force" />
  </div>
);

// ---------------------------------------------------------------------------
// Browser Market Share: Pie (non-donut variant)
// ---------------------------------------------------------------------------

const pieSpec: ChartSpec = {
  type: 'pie',
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
    title: 'Web Browser Market Share',
    subtitle: 'Global desktop and mobile combined, January 2024',
    source: 'Source: StatCounter Global Stats',
  },
};

export const BrowserMarket = () => (
  <div style={{ width: 550, height: 500 }}>
    <Chart spec={pieSpec} />
  </div>
);

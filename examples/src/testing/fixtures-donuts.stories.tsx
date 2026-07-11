/**
 * Testing / Fixtures — pie & donut pinned e2e stories.
 *
 * Verbatim copies of showcase story exports pinned by the Playwright visual
 * and invariant suites. Copied here (with .story- classes renamed to .tfix-)
 * so the gallery redesign can delete/rewrite the originals without breaking
 * the pixel baselines. Do not restyle: this content is a frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// SmartphoneMarket (from editorial/donut-leaders.stories.tsx)
// ---------------------------------------------------------------------------

const donutSpec: ChartSpec = {
  animation: true,
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
  <div className="tfix-chart tfix-h-500">
    <Chart spec={donutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ElectricityMix (from editorial/donut-comparison.stories.tsx)
// ---------------------------------------------------------------------------

// Muted palette with Renewables (index 4) vivid green to highlight the growth story.
// Domain order (by descending value in 2010): Coal, Natural Gas, Hydro, Nuclear, Renewables, Oil & Other
const highlightPalette = ['#b0b0b0', '#c8c8c8', '#a0a0a0', '#d0d0d0', '#2d8a4e', '#e0e0e0'];

const electricity2010: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 40 },
  data: [
    { source: 'Coal', share: 40.6 },
    { source: 'Natural Gas', share: 22.2 },
    { source: 'Hydro', share: 16.3 },
    { source: 'Nuclear', share: 12.8 },
    { source: 'Renewables', share: 3.5 },
    { source: 'Oil & Other', share: 4.6 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  legend: { position: 'bottom' },
  theme: { colors: { categorical: highlightPalette } },
  chrome: {
    subtitle: 'in 2010',
  },
};

const electricity2023: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 40 },
  data: [
    { source: 'Coal', share: 35.2 },
    { source: 'Natural Gas', share: 22.5 },
    { source: 'Hydro', share: 14.8 },
    { source: 'Nuclear', share: 9.2 },
    { source: 'Renewables', share: 15.6 },
    { source: 'Oil & Other', share: 2.7 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  legend: { position: 'bottom' },
  theme: { colors: { categorical: highlightPalette } },
  chrome: {
    subtitle: 'in 2023',
  },
};

export const ElectricityMix = () => (
  <div className="tfix-chart tfix-editorial">
    <div className="tfix-pad-top">
      <h2 className="tfix-editorial-title">Renewables have quadrupled their share since 2010</h2>
      <p className="tfix-editorial-subtitle">
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div className="tfix-flex-gap-16 tfix-pad-sides">
      <div className="tfix-flex-1 tfix-h-400">
        <Chart spec={electricity2010} />
      </div>
      <div className="tfix-flex-1 tfix-h-400">
        <Chart spec={electricity2023} />
      </div>
    </div>
    <p className="tfix-editorial-source tfix-pad-sides">Source: IEA World Energy Outlook</p>
  </div>
);

/**
 * Parity test: Side-by-side donut charts.
 *
 * Two donut charts comparing compositions across time periods.
 * Demonstrates multi-chart layout in a single story.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Global Electricity Mix: 2010 vs 2023
// ---------------------------------------------------------------------------

// Muted palette with Renewables (index 4) vivid green to highlight the growth story.
// Domain order (by descending value in 2010): Coal, Natural Gas, Hydro, Nuclear, Renewables, Oil & Other
const highlightPalette = ['#b0b0b0', '#c8c8c8', '#a0a0a0', '#d0d0d0', '#2d8a4e', '#e0e0e0'];

const electricity2010: ChartSpec = {
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
  <div className="story-chart story-editorial">
    <div className="story-pad-top">
      <h2 className="story-editorial-title">Renewables have quadrupled their share since 2010</h2>
      <p className="story-editorial-subtitle">
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div className="story-flex-gap-16 story-pad-sides">
      <div className="story-flex-1 story-h-400">
        <Chart spec={electricity2010} />
      </div>
      <div className="story-flex-1 story-h-400">
        <Chart spec={electricity2023} />
      </div>
    </div>
    <p className="story-editorial-source story-pad-sides">Source: IEA World Energy Outlook</p>
  </div>
);

const compactBase = {
  labels: { density: 'none' as const },
  legend: { show: false },
};
const compact2010: ChartSpec = {
  ...electricity2010,
  ...compactBase,
  chrome: { subtitle: 'in 2010', source: 'IEA World Energy Outlook' },
};
const compact2023: ChartSpec = {
  ...electricity2023,
  ...compactBase,
  chrome: { subtitle: 'in 2023', source: 'IEA World Energy Outlook' },
};

export const ElectricityMixCompact = () => (
  <div className="story-max-w-500 story-editorial">
    <div className="story-pad-top">
      <h2 className="story-editorial-title-sm">Renewables quadrupled since 2010</h2>
      <p className="story-editorial-subtitle-sm">Global electricity generation by source (%)</p>
    </div>
    <div className="story-flex-gap-8 story-pad-sides">
      <div className="story-flex-1 story-h-280">
        <Chart spec={compact2010} />
      </div>
      <div className="story-flex-1 story-h-280">
        <Chart spec={compact2023} />
      </div>
    </div>
  </div>
);

export const ElectricityMixWide = () => (
  <div className="story-max-w-1200 story-editorial">
    <div className="story-pad-top">
      <h2 className="story-editorial-title">Renewables have quadrupled their share since 2010</h2>
      <p className="story-editorial-subtitle">
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div className="story-flex-gap-32 story-pad-sides">
      <div className="story-flex-1 story-h-420">
        <Chart spec={electricity2010} />
      </div>
      <div className="story-flex-1 story-h-420">
        <Chart spec={electricity2023} />
      </div>
    </div>
    <p className="story-editorial-source story-pad-sides">Source: IEA World Energy Outlook</p>
  </div>
);

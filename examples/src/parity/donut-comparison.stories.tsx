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
  <div className="story-chart">
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
        Renewables have quadrupled their share since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 14, opacity: 0.55 }}>
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div style={{ display: 'flex', gap: 16, padding: '0 16px' }}>
      <div style={{ flex: 1, height: 360 }}>
        <Chart spec={electricity2010} />
      </div>
      <div style={{ flex: 1, height: 360 }}>
        <Chart spec={electricity2023} />
      </div>
    </div>
    <p
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        opacity: 0.4,
        padding: '0 16px 16px',
        margin: 0,
      }}
    >
      Source: IEA World Energy Outlook
    </p>
  </div>
);

const compactSpec: ChartSpec = {
  ...electricity2023,
  labels: { density: 'none' },
};
const compact2010: ChartSpec = { ...compactSpec, ...electricity2010, labels: { density: 'none' } };

export const ElectricityMixCompact = () => (
  <div style={{ maxWidth: 500 }}>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
        Renewables quadrupled since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.55 }}>
        Global electricity generation by source (%)
      </p>
    </div>
    <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
      <div style={{ flex: 1, height: 260 }}>
        <Chart spec={compact2010} />
      </div>
      <div style={{ flex: 1, height: 260 }}>
        <Chart spec={compactSpec} />
      </div>
    </div>
    <p
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 11,
        opacity: 0.4,
        padding: '0 16px 16px',
        margin: 0,
      }}
    >
      Source: IEA World Energy Outlook
    </p>
  </div>
);

export const ElectricityMixWide = () => (
  <div style={{ maxWidth: 1200 }}>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
        Renewables have quadrupled their share since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 14, opacity: 0.55 }}>
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div style={{ display: 'flex', gap: 32, padding: '0 16px' }}>
      <div style={{ flex: 1, height: 420 }}>
        <Chart spec={electricity2010} />
      </div>
      <div style={{ flex: 1, height: 420 }}>
        <Chart spec={electricity2023} />
      </div>
    </div>
    <p
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 12,
        opacity: 0.4,
        padding: '0 16px 16px',
        margin: 0,
      }}
    >
      Source: IEA World Energy Outlook
    </p>
  </div>
);

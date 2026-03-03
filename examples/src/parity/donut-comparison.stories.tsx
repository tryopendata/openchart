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

const electricity2010: ChartSpec = {
  type: 'donut',
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
  chrome: {
    subtitle: 'in 2010',
  },
};

const electricity2023: ChartSpec = {
  type: 'donut',
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
  chrome: {
    subtitle: 'in 2023',
  },
};

export const ElectricityMix = () => (
  <div>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
        Renewables have quadrupled their share since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: '#666' }}>
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
        color: '#999',
        padding: '0 16px 16px',
        margin: 0,
      }}
    >
      Source: IEA World Energy Outlook
    </p>
  </div>
);

export const ElectricityMixCompact = () => (
  <div style={{ maxWidth: 400 }}>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>
        Renewables have quadrupled their share since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 16px' }}>
      <div style={{ height: 300 }}>
        <Chart spec={electricity2010} />
      </div>
      <div style={{ height: 300 }}>
        <Chart spec={electricity2023} />
      </div>
    </div>
  </div>
);

export const ElectricityMixDarkMode = () => (
  <div style={{ background: '#1a1a1a' }}>
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px 16px 0',
        color: '#e0e0e0',
      }}
    >
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>
        Renewables have quadrupled their share since 2010
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: '#999' }}>
        Share of global electricity generation by source (%)
      </p>
    </div>
    <div style={{ display: 'flex', gap: 16, padding: '0 16px' }}>
      <div style={{ flex: 1, height: 360 }}>
        <Chart spec={electricity2010} darkMode="force" />
      </div>
      <div style={{ flex: 1, height: 360 }}>
        <Chart spec={electricity2023} darkMode="force" />
      </div>
    </div>
  </div>
);

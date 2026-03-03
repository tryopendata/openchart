/**
 * Parity test: Stacked column chart with legend.
 *
 * Demonstrates Infrographic-comparable quality for editorial column charts.
 * Uses real-world energy source data showing the transition over time.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Global Energy Mix: Stacked columns by source
// ---------------------------------------------------------------------------

const energyColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    // Fossil fuels
    { year: '2015', energy: 32.3, source: 'Oil' },
    { year: '2016', energy: 32.8, source: 'Oil' },
    { year: '2017', energy: 33.4, source: 'Oil' },
    { year: '2018', energy: 33.9, source: 'Oil' },
    { year: '2019', energy: 33.1, source: 'Oil' },
    { year: '2020', energy: 30.0, source: 'Oil' },
    { year: '2021', energy: 31.7, source: 'Oil' },
    { year: '2022', energy: 32.0, source: 'Oil' },
    // Natural gas
    { year: '2015', energy: 23.1, source: 'Natural Gas' },
    { year: '2016', energy: 23.5, source: 'Natural Gas' },
    { year: '2017', energy: 23.7, source: 'Natural Gas' },
    { year: '2018', energy: 24.2, source: 'Natural Gas' },
    { year: '2019', energy: 24.4, source: 'Natural Gas' },
    { year: '2020', energy: 23.6, source: 'Natural Gas' },
    { year: '2021', energy: 24.4, source: 'Natural Gas' },
    { year: '2022', energy: 24.0, source: 'Natural Gas' },
    // Coal
    { year: '2015', energy: 28.0, source: 'Coal' },
    { year: '2016', energy: 27.2, source: 'Coal' },
    { year: '2017', energy: 27.1, source: 'Coal' },
    { year: '2018', energy: 27.2, source: 'Coal' },
    { year: '2019', energy: 26.8, source: 'Coal' },
    { year: '2020', energy: 25.0, source: 'Coal' },
    { year: '2021', energy: 26.9, source: 'Coal' },
    { year: '2022', energy: 26.7, source: 'Coal' },
    // Renewables
    { year: '2015', energy: 9.7, source: 'Renewables' },
    { year: '2016', energy: 10.2, source: 'Renewables' },
    { year: '2017', energy: 10.6, source: 'Renewables' },
    { year: '2018', energy: 11.0, source: 'Renewables' },
    { year: '2019', energy: 11.5, source: 'Renewables' },
    { year: '2020', energy: 12.6, source: 'Renewables' },
    { year: '2021', energy: 12.8, source: 'Renewables' },
    { year: '2022', energy: 14.0, source: 'Renewables' },
    // Nuclear
    { year: '2015', energy: 4.4, source: 'Nuclear' },
    { year: '2016', energy: 4.5, source: 'Nuclear' },
    { year: '2017', energy: 4.3, source: 'Nuclear' },
    { year: '2018', energy: 4.3, source: 'Nuclear' },
    { year: '2019', energy: 4.3, source: 'Nuclear' },
    { year: '2020', energy: 4.3, source: 'Nuclear' },
    { year: '2021', energy: 4.2, source: 'Nuclear' },
    { year: '2022', energy: 4.0, source: 'Nuclear' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'energy', type: 'quantitative', axis: { label: 'Share of global energy (%)' } },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Global Primary Energy Mix',
    subtitle: 'Share of global primary energy consumption by source, 2015-2022',
    source: 'Source: Our World in Data, BP Statistical Review',
  },
};

export const EnergyMix = () => (
  <div style={{ width: 700, height: 450 }}>
    <Chart spec={energyColumnSpec} />
  </div>
);

export const EnergyMixCompact = () => (
  <div style={{ width: 320, height: 350 }}>
    <Chart spec={energyColumnSpec} />
  </div>
);

export const EnergyMixWide = () => (
  <div style={{ width: 1200, height: 500 }}>
    <Chart spec={energyColumnSpec} />
  </div>
);

export const EnergyMixDarkMode = () => (
  <div style={{ width: 700, height: 450 }}>
    <Chart spec={energyColumnSpec} darkMode="force" />
  </div>
);

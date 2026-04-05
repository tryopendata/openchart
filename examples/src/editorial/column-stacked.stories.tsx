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
  animation: true,
  mark: 'bar',
  data: [
    // Oil (normalized so each year sums to 100%)
    { year: '2015', energy: 33.1, source: 'Oil' },
    { year: '2016', energy: 33.4, source: 'Oil' },
    { year: '2017', energy: 33.7, source: 'Oil' },
    { year: '2018', energy: 33.7, source: 'Oil' },
    { year: '2019', energy: 33.1, source: 'Oil' },
    { year: '2020', energy: 31.4, source: 'Oil' },
    { year: '2021', energy: 31.7, source: 'Oil' },
    { year: '2022', energy: 31.8, source: 'Oil' },
    // Natural Gas
    { year: '2015', energy: 23.7, source: 'Natural Gas' },
    { year: '2016', energy: 23.9, source: 'Natural Gas' },
    { year: '2017', energy: 23.9, source: 'Natural Gas' },
    { year: '2018', energy: 24.1, source: 'Natural Gas' },
    { year: '2019', energy: 24.4, source: 'Natural Gas' },
    { year: '2020', energy: 24.7, source: 'Natural Gas' },
    { year: '2021', energy: 24.4, source: 'Natural Gas' },
    { year: '2022', energy: 23.8, source: 'Natural Gas' },
    // Coal
    { year: '2015', energy: 28.7, source: 'Coal' },
    { year: '2016', energy: 27.7, source: 'Coal' },
    { year: '2017', energy: 27.3, source: 'Coal' },
    { year: '2018', energy: 27.0, source: 'Coal' },
    { year: '2019', energy: 26.8, source: 'Coal' },
    { year: '2020', energy: 26.2, source: 'Coal' },
    { year: '2021', energy: 26.9, source: 'Coal' },
    { year: '2022', energy: 26.5, source: 'Coal' },
    // Renewables
    { year: '2015', energy: 9.9, source: 'Renewables' },
    { year: '2016', energy: 10.4, source: 'Renewables' },
    { year: '2017', energy: 10.7, source: 'Renewables' },
    { year: '2018', energy: 10.9, source: 'Renewables' },
    { year: '2019', energy: 11.5, source: 'Renewables' },
    { year: '2020', energy: 13.2, source: 'Renewables' },
    { year: '2021', energy: 12.8, source: 'Renewables' },
    { year: '2022', energy: 13.9, source: 'Renewables' },
    // Nuclear
    { year: '2015', energy: 4.6, source: 'Nuclear' },
    { year: '2016', energy: 4.6, source: 'Nuclear' },
    { year: '2017', energy: 4.4, source: 'Nuclear' },
    { year: '2018', energy: 4.3, source: 'Nuclear' },
    { year: '2019', energy: 4.2, source: 'Nuclear' },
    { year: '2020', energy: 4.5, source: 'Nuclear' },
    { year: '2021', energy: 4.2, source: 'Nuclear' },
    { year: '2022', energy: 4.0, source: 'Nuclear' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'energy', type: 'quantitative', axis: { title: 'Share of global energy (%)' } },
    color: { field: 'source', type: 'nominal' },
  },
  labels: { density: 'none' },
  chrome: {
    title: "Fossil fuels still supply over 80% of the world's energy",
    subtitle: 'Share of global primary energy consumption by source, 2015-2022 (%)',
    source: 'Source: Our World in Data, BP Statistical Review of World Energy',
  },
};

export const EnergyMix = () => (
  <div className="story-chart story-h-450">
    <Chart spec={energyColumnSpec} />
  </div>
);

const compactEnergySpec: ChartSpec = {
  ...energyColumnSpec,
  encoding: {
    ...energyColumnSpec.encoding,
    x: { field: 'year', type: 'ordinal', axis: { tickCount: 4 } },
  },
  chrome: {
    ...energyColumnSpec.chrome,
    title: 'Fossil Fuels Still Dominate',
    subtitle: 'Global energy mix by source, 2015-2022 (%)',
    source: 'Source: Our World in Data, BP Statistical Review',
  },
};

export const EnergyMixCompact = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '320px', '--h': '350px' } as React.CSSProperties}
  >
    <Chart spec={compactEnergySpec} />
  </div>
);

export const EnergyMixWide = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '1200px', '--h': '500px' } as React.CSSProperties}
  >
    <Chart spec={energyColumnSpec} />
  </div>
);

/**
 * Parity test: Bubble scatter plot with log scale.
 *
 * Scatter chart with size encoding (population), color by continent,
 * logarithmic x-axis, and editorial annotations.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// CO2 Emissions vs Renewable Energy: Bubble scatter
// ---------------------------------------------------------------------------

const emissionsSpec: ChartSpec = {
  animation: true,
  mark: 'point',
  data: [
    // Asia
    { country: 'China', co2: 8.0, renewables: 16, pop: 1425, continent: 'Asia' },
    { country: 'India', co2: 2.0, renewables: 22, pop: 1428, continent: 'Asia' },
    { country: 'Japan', co2: 8.5, renewables: 12, pop: 124, continent: 'Asia' },
    { country: 'South Korea', co2: 12.1, renewables: 5, pop: 52, continent: 'Asia' },
    { country: 'Indonesia', co2: 2.3, renewables: 17, pop: 277, continent: 'Asia' },
    { country: 'Thailand', co2: 3.8, renewables: 15, pop: 72, continent: 'Asia' },
    // Europe
    { country: 'Germany', co2: 8.1, renewables: 42, pop: 84, continent: 'Europe' },
    { country: 'France', co2: 4.5, renewables: 25, pop: 68, continent: 'Europe' },
    { country: 'UK', co2: 5.0, renewables: 38, pop: 67, continent: 'Europe' },
    { country: 'Sweden', co2: 3.5, renewables: 60, pop: 10, continent: 'Europe' },
    { country: 'Norway', co2: 7.5, renewables: 98, pop: 5, continent: 'Europe' },
    { country: 'Poland', co2: 8.3, renewables: 17, pop: 38, continent: 'Europe' },
    { country: 'Italy', co2: 5.3, renewables: 20, pop: 59, continent: 'Europe' },
    { country: 'Spain', co2: 5.1, renewables: 35, pop: 48, continent: 'Europe' },
    // Americas
    { country: 'USA', co2: 14.7, renewables: 21, pop: 339, continent: 'Americas' },
    { country: 'Canada', co2: 14.3, renewables: 68, pop: 40, continent: 'Americas' },
    { country: 'Brazil', co2: 2.3, renewables: 85, pop: 216, continent: 'Americas' },
    { country: 'Mexico', co2: 3.6, renewables: 18, pop: 128, continent: 'Americas' },
    { country: 'Argentina', co2: 4.0, renewables: 14, pop: 46, continent: 'Americas' },
    // Africa
    { country: 'South Africa', co2: 7.4, renewables: 7, pop: 60, continent: 'Africa' },
    { country: 'Nigeria', co2: 0.6, renewables: 19, pop: 223, continent: 'Africa' },
    { country: 'Ethiopia', co2: 0.2, renewables: 92, pop: 126, continent: 'Africa' },
    { country: 'Kenya', co2: 0.4, renewables: 80, pop: 55, continent: 'Africa' },
    { country: 'Egypt', co2: 2.4, renewables: 12, pop: 111, continent: 'Africa' },
  ],
  encoding: {
    x: {
      field: 'co2',
      type: 'quantitative',
      axis: { title: 'CO2 emissions per capita (tonnes)' },
    },
    y: {
      field: 'renewables',
      type: 'quantitative',
      axis: { title: 'Renewable electricity share (%)' },
    },
    color: { field: 'continent', type: 'nominal' },
    size: { field: 'pop', type: 'quantitative' },
  },
  annotations: [
    {
      type: 'text',
      x: 14.7,
      y: 21,
      text: 'The US has high emissions\nbut modest renewables',
      connector: true,
      anchor: 'left',
      offset: { dx: -140, dy: -60 },
    },
    {
      type: 'text',
      x: 2.3,
      y: 85,
      text: "Brazil's grid is nearly\nall renewable",
      connector: true,
      anchor: 'top',
    },
  ],
  chrome: {
    title: 'Clean grids and low emissions rarely go together',
    subtitle:
      'CO2 emissions per capita vs share of electricity from renewables, 2023. Circle size reflects population.',
    source: 'Source: Our World in Data',
  },
};

export const EmissionsVsRenewables = () => (
  <div className="story-chart story-h-500">
    <Chart spec={emissionsSpec} />
  </div>
);

const compactEmissionsSpec: ChartSpec = {
  ...emissionsSpec,
  chrome: {
    ...emissionsSpec.chrome,
    title: 'Clean Grids Are Rare',
    subtitle: 'CO2 per capita vs renewables, 2023',
  },
  labels: { density: 'none' },
};

export const EmissionsVsRenewablesCompact = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '360px', '--h': '400px' } as React.CSSProperties}
  >
    <Chart spec={compactEmissionsSpec} />
  </div>
);

export const EmissionsVsRenewablesWide = () => (
  <div
    className="story-debug-border story-fixed-size"
    style={{ '--w': '1200px', '--h': '550px' } as React.CSSProperties}
  >
    <Chart spec={emissionsSpec} />
  </div>
);

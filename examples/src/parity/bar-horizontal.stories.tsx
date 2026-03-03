/**
 * Parity test: Horizontal bar chart with value labels and highlights.
 *
 * Demonstrates Infrographic-comparable quality for editorial bar charts.
 * Uses real-world country population data with sorted bars and value labels.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Most Populous Countries: Horizontal bar with value labels
// ---------------------------------------------------------------------------

const populationBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { country: 'India', population: 1_428_000_000 },
    { country: 'China', population: 1_425_000_000 },
    { country: 'United States', population: 339_000_000 },
    { country: 'Indonesia', population: 277_000_000 },
    { country: 'Pakistan', population: 230_000_000 },
    { country: 'Nigeria', population: 223_000_000 },
    { country: 'Brazil', population: 216_000_000 },
    { country: 'Bangladesh', population: 173_000_000 },
    { country: 'Russia', population: 144_000_000 },
    { country: 'Ethiopia', population: 126_000_000 },
  ],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { label: 'Population' } },
    y: { field: 'country', type: 'nominal' },
  },
  annotations: [
    {
      type: 'refline',
      x: 1_000_000_000,
      label: '1 billion',
      style: 'dashed',
      stroke: '#cc4444',
    },
  ],
  chrome: {
    title: "World's Most Populous Countries",
    subtitle: 'Population, 2023 estimates',
    source: 'Source: United Nations Population Division',
  },
};

export const PopulationBar = () => (
  <div style={{ width: 650, height: 480 }}>
    <Chart spec={populationBarSpec} />
  </div>
);

export const PopulationBarCompact = () => (
  <div style={{ width: 320, height: 400 }}>
    <Chart spec={populationBarSpec} />
  </div>
);

export const PopulationBarWide = () => (
  <div style={{ width: 1200, height: 500 }}>
    <Chart spec={populationBarSpec} />
  </div>
);

export const PopulationBarDarkMode = () => (
  <div style={{ width: 650, height: 480 }}>
    <Chart spec={populationBarSpec} darkMode="force" />
  </div>
);

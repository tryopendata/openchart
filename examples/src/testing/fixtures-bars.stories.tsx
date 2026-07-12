/**
 * Testing / Fixtures — bar & column pinned e2e stories.
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

const vBarGradient = (color: string) => ({
  gradient: 'linear' as const,
  x1: 0,
  y1: 1,
  x2: 0,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});

const hBarGradient = (color: string) => ({
  gradient: 'linear' as const,
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  stops: [
    { offset: 0, color, opacity: 0.4 },
    { offset: 1, color },
  ],
});

// ---------------------------------------------------------------------------
// SimpleColumns (from charts/column.stories.tsx)
// ---------------------------------------------------------------------------

const simpleColumnSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: vBarGradient('#1b7fa3') },
  data: [
    { month: 'Jan', jobs: 353 },
    { month: 'Feb', jobs: 275 },
    { month: 'Mar', jobs: 303 },
    { month: 'Apr', jobs: 175 },
    { month: 'May', jobs: 272 },
    { month: 'Jun', jobs: 206 },
    { month: 'Jul', jobs: 114 },
    { month: 'Aug', jobs: 142 },
    { month: 'Sep', jobs: 254 },
    { month: 'Oct', jobs: 12 },
    { month: 'Nov', jobs: 227 },
    { month: 'Dec', jobs: 256 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: {
      field: 'jobs',
      type: 'quantitative',
      axis: { title: 'Jobs added (thousands)' },
    },
  },
  annotations: [
    {
      type: 'text',
      x: 'Oct',
      y: 12,
      text: 'Hurricane disruptions\nslowed October hiring',
      anchor: 'top',
      offset: { dx: 0, dy: -200 },
      connector: true,
    },
    {
      type: 'refline',
      y: 168,
      label: 'avg: 168K',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
      labelOffset: { dx: -90, dy: 16 },
    },
  ],
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'The Job Market Cooled But Never Cracked',
    subtitle: 'Monthly US nonfarm payroll additions, 2024 (thousands of jobs)',
    source: 'Source: Bureau of Labor Statistics',
    byline: 'Chart: OpenChart',
  },
};

export const SimpleColumns = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={simpleColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// LongAxisLabels (from charts/column.stories.tsx)
// ---------------------------------------------------------------------------

const longLabelsSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: vBarGradient('#1b7fa3') },
  data: [
    { department: 'Research and Advanced Development', budget: 42 },
    { department: 'Marketing and Brand Communications', budget: 31 },
    { department: 'Human Resources and Talent Acquisition', budget: 28 },
    { department: 'Information Technology Infrastructure', budget: 24 },
    { department: 'Customer Success and Engagement', budget: 19 },
    { department: 'Legal and Regulatory Compliance', budget: 15 },
    { department: 'Supply Chain and Logistics Operations', budget: 12 },
  ],
  encoding: {
    x: { field: 'department', type: 'nominal' },
    y: {
      field: 'budget',
      type: 'quantitative',
      axis: { title: 'Budget ($M)' },
    },
  },
  chrome: {
    title: 'R&D Claims the Biggest Slice',
    subtitle: 'Annual departmental budget allocations, FY 2025',
    source: 'Source: Internal Finance',
  },
};

export const LongAxisLabels = () => (
  <div className="tfix-chart tfix-h-420">
    <Chart spec={longLabelsSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// SimpleBars (from charts/bar.stories.tsx)
// ---------------------------------------------------------------------------

const simpleBarSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: [
    { cause: 'Ischaemic heart disease', deaths: 9.0 },
    { cause: 'COVID-19', deaths: 8.8 },
    { cause: 'Stroke', deaths: 6.8 },
    { cause: 'COPD', deaths: 3.4 },
    { cause: 'Lower respiratory infections', deaths: 2.5 },
    { cause: 'Lung cancers', deaths: 1.9 },
    { cause: "Alzheimer's & dementia", deaths: 1.8 },
    { cause: 'Diabetes', deaths: 1.6 },
    { cause: 'Kidney diseases', deaths: 1.4 },
    { cause: 'Neonatal conditions', deaths: 1.4 },
  ],
  encoding: {
    x: {
      field: 'deaths',
      type: 'quantitative',
      axis: { title: 'Deaths (millions)' },
    },
    y: { field: 'cause', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 9.0,
      y: 'Ischaemic heart disease',
      text: 'Heart disease has been\nthe #1 killer since 2000',
      anchor: 'bottom',
      offset: { dx: -80, dy: 60 },
      connector: true,
    },
    {
      type: 'text',
      x: 8.8,
      y: 'COVID-19',
      text: 'COVID entered the\ntop 10 in 2020',
      anchor: 'top',
      offset: { dx: -80, dy: -80 },
      connector: true,
    },
  ],
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'Heart Disease Still Kills More People Than Anything Else',
    subtitle: 'Top 10 global causes of death, 2021 (millions of deaths per year)',
    source: 'Source: World Health Organization',
    byline: 'Chart: OpenChart',
  },
};

export const SimpleBars = () => (
  <div className="tfix-chart tfix-h-420">
    <Chart spec={simpleBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// EnergyMix (from editorial/column-stacked.stories.tsx)
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
    y: {
      field: 'energy',
      type: 'quantitative',
      axis: { title: 'Share of global energy (%)' },
      // Explicit for clarity: this is a composition-of-a-whole chart, stacked
      // by default since v8.
      stack: 'zero',
    },
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
  <div className="tfix-chart tfix-h-450">
    <Chart spec={energyColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// TemperatureAnomaly (from editorial/column-diverging.stories.tsx)
// ---------------------------------------------------------------------------

const tempSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { year: '1900', anomaly: -0.08, trend: 'Cooler' },
    { year: '1910', anomaly: -0.42, trend: 'Cooler' },
    { year: '1920', anomaly: -0.27, trend: 'Cooler' },
    { year: '1930', anomaly: -0.14, trend: 'Cooler' },
    { year: '1940', anomaly: 0.1, trend: 'Warmer' },
    { year: '1950', anomaly: -0.16, trend: 'Cooler' },
    { year: '1960', anomaly: 0.03, trend: 'Warmer' },
    { year: '1970', anomaly: 0.01, trend: 'Warmer' },
    { year: '1980', anomaly: 0.26, trend: 'Warmer' },
    { year: '1990', anomaly: 0.45, trend: 'Warmer' },
    { year: '2000', anomaly: 0.61, trend: 'Warmer' },
    { year: '2010', anomaly: 0.72, trend: 'Warmer' },
    { year: '2020', anomaly: 1.02, trend: 'Warmer' },
    { year: '2025', anomaly: 1.17, trend: 'Warmer' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'anomaly',
      type: 'quantitative',
      axis: { title: 'Temperature anomaly (°C)' },
    },
    color: { field: 'trend', type: 'nominal' },
  },
  labels: { density: 'none' },
  annotations: [
    {
      type: 'text',
      x: '1910',
      y: -0.42,
      text: 'Coldest decade on record\nat 0.42°C below average',
      connector: true,
      anchor: 'top',
      offset: { dx: 200, dy: -20 },
    },
    {
      type: 'text',
      x: '2025',
      y: 1.17,
      text: '2025 hit 1.17°C above\nthe 20th century average',
      connector: true,
      anchor: 'left',
      offset: { dx: -180, dy: 20 },
    },
    {
      type: 'refline',
      y: 0,
      style: 'solid',
      strokeWidth: 1,
    },
  ],
  chrome: {
    title: 'Since 1980, every half-decade has been warmer than average',
    subtitle:
      'Global surface temperature anomaly relative to 20th century average, °C, by half-decade',
    source: 'Source: NOAA National Centers for Environmental Information',
  },
};

export const TemperatureAnomaly = () => (
  <div className="tfix-chart tfix-h-450">
    <Chart spec={tempSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// PopulationBarCompact (from editorial/bar-horizontal.stories.tsx)
// ---------------------------------------------------------------------------

const populationBarSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar', fill: hBarGradient('#1b7fa3') },
  data: [
    { country: 'India', population: 1_463_000_000 },
    { country: 'China', population: 1_410_000_000 },
    { country: 'United States', population: 347_000_000 },
    { country: 'Indonesia', population: 285_000_000 },
    { country: 'Pakistan', population: 255_000_000 },
    { country: 'Nigeria', population: 240_000_000 },
    { country: 'Brazil', population: 217_000_000 },
    { country: 'Bangladesh', population: 175_000_000 },
    { country: 'Russia', population: 144_000_000 },
    { country: 'Ethiopia', population: 135_000_000 },
  ],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { title: 'Population' } },
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
    title: 'India has overtaken China as the most populous country',
    subtitle: 'Population by country, 2025 estimates',
    source: 'Source: United Nations Population Division, World Population Prospects 2024',
  },
};

const compactPopSpec: ChartSpec = {
  ...populationBarSpec,
  chrome: {
    ...populationBarSpec.chrome,
    title: 'India Overtakes China',
    subtitle: 'Population by country, 2025',
  },
  labels: { density: 'none' },
};

export const PopulationBarCompact = () => (
  <div
    className="tfix-debug-border tfix-fixed-size"
    style={{ '--w': '320px', '--h': '400px' } as React.CSSProperties}
  >
    <Chart spec={compactPopSpec} />
  </div>
);

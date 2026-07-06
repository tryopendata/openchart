import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Data: CO2 emissions by country (Mt), 2015-2023 (quarterly-ish samples)
// ---------------------------------------------------------------------------

const emissionsData = [
  { year: '2015', country: 'United States', emissions: 5100 },
  { year: '2016', country: 'United States', emissions: 5010 },
  { year: '2017', country: 'United States', emissions: 4970 },
  { year: '2018', country: 'United States', emissions: 5130 },
  { year: '2019', country: 'United States', emissions: 5010 },
  { year: '2020', country: 'United States', emissions: 4570 },
  { year: '2021', country: 'United States', emissions: 4880 },
  { year: '2022', country: 'United States', emissions: 4870 },
  { year: '2023', country: 'United States', emissions: 4700 },
  { year: '2015', country: 'China', emissions: 9820 },
  { year: '2016', country: 'China', emissions: 9890 },
  { year: '2017', country: 'China', emissions: 10100 },
  { year: '2018', country: 'China', emissions: 10400 },
  { year: '2019', country: 'China', emissions: 10700 },
  { year: '2020', country: 'China', emissions: 10900 },
  { year: '2021', country: 'China', emissions: 11500 },
  { year: '2022', country: 'China', emissions: 11400 },
  { year: '2023', country: 'China', emissions: 11900 },
  { year: '2015', country: 'India', emissions: 2290 },
  { year: '2016', country: 'India', emissions: 2380 },
  { year: '2017', country: 'India', emissions: 2470 },
  { year: '2018', country: 'India', emissions: 2590 },
  { year: '2019', country: 'India', emissions: 2600 },
  { year: '2020', country: 'India', emissions: 2380 },
  { year: '2021', country: 'India', emissions: 2660 },
  { year: '2022', country: 'India', emissions: 2830 },
  { year: '2023', country: 'India', emissions: 2950 },
  { year: '2015', country: 'Russia', emissions: 1740 },
  { year: '2016', country: 'Russia', emissions: 1730 },
  { year: '2017', country: 'Russia', emissions: 1760 },
  { year: '2018', country: 'Russia', emissions: 1810 },
  { year: '2019', country: 'Russia', emissions: 1780 },
  { year: '2020', country: 'Russia', emissions: 1640 },
  { year: '2021', country: 'Russia', emissions: 1820 },
  { year: '2022', country: 'Russia', emissions: 1710 },
  { year: '2023', country: 'Russia', emissions: 1750 },
  { year: '2015', country: 'Japan', emissions: 1230 },
  { year: '2016', country: 'Japan', emissions: 1210 },
  { year: '2017', country: 'Japan', emissions: 1190 },
  { year: '2018', country: 'Japan', emissions: 1140 },
  { year: '2019', country: 'Japan', emissions: 1100 },
  { year: '2020', country: 'Japan', emissions: 1030 },
  { year: '2021', country: 'Japan', emissions: 1060 },
  { year: '2022', country: 'Japan', emissions: 1020 },
  { year: '2023', country: 'Japan', emissions: 990 },
  { year: '2015', country: 'Germany', emissions: 800 },
  { year: '2016', country: 'Germany', emissions: 795 },
  { year: '2017', country: 'Germany', emissions: 780 },
  { year: '2018', country: 'Germany', emissions: 750 },
  { year: '2019', country: 'Germany', emissions: 700 },
  { year: '2020', country: 'Germany', emissions: 640 },
  { year: '2021', country: 'Germany', emissions: 670 },
  { year: '2022', country: 'Germany', emissions: 660 },
  { year: '2023', country: 'Germany', emissions: 590 },
];

// ---------------------------------------------------------------------------
// LineGrid: 6-country emissions, 3-column grid with shared y-axis
// ---------------------------------------------------------------------------

const lineGridSpec: ChartSpec = {
  mark: 'line',
  data: emissionsData,
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'emissions', type: 'quantitative' },
    facet: { field: 'country', type: 'nominal', columns: 3 },
  },
  chrome: {
    title: 'CO₂ Emissions by Country',
    subtitle: 'Million tonnes, 2015-2023',
    source: 'Global Carbon Project',
  },
};

export const LineGrid = () => (
  <div style={{ width: 720, height: 480 }}>
    <Chart spec={lineGridSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ColumnGrid: GDP growth by region, 2x3 grid
// ---------------------------------------------------------------------------

const gdpData = [
  { year: '2020', region: 'North America', growth: -3.4 },
  { year: '2021', region: 'North America', growth: 5.7 },
  { year: '2022', region: 'North America', growth: 2.1 },
  { year: '2023', region: 'North America', growth: 2.5 },
  { year: '2020', region: 'Europe', growth: -6.1 },
  { year: '2021', region: 'Europe', growth: 5.4 },
  { year: '2022', region: 'Europe', growth: 3.5 },
  { year: '2023', region: 'Europe', growth: 0.5 },
  { year: '2020', region: 'East Asia', growth: 1.8 },
  { year: '2021', region: 'East Asia', growth: 7.2 },
  { year: '2022', region: 'East Asia', growth: 3.0 },
  { year: '2023', region: 'East Asia', growth: 5.2 },
  { year: '2020', region: 'South Asia', growth: -5.6 },
  { year: '2021', region: 'South Asia', growth: 8.4 },
  { year: '2022', region: 'South Asia', growth: 6.8 },
  { year: '2023', region: 'South Asia', growth: 6.0 },
];

const columnGridSpec: ChartSpec = {
  mark: 'bar',
  data: gdpData,
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: { field: 'growth', type: 'quantitative' },
    facet: { field: 'region', type: 'nominal', columns: 2 },
  },
  chrome: {
    title: 'GDP Growth by Region',
    subtitle: 'Annual percentage change',
    source: 'World Bank',
  },
};

export const ColumnGrid = () => (
  <div style={{ width: 640, height: 480 }}>
    <Chart spec={columnGridSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// DonutGrid: energy mix by country
// ---------------------------------------------------------------------------

const energyData = [
  { country: 'US', source: 'Fossil', share: 60 },
  { country: 'US', source: 'Nuclear', share: 19 },
  { country: 'US', source: 'Renewables', share: 21 },
  { country: 'Germany', source: 'Fossil', share: 42 },
  { country: 'Germany', source: 'Nuclear', share: 6 },
  { country: 'Germany', source: 'Renewables', share: 52 },
  { country: 'France', source: 'Fossil', share: 10 },
  { country: 'France', source: 'Nuclear', share: 65 },
  { country: 'France', source: 'Renewables', share: 25 },
  { country: 'Japan', source: 'Fossil', share: 72 },
  { country: 'Japan', source: 'Nuclear', share: 7 },
  { country: 'Japan', source: 'Renewables', share: 21 },
];

const donutGridSpec: ChartSpec = {
  mark: { type: 'arc', innerRadius: 0.5 },
  data: energyData,
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
    facet: { field: 'country', type: 'nominal', columns: 4 },
  },
  chrome: {
    title: 'Electricity Mix by Country',
    subtitle: 'Share of generation, 2023',
    source: 'IEA',
  },
};

export const DonutGrid = () => (
  <div style={{ width: 720, height: 320 }}>
    <Chart spec={donutGridSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// MobileStacking: same LineGrid at 360px width
// ---------------------------------------------------------------------------

export const MobileStacking = () => (
  <div style={{ width: 360, height: 700 }}>
    <Chart spec={lineGridSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// IndependentY: each panel gets its own y-axis scale
// ---------------------------------------------------------------------------

const independentYSpec: ChartSpec = {
  mark: 'line',
  data: emissionsData,
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'emissions', type: 'quantitative' },
    facet: { field: 'country', type: 'nominal', columns: 3 },
  },
  resolve: { scale: { y: 'independent' } },
  chrome: {
    title: 'CO₂ Emissions (Independent Scales)',
    subtitle: 'Each panel has its own y-axis domain',
    source: 'Global Carbon Project',
  },
};

export const IndependentY = () => (
  <div style={{ width: 720, height: 480 }}>
    <Chart spec={independentYSpec} />
  </div>
);

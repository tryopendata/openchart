/**
 * Infographic showcase.
 *
 * Publication-quality editorial charts with annotations, storytelling titles,
 * and real-world data. Each story demonstrates a different chart type with
 * the kind of polish you'd see in a newspaper or research report.
 */

import type { Story } from '@ladle/react';
import type { ChartSpec, TableSpec } from '@opendata-ai/openchart-core';
import { Chart, DataTable } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// 1. Horizontal Bar Chart - Global Military Spending
// ---------------------------------------------------------------------------

const barSpec: ChartSpec = {
  type: 'bar',
  data: [
    { country: 'United States', spending: 997 },
    { country: 'China', spending: 314 },
    { country: 'Russia', spending: 149 },
    { country: 'Germany', spending: 88.5 },
    { country: 'India', spending: 86.1 },
    { country: 'United Kingdom', spending: 82.0 },
    { country: 'Saudi Arabia', spending: 80.3 },
    { country: 'France', spending: 64.7 },
  ],
  encoding: {
    x: {
      field: 'spending',
      type: 'quantitative',
      axis: { label: 'Annual spending ($ billions)' },
    },
    y: { field: 'country', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 997,
      y: 'United States',
      text: 'The US alone accounts\nfor 37% of global total',
      fontSize: 11,
      anchor: 'left',
      offset: { dx: -250, dy: -80 },
      connector: 'curve',
      stroke: '#475569',
      background: '#ffffff',
    },
  ],
  chrome: {
    title: 'The US Outspends the Next Seven Nations Combined',
    subtitle: 'Top 8 countries by military expenditure, 2024',
    source: 'Source: SIPRI Military Expenditure Database',
    byline: 'Chart: OpenChart',
  },
};

export const HorizontalBar: Story = () => (
  <div className="story-chart" style={{ height: 400 }}>
    <Chart spec={barSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 2. Multi-Series Line Chart - Social Media MAU
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  type: 'line',
  data: [
    // YouTube
    { date: '2023-01-01', mau: 2300, platform: 'YouTube' },
    { date: '2023-04-01', mau: 2340, platform: 'YouTube' },
    { date: '2023-07-01', mau: 2390, platform: 'YouTube' },
    { date: '2023-10-01', mau: 2420, platform: 'YouTube' },
    { date: '2024-01-01', mau: 2460, platform: 'YouTube' },
    { date: '2024-04-01', mau: 2500, platform: 'YouTube' },
    { date: '2024-07-01', mau: 2540, platform: 'YouTube' },
    { date: '2024-10-01', mau: 2580, platform: 'YouTube' },
    // Instagram
    { date: '2023-01-01', mau: 1480, platform: 'Instagram' },
    { date: '2023-04-01', mau: 1520, platform: 'Instagram' },
    { date: '2023-07-01', mau: 1550, platform: 'Instagram' },
    { date: '2023-10-01', mau: 1580, platform: 'Instagram' },
    { date: '2024-01-01', mau: 1600, platform: 'Instagram' },
    { date: '2024-04-01', mau: 1620, platform: 'Instagram' },
    { date: '2024-07-01', mau: 1640, platform: 'Instagram' },
    { date: '2024-10-01', mau: 1630, platform: 'Instagram' },
    // TikTok
    { date: '2023-01-01', mau: 1200, platform: 'TikTok' },
    { date: '2023-04-01', mau: 1310, platform: 'TikTok' },
    { date: '2023-07-01', mau: 1420, platform: 'TikTok' },
    { date: '2023-10-01', mau: 1500, platform: 'TikTok' },
    { date: '2024-01-01', mau: 1580, platform: 'TikTok' },
    { date: '2024-04-01', mau: 1680, platform: 'TikTok' },
    { date: '2024-07-01', mau: 1790, platform: 'TikTok' },
    { date: '2024-10-01', mau: 1880, platform: 'TikTok' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
    y: {
      field: 'mau',
      type: 'quantitative',
      axis: { label: 'Monthly active users (millions)' },
    },
    color: { field: 'platform', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2024-04-01',
      y: 1650,
      text: 'TikTok overtakes Instagram\nin Q2 2024',
      fontSize: 11,
      anchor: 'bottom',
      offset: { dx: -40, dy: -20 },
      connector: true,
      background: '#ffffff',
    },
    {
      type: 'text',
      x: '2023-07-01',
      y: 2390,
      text: 'YouTube holds steady\nabove 2.5B',
      fontSize: 11,
      anchor: 'bottom',
      offset: { dx: 0, dy: 10 },
      connector: false,
    },
  ],
  labels: { density: 'endpoints' },
  legend: { position: 'bottom-right' },
  chrome: {
    title: "TikTok's Meteoric Rise Overtakes Instagram",
    subtitle: 'Monthly active users by platform, quarterly 2023-2024',
    source: 'Source: Data.ai, company reports',
    byline: 'Chart: OpenChart',
  },
};

export const MultiSeriesLine: Story = () => (
  <div className="story-chart" style={{ height: 450 }}>
    <Chart spec={lineSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 3. Stacked Column Chart - Global EV Sales by Powertrain
// ---------------------------------------------------------------------------

const stackedColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    // Battery Electric
    { year: '2019', sales: 2.1, fuel: 'Battery Electric' },
    { year: '2020', sales: 3.0, fuel: 'Battery Electric' },
    { year: '2021', sales: 6.6, fuel: 'Battery Electric' },
    { year: '2022', sales: 10.5, fuel: 'Battery Electric' },
    { year: '2023', sales: 14.2, fuel: 'Battery Electric' },
    { year: '2024', sales: 17.1, fuel: 'Battery Electric' },
    // Plug-in Hybrid
    { year: '2019', sales: 1.4, fuel: 'Plug-in Hybrid' },
    { year: '2020', sales: 1.8, fuel: 'Plug-in Hybrid' },
    { year: '2021', sales: 3.2, fuel: 'Plug-in Hybrid' },
    { year: '2022', sales: 3.8, fuel: 'Plug-in Hybrid' },
    { year: '2023', sales: 4.1, fuel: 'Plug-in Hybrid' },
    { year: '2024', sales: 6.4, fuel: 'Plug-in Hybrid' },
    // Hybrid
    { year: '2019', sales: 3.6, fuel: 'Hybrid' },
    { year: '2020', sales: 3.4, fuel: 'Hybrid' },
    { year: '2021', sales: 4.1, fuel: 'Hybrid' },
    { year: '2022', sales: 4.7, fuel: 'Hybrid' },
    { year: '2023', sales: 5.5, fuel: 'Hybrid' },
    { year: '2024', sales: 6.3, fuel: 'Hybrid' },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: { field: 'sales', type: 'quantitative', axis: { label: 'Sales (millions)' } },
    color: { field: 'fuel', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2024',
      y: 25,
      text: 'Total: 29.8M units\n(+25% year-over-year)',
      fontSize: 11,
      anchor: 'left',
      offset: { dx: -160, dy: -40 },
      connector: true,
      background: '#ffffff',
    },
    {
      type: 'text',
      x: '2021',
      y: 10,
      text: 'BEV overtakes hybrid\nfor first time',
      fontSize: 10,
      anchor: 'top',
      offset: { dx: 0, dy: -40 },
      connector: true,
      background: '#ffffff',
    },
  ],
  chrome: {
    title: 'Electric Vehicles Dominate as Sales Quadruple in Five Years',
    subtitle: 'Global electrified vehicle sales by powertrain type, 2019-2024',
    source: 'Source: IEA Global EV Outlook 2025, Rho Motion',
    byline: 'Chart: OpenChart',
  },
};

export const StackedColumn: Story = () => (
  <div className="story-chart" style={{ height: 450 }}>
    <Chart spec={stackedColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 4. Stacked Area Chart - Global Renewable Electricity Generation
// ---------------------------------------------------------------------------

const stackedAreaSpec: ChartSpec = {
  type: 'area',
  data: [
    // Solar
    { date: '2018-01-01', generation: 585, source: 'Solar' },
    { date: '2019-01-01', generation: 724, source: 'Solar' },
    { date: '2020-01-01', generation: 855, source: 'Solar' },
    { date: '2021-01-01', generation: 1023, source: 'Solar' },
    { date: '2022-01-01', generation: 1284, source: 'Solar' },
    { date: '2023-01-01', generation: 1631, source: 'Solar' },
    { date: '2024-01-01', generation: 2105, source: 'Solar' },
    // Wind
    { date: '2018-01-01', generation: 1270, source: 'Wind' },
    { date: '2019-01-01', generation: 1420, source: 'Wind' },
    { date: '2020-01-01', generation: 1592, source: 'Wind' },
    { date: '2021-01-01', generation: 1862, source: 'Wind' },
    { date: '2022-01-01', generation: 2100, source: 'Wind' },
    { date: '2023-01-01', generation: 2304, source: 'Wind' },
    { date: '2024-01-01', generation: 2494, source: 'Wind' },
    // Hydro
    { date: '2018-01-01', generation: 4210, source: 'Hydro' },
    { date: '2019-01-01', generation: 4306, source: 'Hydro' },
    { date: '2020-01-01', generation: 4355, source: 'Hydro' },
    { date: '2021-01-01', generation: 4273, source: 'Hydro' },
    { date: '2022-01-01', generation: 4334, source: 'Hydro' },
    { date: '2023-01-01', generation: 4410, source: 'Hydro' },
    { date: '2024-01-01', generation: 4578, source: 'Hydro' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 6 } },
    y: { field: 'generation', type: 'quantitative', axis: { label: 'TWh' } },
    color: { field: 'source', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2022-01-01',
      y: 1284,
      text: 'Solar doubles from\n1,023 to 2,105 TWh\nin just three years',
      fontSize: 10,
      anchor: 'top',
      offset: { dx: 0, dy: -60 },
      connector: true,
      background: '#ffffff',
    },
    {
      type: 'text',
      x: '2024-01-01',
      y: 7500,
      text: 'Renewables surpass\n9,100 TWh in 2024',
      fontSize: 11,
      anchor: 'left',
      offset: { dx: -170, dy: -30 },
      connector: true,
      background: '#ffffff',
    },
  ],
  chrome: {
    title: 'Solar Surge Drives Renewable Generation Past 9,000 TWh',
    subtitle: 'Global electricity generation from solar, wind, and hydro, 2018-2024',
    source: 'Source: Ember Global Electricity Review 2025, IRENA',
    byline: 'Chart: OpenChart',
  },
};

export const StackedArea: Story = () => (
  <div className="story-chart" style={{ height: 450 }}>
    <Chart spec={stackedAreaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 5. Data Table with Search, Sort, Heatmap, and Sparkline
// ---------------------------------------------------------------------------

const tableData = [
  {
    country: 'United States',
    pop: 331900000,
    gdpPerCapita: 76399,
    lifeExp: 77.3,
    co2: 14.4,
    trend: [14.9, 15.1, 14.7, 14.2, 13.8, 14.0, 14.4],
  },
  {
    country: 'China',
    pop: 1425900000,
    gdpPerCapita: 12556,
    lifeExp: 78.2,
    co2: 8.0,
    trend: [6.2, 6.6, 7.0, 7.3, 7.7, 7.8, 8.0],
  },
  {
    country: 'Germany',
    pop: 83300000,
    gdpPerCapita: 48398,
    lifeExp: 81.2,
    co2: 8.1,
    trend: [9.6, 9.1, 8.9, 8.4, 7.9, 8.0, 8.1],
  },
  {
    country: 'Japan',
    pop: 123300000,
    gdpPerCapita: 33815,
    lifeExp: 84.8,
    co2: 8.5,
    trend: [9.2, 9.0, 8.8, 8.5, 8.3, 8.4, 8.5],
  },
  {
    country: 'India',
    pop: 1428600000,
    gdpPerCapita: 2612,
    lifeExp: 70.8,
    co2: 1.9,
    trend: [1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
  },
  {
    country: 'Brazil',
    pop: 216400000,
    gdpPerCapita: 8917,
    lifeExp: 75.9,
    co2: 2.3,
    trend: [2.5, 2.4, 2.3, 2.2, 2.1, 2.2, 2.3],
  },
  {
    country: 'United Kingdom',
    pop: 67700000,
    gdpPerCapita: 45371,
    lifeExp: 81.3,
    co2: 5.0,
    trend: [6.8, 6.3, 5.9, 5.5, 5.2, 5.1, 5.0],
  },
  {
    country: 'France',
    pop: 67900000,
    gdpPerCapita: 40997,
    lifeExp: 82.5,
    co2: 4.5,
    trend: [5.2, 5.0, 4.8, 4.6, 4.5, 4.5, 4.5],
  },
  {
    country: 'South Korea',
    pop: 51700000,
    gdpPerCapita: 31489,
    lifeExp: 83.5,
    co2: 11.6,
    trend: [10.8, 11.0, 11.3, 11.5, 11.7, 11.6, 11.6],
  },
  {
    country: 'Australia',
    pop: 26500000,
    gdpPerCapita: 51812,
    lifeExp: 83.2,
    co2: 15.0,
    trend: [16.1, 15.8, 15.4, 15.0, 14.9, 15.0, 15.0],
  },
  {
    country: 'Canada',
    pop: 40100000,
    gdpPerCapita: 43242,
    lifeExp: 82.2,
    co2: 14.3,
    trend: [15.0, 14.9, 14.7, 14.4, 14.2, 14.3, 14.3],
  },
  {
    country: 'Mexico',
    pop: 128900000,
    gdpPerCapita: 10948,
    lifeExp: 75.1,
    co2: 3.6,
    trend: [3.5, 3.6, 3.6, 3.5, 3.4, 3.5, 3.6],
  },
  {
    country: 'Indonesia',
    pop: 277500000,
    gdpPerCapita: 4788,
    lifeExp: 71.7,
    co2: 2.3,
    trend: [1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3],
  },
  {
    country: 'Italy',
    pop: 58900000,
    gdpPerCapita: 34085,
    lifeExp: 83.5,
    co2: 5.3,
    trend: [5.8, 5.6, 5.4, 5.2, 5.1, 5.2, 5.3],
  },
  {
    country: 'Saudi Arabia',
    pop: 36900000,
    gdpPerCapita: 23186,
    lifeExp: 78.8,
    co2: 18.7,
    trend: [16.5, 17.0, 17.4, 18.0, 18.3, 18.5, 18.7],
  },
];

const tableSpec: TableSpec = {
  type: 'table',
  data: tableData,
  columns: [
    { key: 'country', label: 'Country', sortable: true },
    { key: 'pop', label: 'Population', format: ',.0f', sortable: true, align: 'right' },
    {
      key: 'gdpPerCapita',
      label: 'GDP/Capita',
      format: '$,.0f',
      sortable: true,
      align: 'right',
      heatmap: {},
    },
    { key: 'lifeExp', label: 'Life Exp.', format: '.1f', sortable: true, align: 'right' },
    {
      key: 'co2',
      label: 'CO2 (t/cap)',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: { palette: 'redBlue' },
    },
    { key: 'trend', label: 'CO2 Trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'Wealth Grows but Emissions Tell a Different Story',
    subtitle: 'Key indicators for 15 major economies, 2024 estimates',
    source: 'Source: World Bank, Global Carbon Project',
    byline: 'Table: OpenChart',
  },
  search: true,
  pagination: { pageSize: 10 },
};

export const DataTableShowcase: Story = () => (
  <div className="story-centered" style={{ maxWidth: 900 }}>
    <DataTable spec={tableSpec} />
  </div>
);

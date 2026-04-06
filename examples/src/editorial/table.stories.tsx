/**
 * Data table stories showcasing basic tables, flags, heatmaps, and mini charts.
 */

import type { Story } from '@ladle/react';
import type { TableSpec } from '@opendata-ai/openchart-core';
import { DataTable } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Basic
// ---------------------------------------------------------------------------

const basicData = [
  {
    country: 'United States',
    pop: 331002651,
    area: 9833520,
    density: 33.6,
    gdpPerCapita: 76399,
    lifeExpectancy: 77.3,
  },
  {
    country: 'China',
    pop: 1425887337,
    area: 9596961,
    density: 148.6,
    gdpPerCapita: 12556,
    lifeExpectancy: 78.2,
  },
  {
    country: 'India',
    pop: 1428627663,
    area: 3287263,
    density: 434.6,
    gdpPerCapita: 2612,
    lifeExpectancy: 70.8,
  },
  {
    country: 'Indonesia',
    pop: 277534122,
    area: 1904569,
    density: 145.7,
    gdpPerCapita: 4788,
    lifeExpectancy: 71.7,
  },
  {
    country: 'Brazil',
    pop: 216422446,
    area: 8515767,
    density: 25.4,
    gdpPerCapita: 8917,
    lifeExpectancy: 75.9,
  },
  {
    country: 'Pakistan',
    pop: 240485658,
    area: 881913,
    density: 272.7,
    gdpPerCapita: 1596,
    lifeExpectancy: 67.3,
  },
  {
    country: 'Nigeria',
    pop: 223804632,
    area: 923769,
    density: 242.3,
    gdpPerCapita: 2163,
    lifeExpectancy: 54.7,
  },
  {
    country: 'Bangladesh',
    pop: 172954319,
    area: 147570,
    density: 1172.1,
    gdpPerCapita: 2688,
    lifeExpectancy: 72.4,
  },
  {
    country: 'Russia',
    pop: 144236933,
    area: 17098242,
    density: 8.4,
    gdpPerCapita: 12195,
    lifeExpectancy: 73.4,
  },
  {
    country: 'Mexico',
    pop: 128455567,
    area: 1964375,
    density: 65.4,
    gdpPerCapita: 10948,
    lifeExpectancy: 75.1,
  },
  {
    country: 'Japan',
    pop: 123294513,
    area: 377975,
    density: 326.2,
    gdpPerCapita: 33815,
    lifeExpectancy: 84.8,
  },
  {
    country: 'Germany',
    pop: 83294633,
    area: 357114,
    density: 233.3,
    gdpPerCapita: 48398,
    lifeExpectancy: 81.2,
  },
];

const basicSpec: TableSpec = {
  type: 'table',
  data: basicData,
  columns: [
    { key: 'country', label: 'Country', sortable: true },
    { key: 'pop', label: 'Population', format: ',.0f', sortable: true, align: 'right' },
    { key: 'area', label: 'Area (km\u00B2)', format: ',.0f', sortable: true, align: 'right' },
    { key: 'density', label: 'Density', format: '.1f', sortable: true, align: 'right' },
    { key: 'gdpPerCapita', label: 'GDP/Capita', format: '$,.0f', sortable: true, align: 'right' },
    { key: 'lifeExpectancy', label: 'Life Exp.', format: '.1f', sortable: true, align: 'right' },
  ],
  chrome: {
    title: "World's Most Populous Countries",
    subtitle: 'Key demographic indicators',
    source: 'World Bank, 2023',
  },
  search: true,
  pagination: { pageSize: 10 },
};

export const Basic: Story = () => (
  <div className="story-centered story-max-w-900">
    <DataTable spec={basicSpec} />
  </div>
);

export const BasicCompact: Story = () => (
  <div className="story-centered story-max-w-380">
    <DataTable spec={basicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

const flagsData = [
  { code: 'US', country: 'United States', gold: 40, silver: 44, bronze: 42, total: 126 },
  { code: 'CN', country: 'China', gold: 38, silver: 32, bronze: 19, total: 89 },
  { code: 'GB', country: 'Great Britain', gold: 22, silver: 21, bronze: 22, total: 65 },
  { code: 'RU', country: 'ROC', gold: 20, silver: 28, bronze: 23, total: 71 },
  { code: 'AU', country: 'Australia', gold: 17, silver: 7, bronze: 22, total: 46 },
  { code: 'JP', country: 'Japan', gold: 27, silver: 14, bronze: 17, total: 58 },
  { code: 'FR', country: 'France', gold: 10, silver: 12, bronze: 11, total: 33 },
  { code: 'DE', country: 'Germany', gold: 10, silver: 11, bronze: 16, total: 37 },
  { code: 'IT', country: 'Italy', gold: 10, silver: 10, bronze: 20, total: 40 },
  { code: 'NL', country: 'Netherlands', gold: 10, silver: 12, bronze: 14, total: 36 },
  { code: 'KR', country: 'South Korea', gold: 6, silver: 4, bronze: 10, total: 20 },
  { code: 'NZ', country: 'New Zealand', gold: 7, silver: 6, bronze: 7, total: 20 },
];

const flagsSpec: TableSpec = {
  type: 'table',
  data: flagsData,
  columns: [
    { key: 'code', label: '', flag: true },
    { key: 'country', label: 'Country', sortable: true },
    {
      key: 'gold',
      label: 'Gold',
      sortable: true,
      align: 'right',
      heatmap: { palette: ['#fff9c4', '#ffd700'] },
    },
    {
      key: 'silver',
      label: 'Silver',
      sortable: true,
      align: 'right',
      heatmap: { palette: ['#f5f5f5', '#c0c0c0'] },
    },
    {
      key: 'bronze',
      label: 'Bronze',
      sortable: true,
      align: 'right',
      heatmap: { palette: ['#fff3e0', '#cd7f32'] },
    },
    { key: 'total', label: 'Total', sortable: true, align: 'right', bar: {} },
  ],
  chrome: {
    title: 'Olympic Medal Count',
    subtitle: 'Tokyo 2020 Summer Olympics',
    source: 'International Olympic Committee',
  },
  search: true,
};

export const Flags: Story = () => (
  <div className="story-centered story-max-w-750">
    <DataTable spec={flagsSpec} />
  </div>
);

export const FlagsCompact: Story = () => (
  <div className="story-centered story-max-w-380">
    <DataTable spec={flagsSpec} />
  </div>
);

const countryCompareData = [
  { code: 'US', country: 'United States', gdp: 25462.7, pop: 331.0, gdpPerCapita: 76930 },
  { code: 'CN', country: 'China', gdp: 17963.2, pop: 1425.9, gdpPerCapita: 12599 },
  { code: 'JP', country: 'Japan', gdp: 4231.1, pop: 123.3, gdpPerCapita: 34311 },
  { code: 'DE', country: 'Germany', gdp: 4072.2, pop: 83.3, gdpPerCapita: 48870 },
  { code: 'IN', country: 'India', gdp: 3385.1, pop: 1428.6, gdpPerCapita: 2370 },
  { code: 'GB', country: 'United Kingdom', gdp: 3070.7, pop: 67.7, gdpPerCapita: 45371 },
  { code: 'FR', country: 'France', gdp: 2782.9, pop: 67.9, gdpPerCapita: 40997 },
  { code: 'BR', country: 'Brazil', gdp: 1920.1, pop: 216.4, gdpPerCapita: 8876 },
];

const countryCompareSpec: TableSpec = {
  type: 'table',
  data: countryCompareData,
  columns: [
    { key: 'code', label: '', flag: true },
    { key: 'country', label: 'Country', sortable: true },
    { key: 'gdp', label: 'GDP (B$)', format: ',.1f', sortable: true, align: 'right', bar: {} },
    { key: 'pop', label: 'Pop (M)', format: ',.1f', sortable: true, align: 'right' },
    {
      key: 'gdpPerCapita',
      label: 'GDP/Capita',
      format: '$,.0f',
      sortable: true,
      align: 'right',
      heatmap: {},
    },
  ],
  chrome: {
    title: "World's Largest Economies",
    subtitle: 'GDP, population, and per-capita comparison',
    source: 'World Bank, 2022',
  },
};

export const CountryComparison: Story = () => (
  <div className="story-centered story-max-w-750">
    <DataTable spec={countryCompareSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

const heatmapData = [
  { city: 'Phoenix', jan: 12.8, apr: 24.4, jul: 35.0, oct: 25.0, yearAvg: 24.3 },
  { city: 'Miami', jan: 20.1, apr: 24.8, jul: 28.3, oct: 26.0, yearAvg: 24.8 },
  { city: 'Chicago', jan: -3.2, apr: 9.4, jul: 24.7, oct: 12.2, yearAvg: 10.8 },
  { city: 'Anchorage', jan: -8.8, apr: 2.1, jul: 15.4, oct: 1.9, yearAvg: 2.6 },
  { city: 'New York', jan: 0.6, apr: 12.1, jul: 25.3, oct: 14.8, yearAvg: 13.2 },
  { city: 'Seattle', jan: 4.7, apr: 10.2, jul: 19.5, oct: 10.8, yearAvg: 11.3 },
  { city: 'Denver', jan: -0.8, apr: 9.8, jul: 23.8, oct: 11.2, yearAvg: 11.0 },
  { city: 'Houston', jan: 11.1, apr: 21.3, jul: 29.2, oct: 21.4, yearAvg: 20.7 },
];

const heatmapConfig = { palette: 'redBlue' };

const heatmapSpec: TableSpec = {
  type: 'table',
  data: heatmapData,
  columns: [
    { key: 'city', label: 'City', sortable: true },
    {
      key: 'jan',
      label: 'Jan',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: heatmapConfig,
    },
    {
      key: 'apr',
      label: 'Apr',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: heatmapConfig,
    },
    {
      key: 'jul',
      label: 'Jul',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: heatmapConfig,
    },
    {
      key: 'oct',
      label: 'Oct',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: heatmapConfig,
    },
    {
      key: 'yearAvg',
      label: 'Avg',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: heatmapConfig,
    },
  ],
  chrome: {
    title: 'Average Monthly Temperatures',
    subtitle: 'Degrees Celsius by US city',
    source: 'NOAA Climate Data',
  },
  animation: true,
};

export const Heatmap: Story = () => (
  <div className="story-centered story-max-w-700">
    <DataTable spec={heatmapSpec} />
  </div>
);

const electionData = [
  { state: 'California', winner: 'Democrat', margin: 29.2, electoralVotes: 54 },
  { state: 'Texas', winner: 'Republican', margin: 5.6, electoralVotes: 40 },
  { state: 'Florida', winner: 'Republican', margin: 3.3, electoralVotes: 30 },
  { state: 'New York', winner: 'Democrat', margin: 23.1, electoralVotes: 28 },
  { state: 'Pennsylvania', winner: 'Democrat', margin: 1.2, electoralVotes: 19 },
  { state: 'Illinois', winner: 'Democrat', margin: 17.1, electoralVotes: 19 },
  { state: 'Ohio', winner: 'Republican', margin: 8.0, electoralVotes: 17 },
  { state: 'Georgia', winner: 'Democrat', margin: 0.2, electoralVotes: 16 },
];

const electionSpec: TableSpec = {
  type: 'table',
  data: electionData,
  columns: [
    { key: 'state', label: 'State', sortable: true },
    {
      key: 'winner',
      label: 'Winner',
      sortable: true,
      categoryColors: {
        Democrat: '#2166ac',
        Republican: '#b2182b',
      },
    },
    {
      key: 'margin',
      label: 'Margin (%)',
      format: '.1f',
      sortable: true,
      align: 'right',
      heatmap: {},
    },
    { key: 'electoralVotes', label: 'Electoral Votes', sortable: true, align: 'right', bar: {} },
  ],
  chrome: {
    title: 'Key Swing States',
    subtitle: 'Electoral results by margin of victory',
    source: 'Associated Press',
  },
  animation: true,
};

export const ElectionResults: Story = () => (
  <div className="story-centered story-max-w-650">
    <DataTable spec={electionSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Mini Charts
// ---------------------------------------------------------------------------

const stockData = [
  {
    ticker: 'AAPL',
    name: 'Apple',
    price: 189.84,
    ytdChange: 48.2,
    trend: [142, 155, 165, 170, 178, 185, 190, 189],
  },
  {
    ticker: 'MSFT',
    name: 'Microsoft',
    price: 378.91,
    ytdChange: 57.8,
    trend: [240, 275, 295, 310, 330, 345, 365, 379],
  },
  {
    ticker: 'GOOGL',
    name: 'Alphabet',
    price: 141.8,
    ytdChange: 58.3,
    trend: [89, 95, 108, 120, 125, 130, 138, 142],
  },
  {
    ticker: 'AMZN',
    name: 'Amazon',
    price: 153.42,
    ytdChange: 82.6,
    trend: [84, 98, 105, 112, 128, 135, 145, 153],
  },
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    price: 495.22,
    ytdChange: 239.0,
    trend: [146, 230, 280, 320, 390, 420, 470, 495],
  },
  {
    ticker: 'META',
    name: 'Meta',
    price: 353.96,
    ytdChange: 194.1,
    trend: [120, 165, 210, 240, 290, 310, 340, 354],
  },
  {
    ticker: 'TSLA',
    name: 'Tesla',
    price: 248.48,
    ytdChange: 101.7,
    trend: [123, 180, 195, 175, 260, 240, 255, 248],
  },
  {
    ticker: 'JPM',
    name: 'JPMorgan',
    price: 170.1,
    ytdChange: 26.8,
    trend: [134, 138, 140, 145, 150, 155, 163, 170],
  },
  {
    ticker: 'V',
    name: 'Visa',
    price: 260.38,
    ytdChange: 25.2,
    trend: [208, 218, 225, 230, 240, 248, 255, 260],
  },
  {
    ticker: 'JNJ',
    name: 'Johnson & Johnson',
    price: 156.74,
    ytdChange: -11.3,
    trend: [177, 170, 162, 155, 160, 158, 155, 157],
  },
  {
    ticker: 'WMT',
    name: 'Walmart',
    price: 162.5,
    ytdChange: 14.8,
    trend: [141, 145, 148, 150, 155, 158, 160, 163],
  },
  {
    ticker: 'PG',
    name: 'Procter & Gamble',
    price: 154.3,
    ytdChange: 2.1,
    trend: [151, 150, 148, 152, 153, 150, 152, 154],
  },
  {
    ticker: 'UNH',
    name: 'UnitedHealth',
    price: 527.4,
    ytdChange: -0.8,
    trend: [532, 540, 535, 525, 520, 530, 528, 527],
  },
  {
    ticker: 'HD',
    name: 'Home Depot',
    price: 342.9,
    ytdChange: 8.5,
    trend: [316, 320, 328, 330, 335, 338, 340, 343],
  },
  {
    ticker: 'MA',
    name: 'Mastercard',
    price: 415.6,
    ytdChange: 18.3,
    trend: [351, 360, 375, 380, 390, 400, 408, 416],
  },
  {
    ticker: 'DIS',
    name: 'Disney',
    price: 93.2,
    ytdChange: 7.1,
    trend: [87, 90, 92, 88, 85, 90, 91, 93],
  },
  {
    ticker: 'PFE',
    name: 'Pfizer',
    price: 28.5,
    ytdChange: -44.3,
    trend: [51, 45, 40, 35, 32, 30, 29, 29],
  },
  {
    ticker: 'BAC',
    name: 'Bank of America',
    price: 33.8,
    ytdChange: 1.8,
    trend: [33, 32, 31, 30, 32, 33, 34, 34],
  },
  {
    ticker: 'CRM',
    name: 'Salesforce',
    price: 262.4,
    ytdChange: 98.2,
    trend: [132, 155, 180, 200, 220, 240, 255, 262],
  },
  {
    ticker: 'NFLX',
    name: 'Netflix',
    price: 486.9,
    ytdChange: 65.1,
    trend: [295, 330, 360, 380, 420, 450, 470, 487],
  },
];

const stockSpec: TableSpec = {
  type: 'table',
  data: stockData,
  columns: [
    { key: 'ticker', label: 'Ticker', sortable: true },
    { key: 'name', label: 'Company', sortable: true },
    { key: 'price', label: 'Price', format: '$,.2f', sortable: true, align: 'right' },
    { key: 'ytdChange', label: 'YTD %', format: '+.1f', sortable: true, align: 'right', bar: {} },
    { key: 'trend', label: '8-Week Trend', sparkline: { type: 'line' } },
  ],
  chrome: {
    title: 'US Tech Stock Performance',
    subtitle: 'Year-to-date returns and 8-week price trends',
    source: 'Market data, 2023',
  },
  search: true,
  pagination: { pageSize: 10 },
  animation: true,
};

export const StockSparklines: Story = () => (
  <div className="story-centered story-max-w-800">
    <DataTable spec={stockSpec} />
  </div>
);

const revenueData = [
  {
    company: 'Apple',
    q1: 94.8,
    q2: 81.8,
    q3: 89.5,
    q4: 119.6,
    quarterly: [94.8, 81.8, 89.5, 119.6],
  },
  {
    company: 'Microsoft',
    q1: 52.7,
    q2: 56.2,
    q3: 56.5,
    q4: 62.0,
    quarterly: [52.7, 56.2, 56.5, 62.0],
  },
  {
    company: 'Alphabet',
    q1: 69.8,
    q2: 74.6,
    q3: 76.7,
    q4: 86.3,
    quarterly: [69.8, 74.6, 76.7, 86.3],
  },
  {
    company: 'Amazon',
    q1: 127.4,
    q2: 134.4,
    q3: 143.1,
    q4: 170.0,
    quarterly: [127.4, 134.4, 143.1, 170.0],
  },
  { company: 'Meta', q1: 28.6, q2: 32.0, q3: 34.1, q4: 40.1, quarterly: [28.6, 32.0, 34.1, 40.1] },
];

const revenueSpec: TableSpec = {
  type: 'table',
  data: revenueData,
  columns: [
    { key: 'company', label: 'Company', sortable: true },
    { key: 'q1', label: 'Q1', format: '.1f', sortable: true, align: 'right' },
    { key: 'q2', label: 'Q2', format: '.1f', sortable: true, align: 'right' },
    { key: 'q3', label: 'Q3', format: '.1f', sortable: true, align: 'right' },
    { key: 'q4', label: 'Q4', format: '.1f', sortable: true, align: 'right' },
    { key: 'quarterly', label: 'Trend', sparkline: { type: 'column' } },
  ],
  chrome: {
    title: 'Big Tech Quarterly Revenue',
    subtitle: 'Revenue in billions USD, 2023',
    source: 'Company earnings reports',
  },
  animation: true,
};

export const RevenueColumns: Story = () => (
  <div className="story-centered story-max-w-750">
    <DataTable spec={revenueSpec} />
  </div>
);

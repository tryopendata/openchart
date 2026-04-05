/**
 * Parity test: Table with country flags and medal counts.
 *
 * Olympic medal count with flag column and bar columns for medals,
 * demonstrating Infrographic-comparable flag and bar table features.
 */

import type { Story } from '@ladle/react';
import type { TableSpec } from '@opendata-ai/openchart-core';
import { DataTable } from '@opendata-ai/openchart-react';

const data = [
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

const spec: TableSpec = {
  type: 'table',
  data,
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
    <DataTable spec={spec} />
  </div>
);

// Compact variant for small screens
export const FlagsCompact: Story = () => (
  <div className="story-centered story-max-w-380">
    <DataTable spec={spec} />
  </div>
);

// Country comparison with GDP and population
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

/**
 * Parity test: Basic data table with sorting, search, and pagination.
 *
 * Country statistics table showing Infrographic-comparable quality
 * for editorial data tables with multiple sortable columns.
 */

import type { Story } from '@ladle/react';
import type { TableSpec } from '@opendata-ai/core';
import { DataTable } from '@opendata-ai/react';

const data = [
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

const spec: TableSpec = {
  type: 'table',
  data,
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
  <div className="story-centered" style={{ maxWidth: 900 }}>
    <DataTable spec={spec} />
  </div>
);

export const BasicDark: Story = () => (
  <div className="story-centered story-dark-bg" style={{ maxWidth: 900 }}>
    <DataTable spec={spec} darkMode="force" />
  </div>
);

export const BasicCompact: Story = () => (
  <div className="story-centered" style={{ maxWidth: 380 }}>
    <DataTable spec={spec} />
  </div>
);

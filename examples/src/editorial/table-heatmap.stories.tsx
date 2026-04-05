/**
 * Parity test: Heatmap table with temperature data.
 *
 * Climate data with diverging heatmap columns showing
 * Infrographic-comparable quality for colored data tables.
 */

import type { Story } from '@ladle/react';
import type { TableSpec } from '@opendata-ai/openchart-core';
import { DataTable } from '@opendata-ai/openchart-react';

const data = [
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

const spec: TableSpec = {
  type: 'table',
  data,
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
    <DataTable spec={spec} />
  </div>
);

// Election-style results with category colors
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

/**
 * Data transform stories.
 *
 * Demonstrates the four transform types from the Vega-Lite alignment:
 * - Filter: remove rows that don't match a predicate
 * - Bin: create histogram-style bins from continuous data
 * - Calculate: derive new fields via arithmetic expressions
 * - TimeUnit: extract temporal granularities (year, month, etc.)
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Filter transform: show only countries above a GDP threshold
// ---------------------------------------------------------------------------

const filterSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { country: 'United States', gdp: 27.4 },
    { country: 'China', gdp: 17.8 },
    { country: 'Germany', gdp: 4.5 },
    { country: 'Japan', gdp: 4.2 },
    { country: 'India', gdp: 3.7 },
    { country: 'United Kingdom', gdp: 3.3 },
    { country: 'France', gdp: 3.0 },
    { country: 'Italy', gdp: 2.2 },
    { country: 'Brazil', gdp: 2.1 },
    { country: 'Canada', gdp: 2.1 },
    { country: 'Russia', gdp: 1.9 },
    { country: 'South Korea', gdp: 1.7 },
    { country: 'Australia', gdp: 1.7 },
    { country: 'Mexico', gdp: 1.3 },
    { country: 'Spain', gdp: 1.6 },
  ],
  transform: [{ filter: { field: 'gdp', gte: 3.0 } }],
  encoding: {
    x: {
      field: 'gdp',
      type: 'quantitative',
      axis: { label: 'GDP ($ trillions)', format: ',.1f' },
    },
    y: { field: 'country', type: 'nominal' },
  },
  labels: { density: 'all', format: ',.1f' },
  chrome: {
    title: 'Only Seven Economies Clear the $3 Trillion Mark',
    subtitle: 'Nominal GDP 2024, filtered to countries with GDP >= $3T',
    source: 'Source: IMF World Economic Outlook',
    byline: 'Chart: OpenChart',
  },
};

export const FilterTransform = () => (
  <div className="story-chart" style={{ height: 380 }}>
    <Chart spec={filterSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Bin transform: histogram of city temperatures
// ---------------------------------------------------------------------------

const binSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { city: 'Phoenix', avgTemp: 34.4 },
    { city: 'Miami', avgTemp: 31.2 },
    { city: 'Houston', avgTemp: 28.9 },
    { city: 'Dallas', avgTemp: 27.8 },
    { city: 'Atlanta', avgTemp: 25.6 },
    { city: 'Los Angeles', avgTemp: 24.1 },
    { city: 'Charlotte', avgTemp: 23.5 },
    { city: 'San Diego', avgTemp: 22.8 },
    { city: 'Nashville', avgTemp: 22.3 },
    { city: 'Washington DC', avgTemp: 21.1 },
    { city: 'Philadelphia', avgTemp: 19.8 },
    { city: 'New York', avgTemp: 18.9 },
    { city: 'Kansas City', avgTemp: 18.5 },
    { city: 'Chicago', avgTemp: 15.6 },
    { city: 'Boston', avgTemp: 15.2 },
    { city: 'Denver', avgTemp: 14.8 },
    { city: 'Detroit', avgTemp: 14.1 },
    { city: 'Minneapolis', avgTemp: 11.7 },
    { city: 'Seattle', avgTemp: 15.9 },
    { city: 'Portland', avgTemp: 16.2 },
    { city: 'San Francisco', avgTemp: 17.5 },
    { city: 'Salt Lake City', avgTemp: 16.8 },
    { city: 'St. Louis', avgTemp: 19.4 },
    { city: 'Tampa', avgTemp: 29.1 },
    { city: 'Sacramento', avgTemp: 23.9 },
  ],
  transform: [{ bin: { maxbins: 8 }, field: 'avgTemp', as: ['tempBin', 'tempBinEnd'] }],
  encoding: {
    x: { field: 'tempBin', type: 'quantitative', axis: { label: 'Average High Temp (\u00B0C)' } },
    y: {
      field: 'tempBin',
      type: 'quantitative',
      aggregate: 'count',
      axis: { label: 'Number of Cities' },
    },
  },
  chrome: {
    title: 'Most Major US Cities Cluster Between 15\u00B0C and 25\u00B0C',
    subtitle: 'Distribution of average July high temperatures across 25 major US cities',
    source: 'Source: NOAA Climate Normals',
    byline: 'Chart: OpenChart',
  },
};

export const BinTransform = () => (
  <div className="story-chart" style={{ height: 380 }}>
    <Chart spec={binSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Calculate transform: profit margin derived from revenue and cost
// ---------------------------------------------------------------------------

const calculateSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { company: 'Apple', revenue: 394, cost: 223 },
    { company: 'Microsoft', revenue: 245, cost: 135 },
    { company: 'Alphabet', revenue: 350, cost: 245 },
    { company: 'Amazon', revenue: 638, cost: 590 },
    { company: 'Meta', revenue: 165, cost: 105 },
    { company: 'NVIDIA', revenue: 130, cost: 52 },
  ],
  transform: [
    {
      calculate: { op: '-', field: 'revenue', field2: 'cost' },
      as: 'profit',
    },
    {
      calculate: { op: '/', field: 'profit', field2: 'revenue' },
      as: 'margin',
    },
    {
      calculate: { op: '*', field: 'margin', value: 100 },
      as: 'marginPct',
    },
  ],
  encoding: {
    x: {
      field: 'marginPct',
      type: 'quantitative',
      axis: { label: 'Profit Margin (%)', format: '.0f' },
    },
    y: { field: 'company', type: 'nominal' },
  },
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'NVIDIA Leads Big Tech in Profit Margin by a Wide Gap',
    subtitle: 'Net profit margin (%) derived from revenue and cost via calculate transform',
    source: 'Source: Company filings, FY 2024',
    byline: 'Chart: OpenChart',
  },
};

export const CalculateTransform = () => (
  <div className="story-chart" style={{ height: 360 }}>
    <Chart spec={calculateSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// TimeUnit transform: monthly aggregation of daily-ish data
// ---------------------------------------------------------------------------

const timeUnitSpec: ChartSpec = {
  mark: 'bar',
  data: [
    // Simulated monthly retail sales data points
    { date: '2024-01-15', sales: 612 },
    { date: '2024-02-12', sales: 589 },
    { date: '2024-03-18', sales: 645 },
    { date: '2024-04-10', sales: 598 },
    { date: '2024-05-14', sales: 672 },
    { date: '2024-06-11', sales: 701 },
    { date: '2024-07-16', sales: 685 },
    { date: '2024-08-13', sales: 723 },
    { date: '2024-09-17', sales: 698 },
    { date: '2024-10-15', sales: 756 },
    { date: '2024-11-12', sales: 812 },
    { date: '2024-12-10', sales: 945 },
  ],
  transform: [{ timeUnit: 'month', field: 'date', as: 'monthName' }],
  encoding: {
    x: { field: 'monthName', type: 'ordinal' },
    y: {
      field: 'sales',
      type: 'quantitative',
      axis: { label: 'Retail Sales ($B)', format: ',.0f', grid: true },
    },
  },
  labels: { density: 'all', format: ',.0f' },
  chrome: {
    title: 'Holiday Season Drives a Massive Spike in Retail Spending',
    subtitle:
      'US retail sales by month, 2024 ($B). Dates aggregated to month via timeUnit transform.',
    source: 'Source: U.S. Census Bureau',
    byline: 'Chart: OpenChart',
  },
};

export const TimeUnitTransform = () => (
  <div className="story-chart" style={{ height: 380 }}>
    <Chart spec={timeUnitSpec} />
  </div>
);

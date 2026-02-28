/**
 * Line and area chart stories.
 *
 * Demonstrates single line, multi-series, area, stacked area,
 * and responsive behavior using the Chart component.
 */

import type { ChartSpec } from '@openchart/core';
import { Chart } from '@openchart/react';

// ---------------------------------------------------------------------------
// Single line with date axis
// ---------------------------------------------------------------------------

const singleLineSpec: ChartSpec = {
  type: 'line',
  data: [
    { date: '2020-01-01', value: 12 },
    { date: '2020-04-01', value: 8 },
    { date: '2020-07-01', value: 22 },
    { date: '2020-10-01', value: 18 },
    { date: '2021-01-01', value: 28 },
    { date: '2021-04-01', value: 35 },
    { date: '2021-07-01', value: 32 },
    { date: '2021-10-01', value: 42 },
    { date: '2022-01-01', value: 38 },
    { date: '2022-04-01', value: 45 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
  chrome: {
    title: 'Monthly Active Users',
    subtitle: 'Quarterly growth, 2020-2022',
    source: 'Source: Internal Analytics',
  },
};

export const SingleLine = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={singleLineSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Multi-series comparison (3 series)
// ---------------------------------------------------------------------------

const multiSeriesSpec: ChartSpec = {
  type: 'line',
  data: [
    // US
    { date: '2020-01-01', gdp: 2.3, country: 'United States' },
    { date: '2020-07-01', gdp: -3.5, country: 'United States' },
    { date: '2021-01-01', gdp: 5.7, country: 'United States' },
    { date: '2021-07-01', gdp: 4.9, country: 'United States' },
    { date: '2022-01-01', gdp: 2.1, country: 'United States' },
    // UK
    { date: '2020-01-01', gdp: 1.4, country: 'United Kingdom' },
    { date: '2020-07-01', gdp: -9.9, country: 'United Kingdom' },
    { date: '2021-01-01', gdp: 7.4, country: 'United Kingdom' },
    { date: '2021-07-01', gdp: 6.5, country: 'United Kingdom' },
    { date: '2022-01-01', gdp: 3.7, country: 'United Kingdom' },
    // Germany
    { date: '2020-01-01', gdp: 0.6, country: 'Germany' },
    { date: '2020-07-01', gdp: -4.6, country: 'Germany' },
    { date: '2021-01-01', gdp: 2.9, country: 'Germany' },
    { date: '2021-07-01', gdp: 2.6, country: 'Germany' },
    { date: '2022-01-01', gdp: 1.8, country: 'Germany' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'gdp', type: 'quantitative', axis: { label: 'GDP Growth (%)' } },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'GDP Growth Comparison',
    subtitle: 'Quarterly GDP growth rate, 2020-2022',
    source: 'Source: World Bank',
  },
};

export const MultiSeries = () => (
  <div style={{ width: 700, height: 420 }}>
    <Chart spec={multiSeriesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Five series comparison
// ---------------------------------------------------------------------------

const fiveSeriesSpec: ChartSpec = {
  type: 'line',
  data: [
    // Generate 5 series with 4 points each
    ...['Apple', 'Google', 'Microsoft', 'Amazon', 'Meta'].flatMap((company, ci) =>
      [2020, 2021, 2022, 2023].map((year) => ({
        year: `${year}-01-01`,
        revenue: Math.round(
          100 + ci * 30 + (year - 2020) * (15 + ci * 5) + Math.sin(ci + year) * 10,
        ),
        company,
      })),
    ),
  ],
  encoding: {
    x: { field: 'year', type: 'temporal' },
    y: { field: 'revenue', type: 'quantitative', axis: { label: 'Revenue ($B)' } },
    color: { field: 'company', type: 'nominal' },
  },
  chrome: {
    title: 'Big Tech Revenue',
    subtitle: 'Annual revenue in billions, 2020-2023',
    source: 'Source: Company filings',
  },
};

export const FiveSeries = () => (
  <div style={{ width: 800, height: 450 }}>
    <Chart spec={fiveSeriesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Area chart (single)
// ---------------------------------------------------------------------------

const singleAreaSpec: ChartSpec = {
  type: 'area',
  data: [
    { month: '2023-01-01', users: 1200 },
    { month: '2023-02-01', users: 1800 },
    { month: '2023-03-01', users: 2400 },
    { month: '2023-04-01', users: 2100 },
    { month: '2023-05-01', users: 3200 },
    { month: '2023-06-01', users: 3800 },
    { month: '2023-07-01', users: 4100 },
    { month: '2023-08-01', users: 3900 },
    { month: '2023-09-01', users: 4500 },
    { month: '2023-10-01', users: 5200 },
    { month: '2023-11-01', users: 5800 },
    { month: '2023-12-01', users: 6200 },
  ],
  encoding: {
    x: { field: 'month', type: 'temporal' },
    y: { field: 'users', type: 'quantitative', axis: { label: 'Active Users' } },
  },
  chrome: {
    title: 'User Growth',
    subtitle: 'Monthly active users throughout 2023',
    source: 'Source: Platform Analytics',
  },
};

export const AreaChart = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={singleAreaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Stacked area chart
// ---------------------------------------------------------------------------

const stackedAreaSpec: ChartSpec = {
  type: 'area',
  data: [
    { quarter: '2022-Q1', revenue: 45, segment: 'Services' },
    { quarter: '2022-Q2', revenue: 52, segment: 'Services' },
    { quarter: '2022-Q3', revenue: 58, segment: 'Services' },
    { quarter: '2022-Q4', revenue: 63, segment: 'Services' },
    { quarter: '2022-Q1', revenue: 120, segment: 'Products' },
    { quarter: '2022-Q2', revenue: 135, segment: 'Products' },
    { quarter: '2022-Q3', revenue: 128, segment: 'Products' },
    { quarter: '2022-Q4', revenue: 145, segment: 'Products' },
    { quarter: '2022-Q1', revenue: 30, segment: 'Subscriptions' },
    { quarter: '2022-Q2', revenue: 38, segment: 'Subscriptions' },
    { quarter: '2022-Q3', revenue: 42, segment: 'Subscriptions' },
    { quarter: '2022-Q4', revenue: 48, segment: 'Subscriptions' },
  ],
  encoding: {
    x: { field: 'quarter', type: 'temporal' },
    y: { field: 'revenue', type: 'quantitative', axis: { label: 'Revenue ($M)' } },
    color: { field: 'segment', type: 'nominal' },
  },
  chrome: {
    title: 'Revenue by Segment',
    subtitle: 'Quarterly breakdown showing composition',
    source: 'Source: Financial Reports',
  },
};

export const StackedArea = () => (
  <div style={{ width: 700, height: 420 }}>
    <Chart spec={stackedAreaSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Responsive demo
// ---------------------------------------------------------------------------

export const ResponsiveDemo = () => (
  <div className="story-column">
    <div>
      <h3 className="story-heading">Full width (800px)</h3>
      <div className="story-debug-border" style={{ width: 800, height: 350 }}>
        <Chart spec={multiSeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Medium (500px)</h3>
      <div className="story-debug-border" style={{ width: 500, height: 350 }}>
        <Chart spec={multiSeriesSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Compact (320px)</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={multiSeriesSpec} />
      </div>
    </div>
  </div>
);

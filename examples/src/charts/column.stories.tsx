/**
 * Column chart (vertical bars) stories.
 *
 * Real-world editorial data: US nonfarm payrolls, global renewable
 * energy capacity, and US quarterly GDP growth.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Simple columns: US nonfarm payroll additions, 2024
// ---------------------------------------------------------------------------

const simpleColumnSpec: ChartSpec = {
  type: 'column',
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
      axis: { label: 'Jobs added (thousands)' },
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
      background: '#ffffff',
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
  <div className="story-chart" style={{ height: 400 }}>
    <Chart spec={simpleColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Grouped columns: Global renewable energy capacity additions by type
// ---------------------------------------------------------------------------

const groupedColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    { year: '2019', capacity: 98, type: 'Solar' },
    { year: '2019', capacity: 58, type: 'Wind' },
    { year: '2019', capacity: 12, type: 'Hydro' },
    { year: '2020', capacity: 127, type: 'Solar' },
    { year: '2020', capacity: 90, type: 'Wind' },
    { year: '2020', capacity: 20, type: 'Hydro' },
    { year: '2021', capacity: 167, type: 'Solar' },
    { year: '2021', capacity: 93, type: 'Wind' },
    { year: '2021', capacity: 15, type: 'Hydro' },
    { year: '2022', capacity: 222, type: 'Solar' },
    { year: '2022', capacity: 75, type: 'Wind' },
    { year: '2022', capacity: 22, type: 'Hydro' },
    { year: '2023', capacity: 346, type: 'Solar' },
    { year: '2023', capacity: 107, type: 'Wind' },
    { year: '2023', capacity: 24, type: 'Hydro' },
  ],
  encoding: {
    x: { field: 'year', type: 'nominal' },
    y: {
      field: 'capacity',
      type: 'quantitative',
      axis: { label: 'Capacity added (GW)' },
    },
    color: { field: 'type', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2023',
      y: 346,
      text: 'Solar nearly doubled\nin a single year',
      anchor: 'top',
      offset: { dx: -200, dy: -20 },
      connector: true,
    },
  ],
  labels: { density: 'none' },
  chrome: {
    title: 'Solar Is Running Away With the Energy Transition',
    subtitle: 'Global renewable capacity additions by source, 2019-2023 (gigawatts)',
    source: 'Source: International Energy Agency',
    byline: 'Chart: OpenChart',
  },
};

export const GroupedColumns = () => (
  <div className="story-chart" style={{ height: 420 }}>
    <Chart spec={groupedColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Negative values: US quarterly GDP growth, 2020-2024
// ---------------------------------------------------------------------------

const negativeColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    { quarter: "Q1 '20", growth: -5.3 },
    { quarter: "Q2 '20", growth: -31.2 },
    { quarter: "Q3 '20", growth: 33.8 },
    { quarter: "Q4 '20", growth: 4.0 },
    { quarter: "Q2 '21", growth: 7.0 },
    { quarter: "Q4 '21", growth: 7.0 },
    { quarter: "Q1 '22", growth: -1.6 },
    { quarter: "Q2 '22", growth: -0.6 },
    { quarter: "Q4 '22", growth: 2.6 },
    { quarter: "Q2 '23", growth: 2.1 },
    { quarter: "Q3 '23", growth: 4.9 },
    { quarter: "Q4 '23", growth: 3.4 },
    { quarter: "Q2 '24", growth: 3.0 },
    { quarter: "Q4 '24", growth: 2.3 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: {
      field: 'growth',
      type: 'quantitative',
      axis: { label: 'Annualized GDP growth (%)', format: '+.0f' },
    },
  },
  annotations: [
    {
      type: 'refline',
      y: 0,
      style: 'solid',
      stroke: '#334155',
      strokeWidth: 1.5,
    },
    {
      type: 'text',
      x: "Q2 '20",
      y: -31.2,
      text: 'COVID lockdowns triggered\na historic -31.2% contraction',
      anchor: 'right',
      offset: { dx: 120, dy: -60 },
      connector: true,
    },
    {
      type: 'range',
      x1: "Q1 '22",
      x2: "Q2 '22",
      label: '2 negative quarters',
      fill: '#fecaca',
      opacity: 0.3,
    },
  ],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'Pandemic Cratered GDP, But Recovery Was Swift',
    subtitle: 'US real GDP, annualized quarterly change, Q1 2020 through Q4 2024',
    source: 'Source: Bureau of Economic Analysis',
    byline: 'Chart: OpenChart',
  },
};

export const NegativeValues = () => (
  <div className="story-chart" style={{ height: 420 }}>
    <Chart spec={negativeColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Responsive demo
// ---------------------------------------------------------------------------

const compactGroupedColumnSpec: ChartSpec = {
  ...groupedColumnSpec,
  chrome: {
    ...groupedColumnSpec.chrome,
    title: 'Solar Leads Renewables',
    subtitle: 'Capacity additions, 2019-2023 (GW)',
    source: 'Source: IEA',
  },
};

export const ResponsiveDemo = () => (
  <div className="story-column">
    <div>
      <h3 className="story-heading">Full width (700px)</h3>
      <div className="story-debug-border" style={{ width: 700, height: 400 }}>
        <Chart spec={groupedColumnSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Compact (320px)</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={compactGroupedColumnSpec} />
      </div>
    </div>
  </div>
);

/**
 * Column chart (vertical bars) stories.
 *
 * Demonstrates simple columns, grouped columns, negative values,
 * and temporal x-axis.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Simple columns
// ---------------------------------------------------------------------------

const simpleColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    { month: 'Jan', sales: 120 },
    { month: 'Feb', sales: 95 },
    { month: 'Mar', sales: 150 },
    { month: 'Apr', sales: 180 },
    { month: 'May', sales: 210 },
    { month: 'Jun', sales: 195 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'sales', type: 'quantitative', axis: { label: 'Sales ($K)' } },
  },
  chrome: {
    title: 'Monthly Sales',
    subtitle: 'First half of 2024',
    source: 'Source: Sales Database',
  },
};

export const SimpleColumns = () => (
  <div style={{ width: 600, height: 380 }}>
    <Chart spec={simpleColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Grouped columns (3 groups)
// ---------------------------------------------------------------------------

const groupedColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    { quarter: 'Q1', revenue: 45, region: 'Americas' },
    { quarter: 'Q1', revenue: 30, region: 'Europe' },
    { quarter: 'Q1', revenue: 25, region: 'Asia' },
    { quarter: 'Q2', revenue: 52, region: 'Americas' },
    { quarter: 'Q2', revenue: 35, region: 'Europe' },
    { quarter: 'Q2', revenue: 32, region: 'Asia' },
    { quarter: 'Q3', revenue: 48, region: 'Americas' },
    { quarter: 'Q3', revenue: 40, region: 'Europe' },
    { quarter: 'Q3', revenue: 38, region: 'Asia' },
    { quarter: 'Q4', revenue: 60, region: 'Americas' },
    { quarter: 'Q4', revenue: 45, region: 'Europe' },
    { quarter: 'Q4', revenue: 42, region: 'Asia' },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'revenue', type: 'quantitative', axis: { label: 'Revenue ($M)' } },
    color: { field: 'region', type: 'nominal' },
  },
  chrome: {
    title: 'Regional Revenue',
    subtitle: 'Quarterly breakdown by region',
    source: 'Source: Financial Reports',
  },
};

export const GroupedColumns = () => (
  <div style={{ width: 700, height: 400 }}>
    <Chart spec={groupedColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Negative values (waterfall-style)
// ---------------------------------------------------------------------------

const negativeColumnSpec: ChartSpec = {
  type: 'column',
  data: [
    { quarter: 'Q1 2023', growth: 3.2 },
    { quarter: 'Q2 2023', growth: -1.5 },
    { quarter: 'Q3 2023', growth: 2.8 },
    { quarter: 'Q4 2023', growth: -0.3 },
    { quarter: 'Q1 2024', growth: 4.1 },
    { quarter: 'Q2 2024', growth: 1.9 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'growth', type: 'quantitative', axis: { label: 'GDP Growth (%)' } },
  },
  chrome: {
    title: 'GDP Growth Rate',
    subtitle: 'Quarterly changes show recovery pattern',
    source: 'Source: Bureau of Economic Analysis',
  },
};

export const NegativeValues = () => (
  <div style={{ width: 600, height: 380 }}>
    <Chart spec={negativeColumnSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Responsive demo
// ---------------------------------------------------------------------------

export const ResponsiveDemo = () => (
  <div className="story-column">
    <div>
      <h3 className="story-heading">Full width (700px)</h3>
      <div className="story-debug-border" style={{ width: 700, height: 350 }}>
        <Chart spec={groupedColumnSpec} />
      </div>
    </div>
    <div>
      <h3 className="story-heading">Compact (320px)</h3>
      <div className="story-debug-border" style={{ width: 320, height: 300 }}>
        <Chart spec={groupedColumnSpec} />
      </div>
    </div>
  </div>
);

/**
 * Bar chart (horizontal) stories.
 *
 * Demonstrates simple bars, grouped bars, negative values,
 * and responsive behavior using the Chart component.
 */

import type { ChartSpec } from '@openchart/core';
import { Chart } from '@openchart/react';

// ---------------------------------------------------------------------------
// Simple horizontal bars sorted by value
// ---------------------------------------------------------------------------

const simpleBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { language: 'Python', popularity: 28 },
    { language: 'JavaScript', popularity: 22 },
    { language: 'Java', popularity: 16 },
    { language: 'TypeScript', popularity: 12 },
    { language: 'C#', popularity: 10 },
    { language: 'Go', popularity: 7 },
    { language: 'Rust', popularity: 5 },
  ],
  encoding: {
    x: { field: 'popularity', type: 'quantitative', axis: { label: 'Popularity (%)' } },
    y: { field: 'language', type: 'nominal' },
  },
  chrome: {
    title: 'Programming Language Popularity',
    subtitle: 'Stack Overflow Survey 2024',
    source: 'Source: Stack Overflow',
  },
};

export const SimpleBars = () => (
  <div style={{ width: 600, height: 350 }}>
    <Chart spec={simpleBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Grouped bars (2 groups)
// ---------------------------------------------------------------------------

const groupedBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { department: 'Engineering', budget: 450, type: '2023' },
    { department: 'Engineering', budget: 520, type: '2024' },
    { department: 'Marketing', budget: 280, type: '2023' },
    { department: 'Marketing', budget: 310, type: '2024' },
    { department: 'Sales', budget: 350, type: '2023' },
    { department: 'Sales', budget: 380, type: '2024' },
    { department: 'Support', budget: 180, type: '2023' },
    { department: 'Support', budget: 200, type: '2024' },
  ],
  encoding: {
    x: { field: 'budget', type: 'quantitative', axis: { label: 'Budget ($K)' } },
    y: { field: 'department', type: 'nominal' },
    color: { field: 'type', type: 'nominal' },
  },
  chrome: {
    title: 'Department Budgets',
    subtitle: 'Year-over-year comparison',
    source: 'Source: Finance Team',
  },
};

export const GroupedBars = () => (
  <div style={{ width: 650, height: 380 }}>
    <Chart spec={groupedBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Negative values (split layout)
// ---------------------------------------------------------------------------

const negativeBarSpec: ChartSpec = {
  type: 'bar',
  data: [
    { metric: 'Revenue Growth', change: 12 },
    { metric: 'Customer Acquisition', change: 8 },
    { metric: 'Churn Rate', change: -5 },
    { metric: 'Operating Costs', change: -3 },
    { metric: 'Net Profit', change: 15 },
    { metric: 'Support Tickets', change: -10 },
  ],
  encoding: {
    x: { field: 'change', type: 'quantitative', axis: { label: 'Change (%)' } },
    y: { field: 'metric', type: 'nominal' },
  },
  chrome: {
    title: 'Q4 Performance Metrics',
    subtitle: 'Quarter-over-quarter change',
    source: 'Source: Analytics Dashboard',
  },
};

export const NegativeValues = () => (
  <div style={{ width: 600, height: 350 }}>
    <Chart spec={negativeBarSpec} />
  </div>
);

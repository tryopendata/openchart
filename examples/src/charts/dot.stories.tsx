/**
 * Dot plot and lollipop chart stories.
 *
 * Demonstrates simple dot plots, colored dots,
 * and lollipop stems with various data patterns.
 */

import type { ChartSpec } from '@opendata-ai/core';
import { Chart } from '@opendata-ai/react';

// ---------------------------------------------------------------------------
// Simple dot plot
// ---------------------------------------------------------------------------

const simpleDotSpec: ChartSpec = {
  type: 'dot',
  data: [
    { country: 'Norway', index: 96 },
    { country: 'Switzerland', index: 95 },
    { country: 'Ireland', index: 94 },
    { country: 'Iceland', index: 94 },
    { country: 'Germany', index: 93 },
    { country: 'Sweden', index: 93 },
    { country: 'Australia', index: 92 },
    { country: 'Netherlands', index: 92 },
    { country: 'Denmark', index: 91 },
    { country: 'United Kingdom', index: 91 },
  ],
  encoding: {
    x: { field: 'index', type: 'quantitative', axis: { label: 'HDI Score' } },
    y: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'Human Development Index',
    subtitle: 'Top 10 countries by HDI, 2023',
    source: 'Source: UNDP',
  },
};

export const SimpleDotPlot = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={simpleDotSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Colored dots (lollipop with categories)
// ---------------------------------------------------------------------------

const coloredDotSpec: ChartSpec = {
  type: 'dot',
  data: [
    { metric: 'Customer Satisfaction', score: 87, status: 'above target' },
    { metric: 'Employee Engagement', score: 72, status: 'on target' },
    { metric: 'Revenue Growth', score: 94, status: 'above target' },
    { metric: 'Cost Efficiency', score: 58, status: 'below target' },
    { metric: 'Innovation Index', score: 81, status: 'on target' },
    { metric: 'Market Share', score: 45, status: 'below target' },
    { metric: 'Brand Perception', score: 78, status: 'on target' },
  ],
  encoding: {
    x: { field: 'score', type: 'quantitative', axis: { label: 'Score (0-100)' } },
    y: { field: 'metric', type: 'nominal' },
    color: { field: 'status', type: 'nominal' },
  },
  chrome: {
    title: 'KPI Scorecard',
    subtitle: 'Performance against targets, Q4 2024',
    source: 'Source: Executive Dashboard',
  },
};

export const ColoredDots = () => (
  <div style={{ width: 650, height: 380 }}>
    <Chart spec={coloredDotSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Negative values (diverging lollipop)
// ---------------------------------------------------------------------------

const divergingDotSpec: ChartSpec = {
  type: 'dot',
  data: [
    { category: 'Technology', change: 18 },
    { category: 'Healthcare', change: 12 },
    { category: 'Finance', change: 5 },
    { category: 'Energy', change: -8 },
    { category: 'Retail', change: -3 },
    { category: 'Real Estate', change: -15 },
    { category: 'Manufacturing', change: 2 },
  ],
  encoding: {
    x: { field: 'change', type: 'quantitative', axis: { label: 'YoY Change (%)' } },
    y: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Sector Performance',
    subtitle: 'Year-over-year change by industry sector',
    source: 'Source: Market Analysis',
  },
};

export const DivergingLollipop = () => (
  <div style={{ width: 600, height: 350 }}>
    <Chart spec={divergingDotSpec} />
  </div>
);

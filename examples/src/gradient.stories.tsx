/**
 * Gradient fill stories.
 *
 * Demonstrates gradient fills on chart marks using the GradientDef value type.
 * Gradients can be applied via mark.fill (all marks) or conditional encoding
 * (per-datum gradients based on data values).
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// 1. Basic gradient bar chart: all bars share the same gradient via mark.fill
// ---------------------------------------------------------------------------

const basicGradientBarSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'bar',
    fill: {
      gradient: 'linear',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      stops: [
        { offset: 0, color: '#1b7fa3', opacity: 0.4 },
        { offset: 1, color: '#1b7fa3' },
      ],
    },
  },
  data: [
    { city: 'Tokyo', population: 37.4 },
    { city: 'Delhi', population: 32.9 },
    { city: 'Shanghai', population: 29.2 },
    { city: 'Dhaka', population: 23.2 },
    { city: 'Cairo', population: 22.6 },
    { city: 'Beijing', population: 21.5 },
  ],
  encoding: {
    x: { field: 'population', type: 'quantitative', axis: { title: 'Population (millions)' } },
    y: { field: 'city', type: 'nominal' },
  },
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: "World's Largest Cities by Population",
    subtitle: 'Left-to-right linear gradient on horizontal bars via mark.fill',
    source: 'Source: UN World Urbanization Prospects 2024',
  },
};

export const BasicGradientBars = () => (
  <div className="story-chart story-h-400">
    <Chart spec={basicGradientBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 2. Conditional gradients: per-bar gradients based on data
// ---------------------------------------------------------------------------

const conditionalGradientSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { metric: 'Revenue', value: 92 },
    { metric: 'Retention', value: 78 },
    { metric: 'NPS', value: 45 },
    { metric: 'Growth', value: 88 },
    { metric: 'Churn', value: 31 },
    { metric: 'Efficiency', value: 67 },
  ],
  encoding: {
    x: { field: 'metric', type: 'nominal' },
    y: { field: 'value', type: 'quantitative', axis: { title: 'Score' } },
    color: {
      condition: [
        {
          test: { field: 'metric', equal: 'Revenue' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#059669' },
              { offset: 0.5, color: '#34d399' },
              { offset: 1, color: '#a7f3d0' },
            ],
          },
        },
        {
          test: { field: 'metric', equal: 'Retention' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#2563eb' },
              { offset: 1, color: '#93c5fd' },
            ],
          },
        },
        {
          test: { field: 'metric', equal: 'NPS' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#dc2626' },
              { offset: 1, color: '#fca5a5' },
            ],
          },
        },
        {
          test: { field: 'metric', equal: 'Growth' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#7c3aed' },
              { offset: 1, color: '#c4b5fd' },
            ],
          },
        },
        {
          test: { field: 'metric', equal: 'Churn' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#ea580c' },
              { offset: 1, color: '#fdba74' },
            ],
          },
        },
        {
          test: { field: 'metric', equal: 'Efficiency' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#0891b2' },
              { offset: 1, color: '#67e8f9' },
            ],
          },
        },
      ],
      value: '#94a3b8',
    },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'Q4 Performance Scorecard',
    subtitle: 'Each bar has a unique custom gradient via conditional color encoding',
    source: 'Source: Internal KPI dashboard',
  },
};

export const ConditionalGradients = () => (
  <div className="story-chart story-h-400">
    <Chart spec={conditionalGradientSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 3. Area chart with fade-to-transparent gradient
// ---------------------------------------------------------------------------

const areaGradientSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'area',
    fill: {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#6366f1', opacity: 0.85 },
        { offset: 1, color: '#6366f1', opacity: 0.1 },
      ],
    },
  },
  data: [
    { date: '2024-01', users: 1200 },
    { date: '2024-02', users: 1350 },
    { date: '2024-03', users: 1580 },
    { date: '2024-04', users: 1420 },
    { date: '2024-05', users: 1780 },
    { date: '2024-06', users: 2100 },
    { date: '2024-07', users: 2350 },
    { date: '2024-08', users: 2580 },
    { date: '2024-09', users: 2900 },
    { date: '2024-10', users: 3200 },
    { date: '2024-11', users: 3450 },
    { date: '2024-12', users: 3800 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'users', type: 'quantitative', axis: { title: 'Monthly Active Users' } },
  },
  chrome: {
    title: 'User Growth Accelerates Through 2024',
    subtitle: 'Area gradient fades from solid to transparent at the baseline',
    source: 'Source: Product analytics',
  },
};

export const AreaGradientFade = () => (
  <div className="story-chart story-h-400">
    <Chart spec={areaGradientSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 4. Donut chart with radial gradient
// ---------------------------------------------------------------------------

const donutGradientSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 40 },
  data: [
    { category: 'Organic', share: 42 },
    { category: 'Paid Search', share: 28 },
    { category: 'Social', share: 18 },
    { category: 'Referral', share: 12 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: {
      condition: [
        {
          test: { field: 'category', equal: 'Organic' },
          value: {
            gradient: 'radial',
            stops: [
              { offset: 0, color: '#0ea5e9' },
              { offset: 1, color: '#0369a1' },
            ],
          },
        },
        {
          test: { field: 'category', equal: 'Paid Search' },
          value: {
            gradient: 'radial',
            stops: [
              { offset: 0, color: '#f97316' },
              { offset: 1, color: '#c2410c' },
            ],
          },
        },
        {
          test: { field: 'category', equal: 'Social' },
          value: {
            gradient: 'radial',
            stops: [
              { offset: 0, color: '#a855f7' },
              { offset: 1, color: '#7e22ce' },
            ],
          },
        },
        {
          test: { field: 'category', equal: 'Referral' },
          value: {
            gradient: 'radial',
            stops: [
              { offset: 0, color: '#22c55e' },
              { offset: 1, color: '#15803d' },
            ],
          },
        },
      ],
      value: '#94a3b8',
    },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'Traffic Sources',
    subtitle: 'Radial gradients on donut slices, lighter at center',
    source: 'Source: Google Analytics',
  },
};

export const DonutRadialGradient = () => (
  <div className="story-chart story-h-400">
    <Chart spec={donutGradientSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 5. Dark mode + gradient bars
// ---------------------------------------------------------------------------

const darkGradientSpec: ChartSpec = {
  animation: true,
  mark: {
    type: 'bar',
    fill: {
      gradient: 'linear',
      stops: [
        { offset: 0, color: '#38bdf8' },
        { offset: 1, color: '#0284c7', opacity: 0.5 },
      ],
    },
  },
  darkMode: 'force',
  data: [
    { quarter: 'Q1', revenue: 4.2 },
    { quarter: 'Q2', revenue: 5.1 },
    { quarter: 'Q3', revenue: 4.8 },
    { quarter: 'Q4', revenue: 6.3 },
  ],
  encoding: {
    x: { field: 'quarter', type: 'nominal' },
    y: { field: 'revenue', type: 'quantitative', axis: { title: 'Revenue ($M)' } },
  },
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'Quarterly Revenue',
    subtitle: 'Gradient fills on a dark mode chart',
    source: 'Source: Finance team',
  },
};

export const DarkModeGradient = () => (
  <div className="story-chart story-h-400">
    <Chart spec={darkGradientSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 6. Two-color gradient columns (left-to-right on vertical bars)
// ---------------------------------------------------------------------------

const twoColorGradientSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { language: 'Python', popularity: 29 },
    { language: 'JavaScript', popularity: 24 },
    { language: 'TypeScript', popularity: 17 },
    { language: 'Java', popularity: 14 },
    { language: 'Go', popularity: 10 },
  ],
  encoding: {
    x: { field: 'language', type: 'nominal' },
    y: { field: 'popularity', type: 'quantitative', axis: { title: 'Popularity (%)' } },
    color: {
      condition: [
        {
          test: { field: 'language', equal: 'Python' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#3776ab' },
              { offset: 1, color: '#ffd43b' },
            ],
          },
        },
        {
          test: { field: 'language', equal: 'JavaScript' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#f7df1e' },
              { offset: 1, color: '#f7df1e', opacity: 0.4 },
            ],
          },
        },
        {
          test: { field: 'language', equal: 'TypeScript' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#3178c6' },
              { offset: 1, color: '#3178c6', opacity: 0.4 },
            ],
          },
        },
        {
          test: { field: 'language', equal: 'Java' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#e76f00' },
              { offset: 1, color: '#e76f00', opacity: 0.4 },
            ],
          },
        },
        {
          test: { field: 'language', equal: 'Go' },
          value: {
            gradient: 'linear',
            stops: [
              { offset: 0, color: '#00add8' },
              { offset: 1, color: '#00add8', opacity: 0.4 },
            ],
          },
        },
      ],
      value: '#94a3b8',
    },
  },
  labels: { density: 'all' },
  chrome: {
    title: 'Developer Language Preferences',
    subtitle: 'Per-bar gradient fills with brand-inspired color schemes',
    source: 'Source: Developer survey 2024',
  },
};

export const TwoColorGradients = () => (
  <div className="story-chart story-h-400">
    <Chart spec={twoColorGradientSpec} />
  </div>
);

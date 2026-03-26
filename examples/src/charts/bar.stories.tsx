/**
 * Bar chart (horizontal) stories.
 *
 * Real-world editorial data: global causes of death, Olympic medals,
 * and S&P 500 sector performance.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Simple horizontal bars: Top 10 global causes of death (WHO, 2021)
// ---------------------------------------------------------------------------

const simpleBarSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { cause: 'Ischaemic heart disease', deaths: 9.0 },
    { cause: 'COVID-19', deaths: 8.8 },
    { cause: 'Stroke', deaths: 6.8 },
    { cause: 'COPD', deaths: 3.4 },
    { cause: 'Lower respiratory infections', deaths: 2.5 },
    { cause: 'Lung cancers', deaths: 1.9 },
    { cause: "Alzheimer's & dementia", deaths: 1.8 },
    { cause: 'Diabetes', deaths: 1.6 },
    { cause: 'Kidney diseases', deaths: 1.4 },
    { cause: 'Neonatal conditions', deaths: 1.4 },
  ],
  encoding: {
    x: {
      field: 'deaths',
      type: 'quantitative',
      axis: { label: 'Deaths (millions)' },
    },
    y: { field: 'cause', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 9.0,
      y: 'Ischaemic heart disease',
      text: 'Heart disease has been\nthe #1 killer since 2000',
      anchor: 'bottom',
      offset: { dx: -80, dy: 60 },
      connector: true,
    },
    {
      type: 'text',
      x: 8.8,
      y: 'COVID-19',
      text: 'COVID entered the\ntop 10 in 2020',
      anchor: 'top',
      offset: { dx: -80, dy: -80 },
      connector: true,
    },
  ],
  labels: { density: 'all', format: '.1f' },
  chrome: {
    title: 'Heart Disease Still Kills More People Than Anything Else',
    subtitle: 'Top 10 global causes of death, 2021 (millions of deaths per year)',
    source: 'Source: World Health Organization',
    byline: 'Chart: OpenChart',
  },
};

export const SimpleBars = () => (
  <div className="story-chart story-h-420">
    <Chart spec={simpleBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Grouped bars: Paris 2024 Olympic medal counts
// ---------------------------------------------------------------------------

const groupedBarSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { country: 'USA', medals: 40, type: 'Gold' },
    { country: 'USA', medals: 44, type: 'Silver' },
    { country: 'USA', medals: 42, type: 'Bronze' },
    { country: 'China', medals: 40, type: 'Gold' },
    { country: 'China', medals: 27, type: 'Silver' },
    { country: 'China', medals: 24, type: 'Bronze' },
    { country: 'Great Britain', medals: 14, type: 'Gold' },
    { country: 'Great Britain', medals: 22, type: 'Silver' },
    { country: 'Great Britain', medals: 29, type: 'Bronze' },
    { country: 'Japan', medals: 20, type: 'Gold' },
    { country: 'Japan', medals: 12, type: 'Silver' },
    { country: 'Japan', medals: 13, type: 'Bronze' },
  ],
  encoding: {
    x: {
      field: 'medals',
      type: 'quantitative',
      axis: { label: 'Medal count' },
    },
    y: { field: 'country', type: 'nominal' },
    color: { field: 'type', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 44,
      y: 'USA',
      text: 'USA led with\n126 total medals',
      anchor: 'right',
      offset: { dx: 30, dy: -20 },
      connector: true,
    },
    {
      type: 'text',
      x: 40,
      y: 'China',
      text: 'Tied at 40 gold',
      anchor: 'right',
      offset: { dx: 50, dy: 0 },
      connector: true,
    },
  ],
  labels: { density: 'all' },
  chrome: {
    title: 'USA Edges Out China in Paris Despite Tied Gold Count',
    subtitle: 'Medal breakdown by type, Paris 2024 Summer Olympics',
    source: 'Source: International Olympic Committee',
    byline: 'Chart: OpenChart',
  },
};

export const GroupedBars = () => (
  <div className="story-chart story-h-420">
    <Chart spec={groupedBarSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Negative values: S&P 500 sector returns, 2024
// ---------------------------------------------------------------------------

const negativeBarSpec: ChartSpec = {
  animation: true,
  mark: 'bar',
  data: [
    { sector: 'Communication Services', return: 39.7 },
    { sector: 'Information Technology', return: 37.6 },
    { sector: 'Consumer Discretionary', return: 29.5 },
    { sector: 'Financials', return: 28.9 },
    { sector: 'Utilities', return: 20.1 },
    { sector: 'Industrials', return: 16.2 },
    { sector: 'Consumer Staples', return: 12.2 },
    { sector: 'Real Estate', return: 2.0 },
    { sector: 'Energy', return: 1.9 },
    { sector: 'Health Care', return: 1.1 },
    { sector: 'Materials', return: -1.2 },
  ],
  encoding: {
    x: {
      field: 'return',
      type: 'quantitative',
      axis: { label: 'Total return (%)', format: '+.0f' },
    },
    y: { field: 'sector', type: 'nominal' },
  },
  annotations: [
    {
      type: 'refline',
      x: 0,
      style: 'solid',
      stroke: '#334155',
      strokeWidth: 1.5,
    },
    {
      type: 'refline',
      x: 23.3,
      label: 'S&P 500 avg: +23.3%',
      style: 'dashed',
      stroke: '#64748b',
      strokeWidth: 1,
    },
  ],
  labels: { density: 'all', format: '+.1f' },
  chrome: {
    title: 'AI Enthusiasm Lifted Comm Services and Tech Above the Pack',
    subtitle: 'S&P 500 total return by sector, full year 2024',
    source: 'Source: S&P Global',
    byline: 'Chart: OpenChart',
  },
};

export const NegativeValues = () => (
  <div className="story-chart story-h-440">
    <Chart spec={negativeBarSpec} />
  </div>
);

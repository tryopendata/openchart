/**
 * Scatter and bubble chart stories.
 *
 * Demonstrates basic scatter, bubble (size encoding),
 * color grouping, and trend line overlay.
 */

import type { ChartSpec } from '@opendata-ai/core';
import { Chart } from '@opendata-ai/react';

// ---------------------------------------------------------------------------
// Basic scatter (x vs y)
// ---------------------------------------------------------------------------

const basicScatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { hours: 2, score: 55 },
    { hours: 3, score: 62 },
    { hours: 4, score: 68 },
    { hours: 5, score: 71 },
    { hours: 6, score: 78 },
    { hours: 7, score: 82 },
    { hours: 8, score: 85 },
    { hours: 9, score: 88 },
    { hours: 4, score: 60 },
    { hours: 6, score: 73 },
    { hours: 3, score: 58 },
    { hours: 8, score: 90 },
    { hours: 5, score: 65 },
    { hours: 7, score: 76 },
    { hours: 10, score: 92 },
  ],
  encoding: {
    x: { field: 'hours', type: 'quantitative', axis: { label: 'Study Hours' } },
    y: { field: 'score', type: 'quantitative', axis: { label: 'Test Score' } },
  },
  chrome: {
    title: 'Study Hours vs Test Scores',
    subtitle: 'Each point represents a student',
    source: 'Source: Education Research Lab',
  },
};

export const BasicScatter = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={basicScatterSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Bubble chart (size encoding)
// ---------------------------------------------------------------------------

const bubbleSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { gdp: 10, lifeExpectancy: 62, population: 1400, country: 'India' },
    { gdp: 18, lifeExpectancy: 78, population: 330, country: 'USA' },
    { gdp: 12, lifeExpectancy: 77, population: 1400, country: 'China' },
    { gdp: 45, lifeExpectancy: 82, population: 125, country: 'Japan' },
    { gdp: 48, lifeExpectancy: 83, population: 83, country: 'Germany' },
    { gdp: 8, lifeExpectancy: 72, population: 210, country: 'Brazil' },
    { gdp: 5, lifeExpectancy: 55, population: 220, country: 'Nigeria' },
    { gdp: 35, lifeExpectancy: 82, population: 25, country: 'Australia' },
  ],
  encoding: {
    x: { field: 'gdp', type: 'quantitative', axis: { label: 'GDP per Capita ($K)' } },
    y: { field: 'lifeExpectancy', type: 'quantitative', axis: { label: 'Life Expectancy' } },
    size: { field: 'population', type: 'quantitative' },
  },
  chrome: {
    title: 'Wealth vs Health',
    subtitle: 'GDP per capita, life expectancy, bubble size = population (millions)',
    source: 'Source: World Bank 2023',
  },
};

export const BubbleChart = () => (
  <div style={{ width: 700, height: 450 }}>
    <Chart spec={bubbleSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Color grouping by category
// ---------------------------------------------------------------------------

const colorScatterSpec: ChartSpec = {
  type: 'scatter',
  data: [
    { x: 2, y: 4, category: 'Type A' },
    { x: 3, y: 8, category: 'Type A' },
    { x: 5, y: 12, category: 'Type A' },
    { x: 7, y: 14, category: 'Type A' },
    { x: 1, y: 10, category: 'Type B' },
    { x: 4, y: 15, category: 'Type B' },
    { x: 6, y: 20, category: 'Type B' },
    { x: 8, y: 22, category: 'Type B' },
    { x: 2, y: 18, category: 'Type C' },
    { x: 5, y: 25, category: 'Type C' },
    { x: 7, y: 28, category: 'Type C' },
    { x: 9, y: 30, category: 'Type C' },
  ],
  encoding: {
    x: { field: 'x', type: 'quantitative' },
    y: { field: 'y', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Categorized Scatter Plot',
    subtitle: 'Three distinct groups with color encoding',
  },
};

export const ColorGrouping = () => (
  <div style={{ width: 600, height: 400 }}>
    <Chart spec={colorScatterSpec} />
  </div>
);

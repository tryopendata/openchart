/**
 * Parity test: Dumbbell / connected dot plot.
 *
 * Multi-series dot chart with connecting bars showing the range
 * between values per category. Gray bars span min-to-max, with
 * colored dots for each series.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Life Expectancy by Gender: Dumbbell dot plot
// ---------------------------------------------------------------------------

const lifeExpectancySpec: ChartSpec = {
  mark: 'circle',
  data: [
    { country: 'Japan', years: 81.9, gender: 'Male' },
    { country: 'Japan', years: 87.9, gender: 'Female' },
    { country: 'Switzerland', years: 82.0, gender: 'Male' },
    { country: 'Switzerland', years: 85.9, gender: 'Female' },
    { country: 'Australia', years: 81.7, gender: 'Male' },
    { country: 'Australia', years: 85.6, gender: 'Female' },
    { country: 'Sweden', years: 81.6, gender: 'Male' },
    { country: 'Sweden', years: 85.0, gender: 'Female' },
    { country: 'Canada', years: 80.6, gender: 'Male' },
    { country: 'Canada', years: 84.5, gender: 'Female' },
    { country: 'Germany', years: 78.9, gender: 'Male' },
    { country: 'Germany', years: 83.5, gender: 'Female' },
    { country: 'UK', years: 79.5, gender: 'Male' },
    { country: 'UK', years: 83.2, gender: 'Female' },
    { country: 'USA', years: 76.4, gender: 'Male' },
    { country: 'USA', years: 81.3, gender: 'Female' },
    { country: 'China', years: 75.5, gender: 'Male' },
    { country: 'China', years: 81.0, gender: 'Female' },
    { country: 'Mexico', years: 72.3, gender: 'Male' },
    { country: 'Mexico', years: 78.0, gender: 'Female' },
    { country: 'Brazil', years: 73.1, gender: 'Male' },
    { country: 'Brazil', years: 80.3, gender: 'Female' },
    { country: 'India', years: 69.8, gender: 'Male' },
    { country: 'India', years: 72.8, gender: 'Female' },
    { country: 'Russia', years: 68.2, gender: 'Male' },
    { country: 'Russia', years: 78.2, gender: 'Female' },
    { country: 'Nigeria', years: 53.4, gender: 'Male' },
    { country: 'Nigeria', years: 56.1, gender: 'Female' },
  ],
  encoding: {
    x: {
      field: 'years',
      type: 'quantitative',
      axis: { label: 'Life expectancy (years)' },
      scale: { zero: false },
    },
    y: { field: 'country', type: 'nominal' },
    color: { field: 'gender', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: 72,
      y: 'Russia',
      text: "Russia's gender gap\nis 10 years wide",
      connector: true,
      anchor: 'right',
    },
  ],
  chrome: {
    title: 'Women live longer nearly everywhere, but the gap varies widely',
    subtitle: 'Life expectancy at birth by gender, selected countries, 2023',
    source: 'Source: World Bank, UN World Population Prospects 2024',
  },
};

export const LifeExpectancy = () => (
  <div className="story-chart" style={{ height: 550 }}>
    <Chart spec={lifeExpectancySpec} />
  </div>
);

const compactLifeSpec: ChartSpec = {
  ...lifeExpectancySpec,
  chrome: {
    ...lifeExpectancySpec.chrome,
    title: 'Women Live Longer',
    subtitle: 'Life expectancy by gender, 2023',
  },
  labels: { density: 'none' },
};

export const LifeExpectancyCompact = () => (
  <div style={{ width: 360, height: 500 }}>
    <Chart spec={compactLifeSpec} />
  </div>
);

export const LifeExpectancyWide = () => (
  <div style={{ width: 1200, height: 600 }}>
    <Chart spec={lifeExpectancySpec} />
  </div>
);

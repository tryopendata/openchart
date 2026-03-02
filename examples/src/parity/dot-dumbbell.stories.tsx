/**
 * Parity test: Dumbbell / connected dot plot.
 *
 * Multi-series dot chart with connecting bars showing the range
 * between values per category. Gray bars span min-to-max, with
 * colored dots for each series.
 */

import type { ChartSpec } from '@opendata-ai/core';
import { Chart } from '@opendata-ai/react';

// ---------------------------------------------------------------------------
// Life Expectancy by Gender: Dumbbell dot plot
// ---------------------------------------------------------------------------

const lifeExpectancySpec: ChartSpec = {
  type: 'dot',
  data: [
    { country: 'Japan', years: 81.5, gender: 'Male' },
    { country: 'Japan', years: 87.7, gender: 'Female' },
    { country: 'Switzerland', years: 81.8, gender: 'Male' },
    { country: 'Switzerland', years: 85.6, gender: 'Female' },
    { country: 'Australia', years: 81.3, gender: 'Male' },
    { country: 'Australia', years: 85.4, gender: 'Female' },
    { country: 'Sweden', years: 81.3, gender: 'Male' },
    { country: 'Sweden', years: 84.7, gender: 'Female' },
    { country: 'Canada', years: 80.4, gender: 'Male' },
    { country: 'Canada', years: 84.7, gender: 'Female' },
    { country: 'Germany', years: 78.7, gender: 'Male' },
    { country: 'Germany', years: 83.4, gender: 'Female' },
    { country: 'UK', years: 79.4, gender: 'Male' },
    { country: 'UK', years: 83.0, gender: 'Female' },
    { country: 'USA', years: 76.3, gender: 'Male' },
    { country: 'USA', years: 81.4, gender: 'Female' },
    { country: 'China', years: 75.0, gender: 'Male' },
    { country: 'China', years: 80.5, gender: 'Female' },
    { country: 'Mexico', years: 72.1, gender: 'Male' },
    { country: 'Mexico', years: 77.8, gender: 'Female' },
    { country: 'Brazil', years: 72.8, gender: 'Male' },
    { country: 'Brazil', years: 79.9, gender: 'Female' },
    { country: 'India', years: 69.4, gender: 'Male' },
    { country: 'India', years: 72.0, gender: 'Female' },
    { country: 'Russia', years: 67.6, gender: 'Male' },
    { country: 'Russia', years: 77.8, gender: 'Female' },
    { country: 'Nigeria', years: 53.0, gender: 'Male' },
    { country: 'Nigeria', years: 55.7, gender: 'Female' },
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
      text: "Russia's gender gap\nis 10.2 years",
      connector: true,
      anchor: 'right',
    },
  ],
  chrome: {
    title: 'Women live longer nearly everywhere',
    subtitle: 'Life expectancy at birth by gender, selected countries, 2022',
    source: 'Source: World Bank',
  },
};

export const LifeExpectancy = () => (
  <div style={{ width: 700, height: 550 }}>
    <Chart spec={lifeExpectancySpec} />
  </div>
);

export const LifeExpectancyCompact = () => (
  <div style={{ width: 360, height: 500 }}>
    <Chart spec={lifeExpectancySpec} />
  </div>
);

export const LifeExpectancyWide = () => (
  <div style={{ width: 1200, height: 600 }}>
    <Chart spec={lifeExpectancySpec} />
  </div>
);

export const LifeExpectancyDarkMode = () => (
  <div style={{ width: 700, height: 550 }}>
    <Chart spec={lifeExpectancySpec} darkMode="force" />
  </div>
);

/**
 * Parity test: Scatter chart with trend line and categories.
 *
 * Demonstrates Infrographic-comparable quality for editorial scatter plots.
 * Uses GDP per capita vs life expectancy data (classic Gapminder-style).
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// GDP vs Life Expectancy: Scatter with categories and trend
// ---------------------------------------------------------------------------

const scatterSpec: ChartSpec = {
  mark: 'point',
  data: [
    // Americas
    {
      country: 'United States',
      gdpPerCapita: 63544,
      lifeExpectancy: 77.3,
      region: 'Americas',
      pop: 331,
    },
    { country: 'Canada', gdpPerCapita: 43242, lifeExpectancy: 82.2, region: 'Americas', pop: 38 },
    { country: 'Brazil', gdpPerCapita: 6797, lifeExpectancy: 75.9, region: 'Americas', pop: 213 },
    { country: 'Mexico', gdpPerCapita: 8347, lifeExpectancy: 75.1, region: 'Americas', pop: 130 },
    { country: 'Argentina', gdpPerCapita: 8442, lifeExpectancy: 76.5, region: 'Americas', pop: 45 },
    // Europe
    { country: 'Germany', gdpPerCapita: 45724, lifeExpectancy: 81.0, region: 'Europe', pop: 83 },
    { country: 'France', gdpPerCapita: 38625, lifeExpectancy: 82.5, region: 'Europe', pop: 67 },
    {
      country: 'United Kingdom',
      gdpPerCapita: 40285,
      lifeExpectancy: 81.3,
      region: 'Europe',
      pop: 67,
    },
    { country: 'Italy', gdpPerCapita: 31676, lifeExpectancy: 83.5, region: 'Europe', pop: 59 },
    { country: 'Spain', gdpPerCapita: 27057, lifeExpectancy: 83.6, region: 'Europe', pop: 47 },
    // Asia
    { country: 'Japan', gdpPerCapita: 39313, lifeExpectancy: 84.6, region: 'Asia', pop: 125 },
    { country: 'South Korea', gdpPerCapita: 31489, lifeExpectancy: 83.5, region: 'Asia', pop: 52 },
    { country: 'China', gdpPerCapita: 10500, lifeExpectancy: 78.2, region: 'Asia', pop: 1412 },
    { country: 'India', gdpPerCapita: 1901, lifeExpectancy: 70.2, region: 'Asia', pop: 1408 },
    { country: 'Indonesia', gdpPerCapita: 3870, lifeExpectancy: 71.9, region: 'Asia', pop: 273 },
    // Africa
    {
      country: 'South Africa',
      gdpPerCapita: 5091,
      lifeExpectancy: 64.1,
      region: 'Africa',
      pop: 60,
    },
    { country: 'Nigeria', gdpPerCapita: 2066, lifeExpectancy: 54.7, region: 'Africa', pop: 211 },
    { country: 'Egypt', gdpPerCapita: 3019, lifeExpectancy: 72.0, region: 'Africa', pop: 104 },
    { country: 'Ethiopia', gdpPerCapita: 926, lifeExpectancy: 66.6, region: 'Africa', pop: 118 },
    { country: 'Kenya', gdpPerCapita: 1838, lifeExpectancy: 66.7, region: 'Africa', pop: 54 },
  ],
  encoding: {
    x: { field: 'gdpPerCapita', type: 'quantitative', axis: { label: 'GDP per Capita (USD)' } },
    y: {
      field: 'lifeExpectancy',
      type: 'quantitative',
      axis: { label: 'Life Expectancy (years)' },
    },
    color: { field: 'region', type: 'nominal' },
    size: { field: 'pop', type: 'quantitative' },
  },
  annotations: [
    {
      type: 'text',
      x: 63544,
      y: 77.3,
      text: 'United States',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -8 },
    },
    {
      type: 'text',
      x: 39313,
      y: 84.6,
      text: 'Japan',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -4 },
    },
    {
      type: 'text',
      x: 10500,
      y: 78.2,
      text: 'China',
      fontSize: 10,
      connector: false,
      offset: { dx: 10, dy: -4 },
    },
    {
      type: 'text',
      x: 1901,
      y: 70.2,
      text: 'India',
      fontSize: 10,
      connector: false,
      offset: { dx: 10, dy: -4 },
    },
    {
      type: 'text',
      x: 2066,
      y: 54.7,
      text: 'Nigeria',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -4 },
    },
    {
      type: 'text',
      x: 926,
      y: 66.6,
      text: 'Ethiopia',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -4 },
    },
    {
      type: 'text',
      x: 6797,
      y: 75.9,
      text: 'Brazil',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -4 },
    },
    {
      type: 'text',
      x: 45724,
      y: 81.0,
      text: 'Germany',
      fontSize: 10,
      connector: false,
      offset: { dx: 8, dy: -4 },
    },
  ],
  chrome: {
    title: 'Richer countries live longer, but America is a notable outlier',
    subtitle: 'GDP per capita vs life expectancy, bubble size represents population, 2022',
    source: 'Source: World Bank Development Indicators',
  },
};

export const WealthHealth = () => (
  <div className="story-chart" style={{ height: 500 }}>
    <Chart spec={scatterSpec} />
  </div>
);

const compactScatterSpec: ChartSpec = {
  ...scatterSpec,
  chrome: {
    ...scatterSpec.chrome,
    title: 'Wealth Drives Longevity',
    subtitle: 'GDP per capita vs life expectancy',
  },
  labels: { density: 'none' },
};

export const WealthHealthCompact = () => (
  <div style={{ width: 320, height: 350 }}>
    <Chart spec={compactScatterSpec} />
  </div>
);

export const WealthHealthWide = () => (
  <div style={{ width: 1200, height: 600 }}>
    <Chart spec={scatterSpec} />
  </div>
);

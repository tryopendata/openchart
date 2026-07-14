/**
 * Testing / Fixtures — range mark pinned e2e stories (dumbbell, arrow, bar).
 *
 * Pinned by the Playwright visual suite as the pixel-level contract for the
 * range mark family (plan 13). Inline data keeps the fixtures frozen even if
 * the shared gallery datasets change. Do not restyle: this content is a
 * frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// RangeDumbbell — horizontal x/x2 dumbbell, sorted by end value
// ---------------------------------------------------------------------------

const rangeDumbbellSpec: ChartSpec = {
  animation: true,
  mark: 'range',
  data: [
    { country: 'Japan', y2000: 81.1, y2023: 84.7 },
    { country: 'South Korea', y2000: 76.0, y2023: 84.3 },
    { country: 'USA', y2000: 76.7, y2023: 79.3 },
    { country: 'China', y2000: 71.6, y2023: 78.6 },
    { country: 'Brazil', y2000: 70.1, y2023: 75.8 },
    { country: 'Russia', y2000: 65.5, y2023: 73.0 },
    { country: 'India', y2000: 62.7, y2023: 72.0 },
    { country: 'Nigeria', y2000: 46.5, y2023: 54.6 },
  ],
  encoding: {
    y: {
      field: 'country',
      type: 'nominal',
      sort: { field: 'y2023', order: 'ascending' },
    },
    x: {
      field: 'y2000',
      type: 'quantitative',
      title: '2000',
      axis: { title: 'Life expectancy at birth (years)' },
    },
    x2: { field: 'y2023', type: 'quantitative', title: '2023' },
  },
  chrome: {
    title: 'Everyone Is Living Longer, but the Gaps Persist',
    subtitle: 'Life expectancy at birth, 2000 (gray) vs. 2023 (accent), selected countries',
    source: 'Source: UN World Population Prospects 2024',
  },
};

export const RangeDumbbell = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={rangeDumbbellSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// RangeArrow — arrow style with direction coloring
// ---------------------------------------------------------------------------

const rangeArrowSpec: ChartSpec = {
  animation: true,
  mark: { type: 'range', style: 'arrow', colorByDirection: true },
  data: [
    { source: 'Coal', y2010: 44.8, y2024: 15.0 },
    { source: 'Natural gas', y2010: 23.9, y2024: 43.2 },
    { source: 'Nuclear', y2010: 19.6, y2024: 18.2 },
    { source: 'Wind', y2010: 2.3, y2024: 10.3 },
    { source: 'Hydro', y2010: 6.3, y2024: 5.6 },
    { source: 'Solar', y2010: 0.1, y2024: 6.9 },
  ],
  encoding: {
    y: {
      field: 'source',
      type: 'nominal',
      sort: { field: 'y2024', order: 'ascending' },
    },
    x: {
      field: 'y2010',
      type: 'quantitative',
      title: '2010',
      axis: { title: 'Share of US electricity generation (%)' },
    },
    x2: { field: 'y2024', type: 'quantitative', title: '2024' },
  },
  chrome: {
    title: "Gas and Renewables Ate Coal's Lunch",
    subtitle: 'Share of US electricity generation by source, 2010 to 2024',
    source: 'Source: US Energy Information Administration',
  },
};

export const RangeArrow = () => (
  <div className="tfix-chart tfix-h-420">
    <Chart spec={rangeArrowSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// RangeBar — vertical y/y2 floating bar
// ---------------------------------------------------------------------------

const rangeBarSpec: ChartSpec = {
  animation: true,
  mark: { type: 'range', style: 'bar', fill: '#0e7490' },
  data: [
    { month: 'Jan', low: 3.5, high: 9.3 },
    { month: 'Feb', low: 0.9, high: 9.2 },
    { month: 'Mar', low: 3.2, high: 10.8 },
    { month: 'Apr', low: 9.4, high: 19.0 },
    { month: 'May', low: 12.0, high: 22.1 },
    { month: 'Jun', low: 16.8, high: 25.4 },
    { month: 'Jul', low: 22.1, high: 30.2 },
    { month: 'Aug', low: 20.2, high: 27.6 },
    { month: 'Sep', low: 17.3, high: 24.3 },
    { month: 'Oct', low: 12.4, high: 19.3 },
    { month: 'Nov', low: 4.5, high: 11.8 },
    { month: 'Dec', low: 4.2, high: 9.8 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: {
      field: 'low',
      type: 'quantitative',
      title: 'Avg low',
      axis: { title: 'Temperature (°C)' },
    },
    y2: { field: 'high', type: 'quantitative', title: 'Avg high' },
  },
  chrome: {
    title: 'New York Swings 30 Degrees Across the Year',
    subtitle: 'Average daily low to high temperature by month, Central Park, 2023',
    source: 'Source: NOAA GHCN Daily, Central Park (USW00094728)',
  },
};

export const RangeBar = () => (
  <div className="tfix-chart tfix-h-420">
    <Chart spec={rangeBarSpec} />
  </div>
);

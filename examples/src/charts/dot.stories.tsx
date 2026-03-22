/**
 * Dot plot and lollipop chart stories.
 *
 * Demonstrates simple dot plots, colored dots,
 * and lollipop stems with various data patterns.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Simple dot plot — commute times by major US city
// ---------------------------------------------------------------------------

const simpleDotSpec: ChartSpec = {
  mark: 'circle',
  data: [
    { city: 'New York', minutes: 40.6 },
    { city: 'Chicago', minutes: 33.5 },
    { city: 'Philadelphia', minutes: 33.2 },
    { city: 'San Francisco', minutes: 32.2 },
    { city: 'Boston', minutes: 31.7 },
    { city: 'Los Angeles', minutes: 31.7 },
    { city: 'Baltimore', minutes: 30.2 },
    { city: 'Seattle', minutes: 28.8 },
    { city: 'Houston', minutes: 28.4 },
    { city: 'Denver', minutes: 26.1 },
    { city: 'Phoenix', minutes: 25.8 },
    { city: 'Tulsa', minutes: 19.7 },
  ],
  encoding: {
    x: { field: 'minutes', type: 'quantitative', axis: { label: 'Minutes' } },
    y: { field: 'city', type: 'nominal' },
  },
  chrome: {
    title: 'New Yorkers Commute Twice as Long as Tulsans',
    subtitle: 'Average one-way commute time by major US metro area, 2024',
    source: 'Source: U.S. Census Bureau, American Community Survey',
    byline: 'Chart: OpenChart',
  },
};

export const SimpleDotPlot = () => (
  <div className="story-chart story-h-440">
    <Chart spec={simpleDotSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Colored dots — airline on-time performance
// ---------------------------------------------------------------------------

const coloredDotSpec: ChartSpec = {
  mark: 'circle',
  data: [
    { airline: 'Delta', onTime: 83.5, rating: 'Above average' },
    { airline: 'United', onTime: 80.9, rating: 'Above average' },
    { airline: 'Alaska', onTime: 80.2, rating: 'Above average' },
    { airline: 'American', onTime: 77.8, rating: 'Below average' },
    { airline: 'Spirit', onTime: 69.1, rating: 'Below average' },
    { airline: 'Southwest', onTime: 74.6, rating: 'Below average' },
    { airline: 'JetBlue', onTime: 71.2, rating: 'Below average' },
    { airline: 'Frontier', onTime: 73.8, rating: 'Below average' },
  ],
  encoding: {
    x: { field: 'onTime', type: 'quantitative', axis: { label: 'On-time arrival rate (%)' } },
    y: { field: 'airline', type: 'nominal' },
    color: { field: 'rating', type: 'nominal' },
  },
  chrome: {
    title: 'Delta Leads the Pack in Getting You There on Time',
    subtitle: 'Percentage of flights arriving within 15 minutes of schedule, full year 2024',
    source: 'Source: U.S. Dept. of Transportation, Cirium',
    byline: 'Chart: OpenChart',
  },
};

export const ColoredDots = () => (
  <div className="story-chart story-h-380">
    <Chart spec={coloredDotSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Diverging lollipop — US state population change 2020-2024
// ---------------------------------------------------------------------------

const divergingDotSpec: ChartSpec = {
  mark: 'circle',
  data: [
    { state: 'Idaho', change: 10.4 },
    { state: 'Texas', change: 8.8 },
    { state: 'Florida', change: 8.9 },
    { state: 'Montana', change: 7.5 },
    { state: 'South Carolina', change: 6.8 },
    { state: 'North Carolina', change: 5.9 },
    { state: 'Georgia', change: 4.1 },
    { state: 'Colorado', change: 3.2 },
    { state: 'California', change: -0.5 },
    { state: 'Illinois', change: -0.8 },
    { state: 'New York', change: -1.0 },
    { state: 'West Virginia', change: -1.5 },
    { state: 'Hawaii', change: -1.5 },
  ],
  encoding: {
    x: { field: 'change', type: 'quantitative', axis: { label: 'Population change (%)' } },
    y: { field: 'state', type: 'nominal' },
  },
  chrome: {
    title: 'Americans Keep Moving South',
    subtitle: 'Percent population change by state, April 2020 to July 2024',
    source: 'Source: U.S. Census Bureau Population Estimates',
    byline: 'Chart: OpenChart',
  },
};

export const DivergingLollipop = () => (
  <div className="story-chart story-h-440">
    <Chart spec={divergingDotSpec} />
  </div>
);

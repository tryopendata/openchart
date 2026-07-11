/**
 * Testing / Fixtures: continuous color legend pinned e2e stories.
 *
 * Pinned by the Playwright visual suite (e2e/visual/stories.spec.ts):
 * gradient bar for a sequential color scale, binned swatch row for a
 * threshold scale, and a dark-mode diverging ramp with a neutral midpoint
 * label. Do not restyle: this content is a frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// ColorLegendGradient: sequential color scale, gradient bar legend (default on)
// ---------------------------------------------------------------------------

const hotDaysSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', days: 0 },
    { month: 'Feb', days: 0 },
    { month: 'Mar', days: 1 },
    { month: 'Apr', days: 4 },
    { month: 'May', days: 12 },
    { month: 'Jun', days: 26 },
    { month: 'Jul', days: 30 },
    { month: 'Aug', days: 31 },
    { month: 'Sep', days: 25 },
    { month: 'Oct', days: 9 },
    { month: 'Nov', days: 1 },
    { month: 'Dec', days: 0 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'days', type: 'quantitative', axis: { title: 'Days above 90°F' } },
    // Quantitative color triggers the sequential fill scale; the gradient-bar
    // legend is on by default (legend: { show: false } opts out).
    color: { field: 'days', type: 'quantitative' },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Austin Summers Run Five Months Long',
    subtitle: 'Days above 90°F per month, 1991-2020 normals; fill darkens with the count',
    source: 'Source: NOAA Climate Normals',
  },
};

export const ColorLegendGradient = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={hotDaysSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ColorLegendBinned: threshold scale, 4 breaks -> 5 swatches with class-break labels
// ---------------------------------------------------------------------------

const aqiSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', aqi: 38 },
    { month: 'Feb', aqi: 45 },
    { month: 'Mar', aqi: 62 },
    { month: 'Apr', aqi: 71 },
    { month: 'May', aqi: 89 },
    { month: 'Jun', aqi: 118 },
    { month: 'Jul', aqi: 154 },
    { month: 'Aug', aqi: 176 },
    { month: 'Sep', aqi: 121 },
    { month: 'Oct', aqi: 84 },
    { month: 'Nov', aqi: 56 },
    { month: 'Dec', aqi: 41 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'aqi', type: 'quantitative', axis: { title: 'Air quality index' } },
    // Threshold scale with 4 breaks: 5 classes, boundary labels between
    // swatches at the class breaks (Datawrapper-style).
    color: {
      field: 'aqi',
      type: 'quantitative',
      scale: { type: 'threshold', domain: [50, 100, 150, 200], scheme: 'oranges' },
    },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'Wildfire Season Pushes Air Quality Into the Red',
    subtitle: 'Monthly peak AQI; classes follow the EPA breakpoints',
    source: 'Source: EPA AirNow',
  },
};

export const ColorLegendBinned = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={aqiSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ColorLegendDarkDiverging: dark mode + diverging ramp with neutral midpoint
// ---------------------------------------------------------------------------

const tradeBalanceSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { month: 'Jan', balance: -40 },
    { month: 'Feb', balance: -31 },
    { month: 'Mar', balance: -18 },
    { month: 'Apr', balance: -6 },
    { month: 'May', balance: 3 },
    { month: 'Jun', balance: 14 },
    { month: 'Jul', balance: 22 },
    { month: 'Aug', balance: 31 },
    { month: 'Sep', balance: 40 },
    { month: 'Oct', balance: 27 },
    { month: 'Nov', balance: 12 },
    { month: 'Dec', balance: -9 },
  ],
  encoding: {
    x: { field: 'month', type: 'nominal' },
    y: { field: 'balance', type: 'quantitative', axis: { title: 'Balance ($B)' } },
    // Diverging scheme: gradient legend gains a midpoint label at the
    // scale's neutral value (0 here, since the domain is symmetric).
    color: { field: 'balance', type: 'quantitative', scale: { scheme: 'redBlue' } },
  },
  labels: { density: 'none' },
  chrome: {
    title: 'From Deficit to Surplus in Nine Months',
    subtitle: 'Monthly trade balance, $ billions; red is deficit, blue is surplus',
    source: 'Source: Synthetic fixture data',
  },
  darkMode: 'force',
};

export const ColorLegendDarkDiverging = () => (
  <div className="tfix-chart tfix-h-400">
    <Chart spec={tradeBalanceSpec} />
  </div>
);

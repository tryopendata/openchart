/**
 * Dual-axis combo chart stories.
 *
 * Demonstrates independent y-scales with mixed mark types (bars + lines)
 * using LayerSpec with resolve.scale.y = 'independent'.
 *
 * Design decisions following dual-axis best practices:
 * - Two high-contrast colors (blue bars, orange line) so series are immediately distinct
 * - Axis tick and title labels colored to match their series (Datawrapper/Highcharts pattern)
 * - Bars at 0.8 opacity so the line reads through at crossings
 * - Line: 2.5px stroke, monotone curve, filled point markers at each data point
 * - Bar labels omitted to reduce visual competition with the line
 */

import type { LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

const BLUE = '#3E7CB1';
const ORANGE = '#E07B39';
const GREEN = '#3A9E6F';
const RED = '#D64045';

// ---------------------------------------------------------------------------
// Revenue vs. Enrollment: bars for dollars, line for headcount
// ---------------------------------------------------------------------------

const revenueEnrollmentSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'Deficit Grows as Enrollment Drops',
    subtitle: 'Annual net revenue and undergraduate enrollment, 2014–2024',
    source: 'Office of Institutional Research',
  },
  resolve: { scale: { y: 'independent' } },
  layer: [
    {
      mark: { type: 'bar', opacity: 0.85 },
      data: [
        { year: '2014', revenue: 68_000_000 },
        { year: '2015', revenue: 72_000_000 },
        { year: '2016', revenue: 65_000_000 },
        { year: '2017', revenue: 58_000_000 },
        { year: '2018', revenue: 51_000_000 },
        { year: '2019', revenue: 42_000_000 },
        { year: '2020', revenue: 18_000_000 },
        { year: '2021', revenue: 5_000_000 },
        { year: '2022', revenue: -8_000_000 },
        { year: '2023', revenue: -21_000_000 },
        { year: '2024', revenue: -35_000_000 },
      ],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'revenue',
          type: 'quantitative',
          axis: {
            title: 'Net Revenue ($)',
            format: '~s',
            labelColor: BLUE,
            values: [-40_000_000, -20_000_000, 0, 20_000_000, 40_000_000, 60_000_000, 80_000_000],
          },
        },
        color: {
          condition: { test: { field: 'revenue', gte: 0 }, value: GREEN },
          value: RED,
        },
      },
      labels: { density: 'none' },
    },
    {
      mark: {
        type: 'line',
        stroke: ORANGE,
        strokeWidth: 2.5,
        point: true,
        interpolate: 'monotone',
      },
      data: [
        { year: '2014', enrollment: 61_200 },
        { year: '2015', enrollment: 62_400 },
        { year: '2016', enrollment: 61_500 },
        { year: '2017', enrollment: 60_300 },
        { year: '2018', enrollment: 58_900 },
        { year: '2019', enrollment: 57_100 },
        { year: '2020', enrollment: 55_400 },
        { year: '2021', enrollment: 54_200 },
        { year: '2022', enrollment: 52_800 },
        { year: '2023', enrollment: 51_600 },
        { year: '2024', enrollment: 50_300 },
      ],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'enrollment',
          type: 'quantitative',
          axis: {
            title: 'Enrollment',
            format: '~s',
            labelColor: ORANGE,
          },
          scale: { domain: [46_000, 66_000] },
        },
      },
      labels: { density: 'none' },
    },
  ],
};

export const RevenueVsEnrollment = () => (
  <div className="story-chart story-h-460">
    <Chart spec={revenueEnrollmentSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Temperature vs. Precipitation: line for temp, bars for rainfall
// ---------------------------------------------------------------------------

const RAIN_BLUE = '#4A90C4';
const TEMP_AMBER = '#E07B39';

const weatherSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'San Diego Monthly Weather',
    subtitle: 'Average temperature and total precipitation, 2024',
    source: 'National Weather Service',
  },
  resolve: { scale: { y: 'independent' } },
  layer: [
    {
      mark: {
        type: 'area',
        stroke: TEMP_AMBER,
        strokeWidth: 2.5,
        point: true,
        fill: {
          gradient: 'linear',
          x1: 0,
          y1: 0,
          x2: 0,
          y2: 1,
          stops: [
            { offset: 0, color: TEMP_AMBER, opacity: 0.3 },
            { offset: 1, color: TEMP_AMBER, opacity: 0 },
          ],
        },
        interpolate: 'monotone',
      },
      data: [
        { month: 'Jan', temp: 57 },
        { month: 'Feb', temp: 59 },
        { month: 'Mar', temp: 61 },
        { month: 'Apr', temp: 63 },
        { month: 'May', temp: 66 },
        { month: 'Jun', temp: 69 },
        { month: 'Jul', temp: 73 },
        { month: 'Aug', temp: 75 },
        { month: 'Sep', temp: 74 },
        { month: 'Oct', temp: 69 },
        { month: 'Nov', temp: 62 },
        { month: 'Dec', temp: 57 },
      ],
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: {
          field: 'temp',
          type: 'quantitative',
          axis: {
            title: 'Temperature (°F)',
            labelColor: TEMP_AMBER,
          },
          scale: { zero: false },
        },
      },
      labels: { density: 'none' },
    },
    {
      mark: { type: 'bar', fill: RAIN_BLUE, opacity: 0.5 },
      data: [
        { month: 'Jan', precip: 2.3 },
        { month: 'Feb', precip: 2.8 },
        { month: 'Mar', precip: 2.1 },
        { month: 'Apr', precip: 0.8 },
        { month: 'May', precip: 0.2 },
        { month: 'Jun', precip: 0.1 },
        { month: 'Jul', precip: 0.0 },
        { month: 'Aug', precip: 0.1 },
        { month: 'Sep', precip: 0.3 },
        { month: 'Oct', precip: 0.7 },
        { month: 'Nov', precip: 1.5 },
        { month: 'Dec', precip: 2.0 },
      ],
      encoding: {
        x: { field: 'month', type: 'ordinal' },
        y: {
          field: 'precip',
          type: 'quantitative',
          axis: {
            title: 'Precipitation (in)',
            format: '.1f',
            labelColor: RAIN_BLUE,
          },
        },
      },
      labels: { density: 'none' },
    },
  ],
};

export const WeatherDualAxis = () => (
  <div className="story-chart story-h-460">
    <Chart spec={weatherSpec} />
  </div>
);

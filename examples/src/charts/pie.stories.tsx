/**
 * Pie and donut chart stories.
 *
 * Demonstrates basic pie, donut, small-slice grouping,
 * and various category counts.
 */

import type { ChartSpec } from '@opendata-ai/core';
import { Chart } from '@opendata-ai/react';

// ---------------------------------------------------------------------------
// Basic pie (5 categories)
// ---------------------------------------------------------------------------

const basicPieSpec: ChartSpec = {
  type: 'pie',
  data: [
    { browser: 'Chrome', share: 65 },
    { browser: 'Safari', share: 18 },
    { browser: 'Firefox', share: 8 },
    { browser: 'Edge', share: 5 },
    { browser: 'Other', share: 4 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'browser', type: 'nominal' },
  },
  chrome: {
    title: 'Browser Market Share',
    subtitle: 'Global desktop browser usage, 2024',
    source: 'Source: StatCounter',
  },
};

export const BasicPie = () => (
  <div style={{ width: 500, height: 450 }}>
    <Chart spec={basicPieSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Donut with center label
// ---------------------------------------------------------------------------

const donutSpec: ChartSpec = {
  type: 'donut',
  data: [
    { segment: 'Subscriptions', revenue: 45 },
    { segment: 'Advertising', revenue: 30 },
    { segment: 'Services', revenue: 15 },
    { segment: 'Hardware', revenue: 10 },
  ],
  encoding: {
    y: { field: 'revenue', type: 'quantitative' },
    color: { field: 'segment', type: 'nominal' },
  },
  chrome: {
    title: 'Revenue by Segment',
    subtitle: 'Annual breakdown showing subscription dominance',
    source: 'Source: Annual Report',
  },
};

export const DonutChart = () => (
  <div style={{ width: 500, height: 450 }}>
    <Chart spec={donutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Small-slice grouping ("Other")
// ---------------------------------------------------------------------------

const smallSliceSpec: ChartSpec = {
  type: 'pie',
  data: [
    { country: 'United States', emissions: 5000 },
    { country: 'China', emissions: 10000 },
    { country: 'India', emissions: 2600 },
    { country: 'Russia', emissions: 1700 },
    { country: 'Japan', emissions: 1100 },
    { country: 'Germany', emissions: 700 },
    { country: 'South Korea', emissions: 600 },
    { country: 'Iran', emissions: 500 },
    { country: 'Canada', emissions: 400 },
    { country: 'Indonesia', emissions: 350 },
    { country: 'Turkey', emissions: 300 },
    { country: 'Mexico', emissions: 250 },
  ],
  encoding: {
    y: { field: 'emissions', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'CO2 Emissions by Country',
    subtitle: 'Small contributors automatically grouped into "Other"',
    source: 'Source: Global Carbon Project',
  },
};

export const SmallSliceGrouping = () => (
  <div style={{ width: 550, height: 500 }}>
    <Chart spec={smallSliceSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 7-category pie
// ---------------------------------------------------------------------------

const sevenCategorySpec: ChartSpec = {
  type: 'pie',
  data: [
    { day: 'Monday', hours: 8 },
    { day: 'Tuesday', hours: 7 },
    { day: 'Wednesday', hours: 9 },
    { day: 'Thursday', hours: 8 },
    { day: 'Friday', hours: 6 },
    { day: 'Saturday', hours: 3 },
    { day: 'Sunday', hours: 2 },
  ],
  encoding: {
    y: { field: 'hours', type: 'quantitative' },
    color: { field: 'day', type: 'nominal' },
  },
  chrome: {
    title: 'Working Hours by Day',
    subtitle: 'Average weekly distribution',
  },
};

export const SevenCategories = () => (
  <div style={{ width: 500, height: 450 }}>
    <Chart spec={sevenCategorySpec} />
  </div>
);

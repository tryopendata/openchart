/**
 * Pie and donut chart stories.
 *
 * Demonstrates basic pie, donut, small-slice grouping,
 * and various category counts.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// ---------------------------------------------------------------------------
// Basic pie — global smartphone OS market share
// ---------------------------------------------------------------------------

const basicPieSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [
    { os: 'Android', share: 71 },
    { os: 'iOS', share: 28 },
    { os: 'Other', share: 1 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'os', type: 'nominal' },
  },
  chrome: {
    title: 'Android Runs 7 in 10 Smartphones Worldwide',
    subtitle: 'Global mobile operating system market share, 2024',
    source: 'Source: StatCounter Global Stats',
    byline: 'Chart: OpenChart',
  },
};

export const BasicPie = () => (
  <div className="story-chart story-h-450">
    <Chart spec={basicPieSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Donut — US federal budget breakdown
// ---------------------------------------------------------------------------

const donutSpec: ChartSpec = {
  animation: true,
  mark: { type: 'arc', innerRadius: 40 },
  data: [
    { category: 'Healthcare', spending: 24 },
    { category: 'Social Security', spending: 21 },
    { category: 'Defense', spending: 13 },
    { category: 'Net Interest', spending: 13 },
    { category: 'All Other', spending: 29 },
  ],
  encoding: {
    y: { field: 'spending', type: 'quantitative' },
    color: { field: 'category', type: 'nominal' },
  },
  chrome: {
    title: 'Healthcare and Social Security Eat Nearly Half the Federal Budget',
    subtitle: 'Share of $6.9 trillion in federal spending, fiscal year 2024',
    source: 'Source: Congressional Budget Office',
    byline: 'Chart: OpenChart',
  },
};

export const DonutChart = () => (
  <div className="story-chart story-h-450">
    <Chart spec={donutSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// Small-slice grouping ("Other") — global CO2 emissions
// ---------------------------------------------------------------------------

const smallSliceSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [
    { country: 'China', emissions: 12600 },
    { country: 'United States', emissions: 4500 },
    { country: 'India', emissions: 3000 },
    { country: 'Russia', emissions: 1900 },
    { country: 'Japan', emissions: 1000 },
    { country: 'Germany', emissions: 620 },
    { country: 'South Korea', emissions: 590 },
    { country: 'Iran', emissions: 580 },
    { country: 'Canada', emissions: 530 },
    { country: 'Indonesia', emissions: 490 },
    { country: 'Saudi Arabia', emissions: 480 },
    { country: 'Turkey', emissions: 420 },
  ],
  encoding: {
    y: { field: 'emissions', type: 'quantitative' },
    color: { field: 'country', type: 'nominal' },
  },
  chrome: {
    title: 'China and the US Alone Account for 45% of Global CO\u2082',
    subtitle:
      'Annual CO\u2082 emissions in million tonnes, 2024. Small emitters auto-grouped into "Other".',
    source: 'Source: Global Carbon Project',
    byline: 'Chart: OpenChart',
  },
};

export const SmallSliceGrouping = () => (
  <div className="story-chart story-h-500">
    <Chart spec={smallSliceSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// 6-category pie — global energy mix
// ---------------------------------------------------------------------------

const energyMixSpec: ChartSpec = {
  animation: true,
  mark: 'arc',
  data: [
    { source: 'Oil', share: 31 },
    { source: 'Natural Gas', share: 23 },
    { source: 'Coal', share: 26 },
    { source: 'Hydropower', share: 7 },
    { source: 'Nuclear', share: 5 },
    { source: 'Solar & Wind', share: 8 },
  ],
  encoding: {
    y: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal' },
  },
  chrome: {
    title: 'Fossil Fuels Still Power 80% of the World',
    subtitle: 'Share of global primary energy consumption by source, 2024',
    source: 'Source: Energy Institute Statistical Review of World Energy',
    byline: 'Chart: OpenChart',
  },
};

export const SevenCategories = () => (
  <div className="story-chart story-h-450">
    <Chart spec={energyMixSpec} />
  </div>
);

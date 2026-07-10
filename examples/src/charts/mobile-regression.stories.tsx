/**
 * Mobile regression stories.
 *
 * Each story replicates a chart shape that broke on real iOS devices
 * (labs.tryopendata.ai, July 2026 screenshots): clipped titles, colliding
 * value labels, rotated ticks invading bottom chrome, degenerate axis ticks.
 *
 * Driven by e2e/invariants/mobile-invariants.spec.ts across desktop Chrome,
 * mobile Chrome, and mobile WebKit projects. Containers are fluid width so
 * the Playwright viewport controls the rendered width.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

// Long wrapped title + subtitle + source + legend. On iOS the hanging-baseline
// divergence pushed the first title line above the container.
const longTitleSpec: ChartSpec = {
  mark: { type: 'bar', cornerRadius: 3 },
  data: [
    { rating: 'A (22 campuses)', pct: 16.1 },
    { rating: 'B (31 campuses)', pct: 41.5 },
    { rating: 'C (27 campuses)', pct: 73.5 },
    { rating: 'D (12 campuses)', pct: 84.0 },
    { rating: 'F (23 campuses)', pct: 90.7 },
  ],
  encoding: {
    x: { field: 'rating', type: 'nominal', axis: { title: undefined } },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: 'Avg % economically disadvantaged', grid: true },
      scale: { domain: [0, 100], nice: false },
    },
    color: {
      field: 'rating',
      type: 'nominal',
      scale: {
        domain: [
          'A (22 campuses)',
          'B (31 campuses)',
          'C (27 campuses)',
          'D (12 campuses)',
          'F (23 campuses)',
        ],
        range: ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'],
      },
    },
  },
  legend: { show: false },
  labels: { density: 'all', format: '.1f', suffix: '%' },
  chrome: {
    title: 'Inside Austin ISD, ratings track poverty with near-mechanical precision',
    subtitle: 'Average % economically disadvantaged by campus accountability rating, 2024-25',
    source: 'Source: TEA Accountability Summary, campus-level data',
  },
};

export const LongTitleMobile = () => (
  <div className="story-chart story-h-500">
    <Chart spec={longTitleSpec} />
  </div>
);

// Grouped columns, 4 series x 2 categories, labels density 'all'.
// On a phone the short-bar labels ("4%", "5%", "7%") collided into one blob.
const groupedLabelsSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { subject: 'ELA', district: 'Statewide avg', pct: 50 },
    { subject: 'ELA', district: 'Fort Stockton', pct: 28 },
    { subject: 'ELA', district: 'Hallsville', pct: 20 },
    { subject: 'ELA', district: 'Roscoe', pct: 15 },
    { subject: 'Math', district: 'Statewide avg', pct: 45 },
    { subject: 'Math', district: 'Fort Stockton', pct: 4 },
    { subject: 'Math', district: 'Hallsville', pct: 5 },
    { subject: 'Math', district: 'Roscoe', pct: 7 },
  ],
  encoding: {
    x: { field: 'subject', type: 'nominal', axis: { title: undefined } },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: '% meeting grade level', grid: true },
      scale: { domain: [0, 60], nice: false },
    },
    color: { field: 'district', type: 'nominal' },
  },
  legend: { position: 'top' },
  labels: { density: 'all', format: '.0f', suffix: '%' },
  chrome: {
    title: 'STAAR proficiency: vs. statewide',
    subtitle: 'Percentage of students meeting grade level on STAAR exams.',
    source: 'Source: TEA TAPR Campus STAAR & Accountability Data, 2024-25',
  },
};

export const GroupedColumnsLabelsAll = () => (
  <div className="story-chart story-h-500">
    <Chart spec={groupedLabelsSpec} />
  </div>
);

// Horizontal grouped bars, 11 categories x 3 series with value labels.
// On a phone the bars were sliver-thin and labels floated between rows.
const manyRowsData: Array<{ district: string; source: string; dollars: number }> = [];
const districts = [
  'Austin ISD',
  'Point Isabel ISD',
  'Sharyland ISD',
  'Valley View ISD',
  'Mission CISD',
  'La Joya ISD',
  'Brownsville ISD',
  'South Texas ISD',
  'Roma ISD',
  'PSJA ISD',
  'IDEA Public Schools',
];
const revenueBySource: Record<string, [number, number, number]> = {
  'Austin ISD': [650, 10200, 1600],
  'Point Isabel ISD': [1600, 11600, 3600],
  'Sharyland ISD': [7100, 3500, 1600],
  'Valley View ISD': [9800, 2200, 3200],
  'Mission CISD': [10000, 1700, 2300],
  'La Joya ISD': [10400, 1200, 2500],
  'Brownsville ISD': [10400, 1700, 2400],
  'South Texas ISD': [10600, 9900, 1500],
  'Roma ISD': [10800, 934, 2400],
  'PSJA ISD': [11100, 1700, 2300],
  'IDEA Public Schools': [11400, 0, 2500],
};
for (const district of districts) {
  const [state, local, federal] = revenueBySource[district];
  manyRowsData.push({ district, source: 'State', dollars: state });
  manyRowsData.push({ district, source: 'Local', dollars: local });
  manyRowsData.push({ district, source: 'Federal', dollars: federal });
}

const manyRowsSpec: ChartSpec = {
  mark: { type: 'bar', orient: 'horizontal', cornerRadius: 2 },
  data: manyRowsData,
  encoding: {
    y: { field: 'district', type: 'nominal', sort: null, axis: { title: undefined } },
    x: {
      field: 'dollars',
      type: 'quantitative',
      axis: { title: undefined, format: '$~s', grid: true },
    },
    color: { field: 'source', type: 'nominal' },
  },
  legend: { position: 'top' },
  labels: { density: 'all', format: '.3s' },
  chrome: {
    title: 'Where Austin raises locally, the Valley runs on state aid',
    subtitle: 'Per-student revenue by source, 2024-25',
    source: 'Source: TEA PEIMS Summarized Finance',
  },
};

export const GroupedBarsManyRows = () => (
  <div className="story-chart story-h-600">
    <Chart spec={manyRowsSpec} />
  </div>
);

// Grouped horizontal bars whose quantitative x-axis degenerated to a single
// tick ("80") at phone widths.
const domainScoresSpec: ChartSpec = {
  mark: { type: 'bar', orient: 'horizontal', cornerRadius: 2 },
  data: [
    { district: 'Austin ISD', domain: 'Achievement', score: 79 },
    { district: 'Austin ISD', domain: 'Growth', score: 73 },
    { district: 'Austin ISD', domain: 'Closing Gaps', score: 78 },
    { district: 'IDEA Public Schools', domain: 'Achievement', score: 78 },
    { district: 'IDEA Public Schools', domain: 'Growth', score: 73 },
    { district: 'IDEA Public Schools', domain: 'Closing Gaps', score: 83 },
    { district: 'Brownsville ISD', domain: 'Achievement', score: 81 },
    { district: 'Brownsville ISD', domain: 'Growth', score: 76 },
    { district: 'Brownsville ISD', domain: 'Closing Gaps', score: 88 },
    { district: 'PSJA ISD', domain: 'Achievement', score: 80 },
    { district: 'PSJA ISD', domain: 'Growth', score: 77 },
    { district: 'PSJA ISD', domain: 'Closing Gaps', score: 88 },
    { district: 'Roma ISD', domain: 'Achievement', score: 84 },
    { district: 'Roma ISD', domain: 'Growth', score: 77 },
    { district: 'Roma ISD', domain: 'Closing Gaps', score: 88 },
  ],
  encoding: {
    y: { field: 'district', type: 'nominal', sort: null, axis: { title: undefined } },
    x: {
      field: 'score',
      type: 'quantitative',
      axis: { title: 'TEA domain score', grid: true },
      scale: { domain: [0, 100], nice: false },
    },
    color: { field: 'domain', type: 'nominal' },
  },
  legend: { position: 'top' },
  labels: { density: 'all', format: '.0f' },
  chrome: {
    title: "IDEA's growth score matches Austin's at higher per-student spending",
    subtitle: 'TEA accountability domain scores, 2024-25.',
    source: 'Source: TEA Accountability Summary',
  },
};

export const GroupedBarsSparseTicks = () => (
  <div className="story-chart story-h-500">
    <Chart spec={domainScoresSpec} />
  </div>
);

// Five short rotated x labels where one label is much wider than the rest.
// On a phone the axis thinned to every-other (dropping "2023" and "2025")
// even though the narrow labels had ample room — a single wide label
// ("2026 (to wk 17)") forced global decimation.
const oneWideLabelSpec: ChartSpec = {
  mark: { type: 'bar', cornerRadius: 3 },
  data: [
    { year: '2022', cases: 122 },
    { year: '2023', cases: 47 },
    { year: '2024', cases: 266 },
    { year: '2025', cases: 2000 },
    { year: '2026 (to wk 17)', cases: 1600 },
  ],
  encoding: {
    x: { field: 'year', type: 'nominal', axis: { title: undefined } },
    y: {
      field: 'cases',
      type: 'quantitative',
      axis: { title: 'Reported measles cases (year to date)', grid: true },
    },
    color: { field: 'year', type: 'nominal', legend: null },
  },
  legend: { show: false },
  labels: { density: 'all', format: '~s' },
  chrome: {
    title: '2025 was the worst measles year on the weekly record',
    subtitle: 'US measles cases reported to NNDSS, indigenous and imported',
    source: 'Source: CDC NNDSS',
  },
};

export const OneWideXLabel = () => (
  <div className="story-chart story-h-500">
    <Chart spec={oneWideLabelSpec} />
  </div>
);

// Same chart with a larger themed tick font (the deployed blog sets
// axisTick: 14). The bigger glyphs made the old 1-D span overlap genuine, so
// production still dropped "2025" while the default-theme story passed. All
// five labels must render at -45° — rotated labels are parallel ribbons and
// label width cannot make them touch.
const oneWideLabelThemedSpec: ChartSpec = {
  ...oneWideLabelSpec,
  theme: { fonts: { sizes: { axisTick: 14 } } },
};

export const OneWideXLabelLargeTicks = () => (
  <div className="story-chart story-h-500">
    <Chart spec={oneWideLabelThemedSpec} />
  </div>
);

// Five uniform short rotated x labels (percentage buckets). These clearly
// fit at -45°, so none should be thinned even on a phone.
const percentBucketsSpec: ChartSpec = {
  mark: { type: 'bar', cornerRadius: 3 },
  data: [
    { bucket: '0-79%', schools: 3100 },
    { bucket: '80-84%', schools: 1800 },
    { bucket: '85-89%', schools: 3400 },
    { bucket: '90-94%', schools: 7000 },
    { bucket: '95-100%', schools: 21100 },
  ],
  encoding: {
    x: {
      field: 'bucket',
      type: 'nominal',
      axis: { title: 'School-level kindergarten MMR coverage' },
    },
    y: {
      field: 'schools',
      type: 'quantitative',
      axis: { title: 'Number of schools', grid: true },
    },
    color: { field: 'bucket', type: 'nominal', legend: null },
  },
  legend: { show: false },
  labels: { density: 'all', format: '~s' },
  chrome: {
    title: 'More than 5,000 schools sit below 80% MMR coverage',
    subtitle: 'Distribution of school-level kindergarten MMR rates across 31 states',
    source: 'Source: Washington Post compilation of state health department records',
  },
};

export const UniformShortXLabels = () => (
  <div className="story-chart story-h-500">
    <Chart spec={percentBucketsSpec} />
  </div>
);

// Inline y-axis (line chart, continuous y). The tick labels render inside the
// plot above their gridlines, not in a left gutter, so the rotated y-title only
// needs to clear the chart edge. Deck-scale fonts exaggerate the band: before
// the inline-aware offset the title reserved gutter+tick width it never used,
// leaving a large dead gap between the title and the plot.
const inlineYTitleSpec: ChartSpec = {
  mark: { type: 'line', point: true, interpolate: 'monotone' },
  data: [
    { year: '2009-10', pct: 94.2 },
    { year: '2012-13', pct: 94.5 },
    { year: '2015-16', pct: 93.8 },
    { year: '2018-19', pct: 94.7 },
    { year: '2020-21', pct: 95.0 },
    { year: '2023-24', pct: 92.5 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal', axis: { title: undefined } },
    y: {
      field: 'pct',
      type: 'quantitative',
      axis: { title: 'Kindergartners with 2-dose MMR', grid: true, format: '.0f' },
      scale: { domain: [90, 96], nice: false },
    },
  },
  theme: { fonts: { sizes: { body: 21, axisTick: 18 } } },
  chrome: {
    title: 'The national MMR average barely moved: 95.2% to 92.5%',
    subtitle: 'Two-dose MMR coverage among US kindergartners',
    source: 'Source: CDC SchoolVaxView',
  },
};

export const InlineYTitle = () => (
  <div className="story-chart story-h-600">
    <Chart spec={inlineYTitleSpec} />
  </div>
);

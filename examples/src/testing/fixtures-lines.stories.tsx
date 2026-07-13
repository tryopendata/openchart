/**
 * Testing / Fixtures — line & area pinned e2e stories.
 *
 * Verbatim copies of showcase story exports pinned by the Playwright visual
 * and invariant suites. Copied here (with .story- classes renamed to .tfix-)
 * so the gallery redesign can delete/rewrite the originals without breaking
 * the pixel baselines. Do not restyle: this content is a frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// GDPGrowth + GDPGrowthCompact (from editorial/line-multiseries.stories.tsx)
// ---------------------------------------------------------------------------

const gdpLineSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    // United States
    { date: '2018-01-01', gdp: 3.0, country: 'United States' },
    { date: '2018-07-01', gdp: 2.8, country: 'United States' },
    { date: '2019-01-01', gdp: 2.2, country: 'United States' },
    { date: '2019-07-01', gdp: 2.1, country: 'United States' },
    { date: '2020-01-01', gdp: 0.3, country: 'United States' },
    { date: '2020-07-01', gdp: -3.4, country: 'United States' },
    { date: '2021-01-01', gdp: 5.7, country: 'United States' },
    { date: '2021-07-01', gdp: 5.9, country: 'United States' },
    { date: '2022-01-01', gdp: 2.1, country: 'United States' },
    { date: '2022-07-01', gdp: 1.9, country: 'United States' },
    { date: '2023-01-01', gdp: 2.5, country: 'United States' },
    { date: '2023-07-01', gdp: 2.9, country: 'United States' },
    { date: '2024-01-01', gdp: 2.8, country: 'United States' },
    // Euro Area
    { date: '2018-01-01', gdp: 1.8, country: 'Euro Area' },
    { date: '2018-07-01', gdp: 1.6, country: 'Euro Area' },
    { date: '2019-01-01', gdp: 1.3, country: 'Euro Area' },
    { date: '2019-07-01', gdp: 1.2, country: 'Euro Area' },
    { date: '2020-01-01', gdp: -0.1, country: 'Euro Area' },
    { date: '2020-07-01', gdp: -6.4, country: 'Euro Area' },
    { date: '2021-01-01', gdp: 5.3, country: 'Euro Area' },
    { date: '2021-07-01', gdp: 5.2, country: 'Euro Area' },
    { date: '2022-01-01', gdp: 3.4, country: 'Euro Area' },
    { date: '2022-07-01', gdp: 2.3, country: 'Euro Area' },
    { date: '2023-01-01', gdp: 0.5, country: 'Euro Area' },
    { date: '2023-07-01', gdp: 0.4, country: 'Euro Area' },
    { date: '2024-01-01', gdp: 0.8, country: 'Euro Area' },
    // China
    { date: '2018-01-01', gdp: 6.8, country: 'China' },
    { date: '2018-07-01', gdp: 6.5, country: 'China' },
    { date: '2019-01-01', gdp: 6.1, country: 'China' },
    { date: '2019-07-01', gdp: 5.9, country: 'China' },
    { date: '2020-01-01', gdp: -6.8, country: 'China' },
    { date: '2020-07-01', gdp: 4.9, country: 'China' },
    { date: '2021-01-01', gdp: 8.1, country: 'China' },
    { date: '2021-07-01', gdp: 4.0, country: 'China' },
    { date: '2022-01-01', gdp: 3.0, country: 'China' },
    { date: '2022-07-01', gdp: 2.9, country: 'China' },
    { date: '2023-01-01', gdp: 5.2, country: 'China' },
    { date: '2023-07-01', gdp: 4.9, country: 'China' },
    { date: '2024-01-01', gdp: 5.0, country: 'China' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'gdp', type: 'quantitative', axis: { title: 'GDP Growth (%)' } },
    color: { field: 'country', type: 'nominal' },
  },
  annotations: [
    {
      type: 'range',
      x1: '2020-01-01',
      x2: '2020-12-01',
      label: 'COVID-19 recession',
      fill: '#ff6b6b',
      opacity: 0.1,
    },
    {
      type: 'refline',
      y: 0,
      style: 'dashed',
      stroke: '#999999',
    },
  ],
  chrome: {
    title: 'America kept pace with China in 2024, Europe fell behind',
    subtitle: 'Annual GDP growth rate by major economy, 2018-2024',
    source: 'Source: IMF World Economic Outlook, World Bank',
  },
};

export const GDPGrowth = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={gdpLineSpec} />
  </div>
);

const compactGdpSpec: ChartSpec = {
  ...gdpLineSpec,
  chrome: {
    ...gdpLineSpec.chrome,
    title: 'US Keeps Pace With China',
    subtitle: 'GDP growth rate, 2018-2024',
  },
  labels: { density: 'none' },
};

export const GDPGrowthCompact = () => (
  <div
    className="tfix-debug-border tfix-fixed-size"
    style={{ '--w': '320px', '--h': '300px' } as React.CSSProperties}
  >
    <Chart spec={compactGdpSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// FiveSeries (from charts/line.stories.tsx)
// ---------------------------------------------------------------------------

const fiveSeriesSpec: ChartSpec = {
  animation: true,
  mark: 'line',
  data: [
    // Amazon (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 60, company: 'Amazon' },
    { year: '2019-04-01', revenue: 63, company: 'Amazon' },
    { year: '2019-07-01', revenue: 70, company: 'Amazon' },
    { year: '2019-10-01', revenue: 87, company: 'Amazon' },
    { year: '2020-01-01', revenue: 75, company: 'Amazon' },
    { year: '2020-04-01', revenue: 89, company: 'Amazon' },
    { year: '2020-07-01', revenue: 96, company: 'Amazon' },
    { year: '2020-10-01', revenue: 126, company: 'Amazon' },
    { year: '2021-01-01', revenue: 109, company: 'Amazon' },
    { year: '2021-04-01', revenue: 113, company: 'Amazon' },
    { year: '2021-07-01', revenue: 111, company: 'Amazon' },
    { year: '2021-10-01', revenue: 137, company: 'Amazon' },
    { year: '2022-01-01', revenue: 116, company: 'Amazon' },
    { year: '2022-04-01', revenue: 121, company: 'Amazon' },
    { year: '2022-07-01', revenue: 127, company: 'Amazon' },
    { year: '2022-10-01', revenue: 150, company: 'Amazon' },
    { year: '2023-01-01', revenue: 127, company: 'Amazon' },
    { year: '2023-04-01', revenue: 134, company: 'Amazon' },
    { year: '2023-07-01', revenue: 143, company: 'Amazon' },
    { year: '2023-10-01', revenue: 170, company: 'Amazon' },
    { year: '2024-01-01', revenue: 143, company: 'Amazon' },
    { year: '2024-04-01', revenue: 148, company: 'Amazon' },
    { year: '2024-07-01', revenue: 159, company: 'Amazon' },
    { year: '2024-10-01', revenue: 188, company: 'Amazon' },
    // Apple (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 58, company: 'Apple' },
    { year: '2019-04-01', revenue: 54, company: 'Apple' },
    { year: '2019-07-01', revenue: 64, company: 'Apple' },
    { year: '2019-10-01', revenue: 92, company: 'Apple' },
    { year: '2020-01-01', revenue: 59, company: 'Apple' },
    { year: '2020-04-01', revenue: 60, company: 'Apple' },
    { year: '2020-07-01', revenue: 65, company: 'Apple' },
    { year: '2020-10-01', revenue: 112, company: 'Apple' },
    { year: '2021-01-01', revenue: 90, company: 'Apple' },
    { year: '2021-04-01', revenue: 81, company: 'Apple' },
    { year: '2021-07-01', revenue: 83, company: 'Apple' },
    { year: '2021-10-01', revenue: 124, company: 'Apple' },
    { year: '2022-01-01', revenue: 97, company: 'Apple' },
    { year: '2022-04-01', revenue: 83, company: 'Apple' },
    { year: '2022-07-01', revenue: 90, company: 'Apple' },
    { year: '2022-10-01', revenue: 117, company: 'Apple' },
    { year: '2023-01-01', revenue: 95, company: 'Apple' },
    { year: '2023-04-01', revenue: 82, company: 'Apple' },
    { year: '2023-07-01', revenue: 90, company: 'Apple' },
    { year: '2023-10-01', revenue: 120, company: 'Apple' },
    { year: '2024-01-01', revenue: 91, company: 'Apple' },
    { year: '2024-04-01', revenue: 86, company: 'Apple' },
    { year: '2024-07-01', revenue: 95, company: 'Apple' },
    { year: '2024-10-01', revenue: 124, company: 'Apple' },
    // Alphabet/Google (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 36, company: 'Alphabet' },
    { year: '2019-04-01', revenue: 39, company: 'Alphabet' },
    { year: '2019-07-01', revenue: 40, company: 'Alphabet' },
    { year: '2019-10-01', revenue: 46, company: 'Alphabet' },
    { year: '2020-01-01', revenue: 41, company: 'Alphabet' },
    { year: '2020-04-01', revenue: 38, company: 'Alphabet' },
    { year: '2020-07-01', revenue: 46, company: 'Alphabet' },
    { year: '2020-10-01', revenue: 57, company: 'Alphabet' },
    { year: '2021-01-01', revenue: 55, company: 'Alphabet' },
    { year: '2021-04-01', revenue: 62, company: 'Alphabet' },
    { year: '2021-07-01', revenue: 65, company: 'Alphabet' },
    { year: '2021-10-01', revenue: 75, company: 'Alphabet' },
    { year: '2022-01-01', revenue: 68, company: 'Alphabet' },
    { year: '2022-04-01', revenue: 70, company: 'Alphabet' },
    { year: '2022-07-01', revenue: 69, company: 'Alphabet' },
    { year: '2022-10-01', revenue: 76, company: 'Alphabet' },
    { year: '2023-01-01', revenue: 70, company: 'Alphabet' },
    { year: '2023-04-01', revenue: 75, company: 'Alphabet' },
    { year: '2023-07-01', revenue: 77, company: 'Alphabet' },
    { year: '2023-10-01', revenue: 86, company: 'Alphabet' },
    { year: '2024-01-01', revenue: 81, company: 'Alphabet' },
    { year: '2024-04-01', revenue: 85, company: 'Alphabet' },
    { year: '2024-07-01', revenue: 88, company: 'Alphabet' },
    { year: '2024-10-01', revenue: 96, company: 'Alphabet' },
    // Microsoft (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 31, company: 'Microsoft' },
    { year: '2019-04-01', revenue: 34, company: 'Microsoft' },
    { year: '2019-07-01', revenue: 33, company: 'Microsoft' },
    { year: '2019-10-01', revenue: 37, company: 'Microsoft' },
    { year: '2020-01-01', revenue: 35, company: 'Microsoft' },
    { year: '2020-04-01', revenue: 38, company: 'Microsoft' },
    { year: '2020-07-01', revenue: 37, company: 'Microsoft' },
    { year: '2020-10-01', revenue: 43, company: 'Microsoft' },
    { year: '2021-01-01', revenue: 42, company: 'Microsoft' },
    { year: '2021-04-01', revenue: 46, company: 'Microsoft' },
    { year: '2021-07-01', revenue: 45, company: 'Microsoft' },
    { year: '2021-10-01', revenue: 52, company: 'Microsoft' },
    { year: '2022-01-01', revenue: 49, company: 'Microsoft' },
    { year: '2022-04-01', revenue: 52, company: 'Microsoft' },
    { year: '2022-07-01', revenue: 50, company: 'Microsoft' },
    { year: '2022-10-01', revenue: 53, company: 'Microsoft' },
    { year: '2023-01-01', revenue: 53, company: 'Microsoft' },
    { year: '2023-04-01', revenue: 56, company: 'Microsoft' },
    { year: '2023-07-01', revenue: 57, company: 'Microsoft' },
    { year: '2023-10-01', revenue: 62, company: 'Microsoft' },
    { year: '2024-01-01', revenue: 62, company: 'Microsoft' },
    { year: '2024-04-01', revenue: 65, company: 'Microsoft' },
    { year: '2024-07-01', revenue: 65, company: 'Microsoft' },
    { year: '2024-10-01', revenue: 70, company: 'Microsoft' },
    // Meta (quarterly revenue, $B)
    { year: '2019-01-01', revenue: 15, company: 'Meta' },
    { year: '2019-04-01', revenue: 17, company: 'Meta' },
    { year: '2019-07-01', revenue: 18, company: 'Meta' },
    { year: '2019-10-01', revenue: 21, company: 'Meta' },
    { year: '2020-01-01', revenue: 18, company: 'Meta' },
    { year: '2020-04-01', revenue: 19, company: 'Meta' },
    { year: '2020-07-01', revenue: 21, company: 'Meta' },
    { year: '2020-10-01', revenue: 28, company: 'Meta' },
    { year: '2021-01-01', revenue: 26, company: 'Meta' },
    { year: '2021-04-01', revenue: 29, company: 'Meta' },
    { year: '2021-07-01', revenue: 29, company: 'Meta' },
    { year: '2021-10-01', revenue: 34, company: 'Meta' },
    { year: '2022-01-01', revenue: 28, company: 'Meta' },
    { year: '2022-04-01', revenue: 29, company: 'Meta' },
    { year: '2022-07-01', revenue: 28, company: 'Meta' },
    { year: '2022-10-01', revenue: 32, company: 'Meta' },
    { year: '2023-01-01', revenue: 29, company: 'Meta' },
    { year: '2023-04-01', revenue: 32, company: 'Meta' },
    { year: '2023-07-01', revenue: 34, company: 'Meta' },
    { year: '2023-10-01', revenue: 40, company: 'Meta' },
    { year: '2024-01-01', revenue: 36, company: 'Meta' },
    { year: '2024-04-01', revenue: 39, company: 'Meta' },
    { year: '2024-07-01', revenue: 41, company: 'Meta' },
    { year: '2024-10-01', revenue: 48, company: 'Meta' },
  ],
  encoding: {
    x: {
      field: 'year',
      type: 'temporal',
      axis: { tickCount: 6 },
      scale: { domain: ['2019-01-01', '2024-10-01'] },
    },
    y: {
      field: 'revenue',
      type: 'quantitative',
      axis: { title: 'Revenue ($B)', format: ',.0f', grid: true },
    },
    color: { field: 'company', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2020-10-01',
      y: 126,
      text: 'Pandemic\ne-commerce boom',
      anchor: 'left',
      offset: { dx: -90, dy: -30 },
      connector: true,
    },
  ],
  legend: { position: 'top' },
  labels: { density: 'endpoints', format: ',.0f' },
  chrome: {
    eyebrow: 'Equities · Big Tech',
    title: 'Big Tech Roars Past $2 Trillion in Combined Revenue',
    subtitle: 'Quarterly revenue in billions USD, 2019-2024',
    source: 'Source: Company filings (SEC 10-K)',
    byline: 'Chart: OpenChart',
  },
  metrics: [
    { label: 'COMBINED Q4', value: '$582B', delta: '+12.4%', deltaTone: 'up' },
    { label: 'LEADER', value: 'Apple', secondary: '$120B' },
    { label: 'FASTEST GROWING', value: 'NVIDIA', secondary: '+265%' },
    { label: '5-YR CAGR', value: '+18.6%' },
  ],
};

export const FiveSeries = () => (
  <div className="tfix-chart tfix-h-460">
    <Chart spec={fiveSeriesSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// MultiSeriesAreaOverlap (from charts/line.stories.tsx)
// ---------------------------------------------------------------------------

const multiSeriesAreaOverlapSpec: ChartSpec = {
  animation: true,
  mark: 'area',
  data: [
    // Netflix: dominant in 2020, slow erosion as competitors arrive
    { date: '2020-01-01', share: 0.42, service: 'Netflix' },
    { date: '2021-01-01', share: 0.35, service: 'Netflix' },
    { date: '2022-01-01', share: 0.3, service: 'Netflix' },
    { date: '2023-01-01', share: 0.27, service: 'Netflix' },
    { date: '2024-01-01', share: 0.24, service: 'Netflix' },
    // Disney+: launched late 2019, rapid early growth, plateau
    { date: '2020-01-01', share: 0.22, service: 'Disney+' },
    { date: '2021-01-01', share: 0.25, service: 'Disney+' },
    { date: '2022-01-01', share: 0.26, service: 'Disney+' },
    { date: '2023-01-01', share: 0.25, service: 'Disney+' },
    { date: '2024-01-01', share: 0.24, service: 'Disney+' },
    // Prime Video: steady mid-pack
    { date: '2020-01-01', share: 0.22, service: 'Prime' },
    { date: '2021-01-01', share: 0.23, service: 'Prime' },
    { date: '2022-01-01', share: 0.23, service: 'Prime' },
    { date: '2023-01-01', share: 0.23, service: 'Prime' },
    { date: '2024-01-01', share: 0.23, service: 'Prime' },
    // Max (HBO Max): late entrant, climbing fast, overtakes Disney+ around Q3 2023
    { date: '2020-01-01', share: 0.06, service: 'Max' },
    { date: '2021-01-01', share: 0.14, service: 'Max' },
    { date: '2022-01-01', share: 0.21, service: 'Max' },
    { date: '2023-01-01', share: 0.25, service: 'Max' },
    { date: '2024-01-01', share: 0.3, service: 'Max' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'share',
      type: 'quantitative',
      // Opt OUT of stacking. Multi-series bar/area now defaults to stacked,
      // so overlap mode requires an explicit `stack: null`.
      stack: null,
      axis: { format: '.0%', grid: true, tickCount: 5 },
      scale: { domain: [0, 0.5] },
    },
    color: { field: 'service', type: 'nominal' },
  },
  // Mock 2 keeps both the bottom legend and the right-side endpoint column.
  // Pinning the legend to the bottom keeps it clear of the right-side
  // endpoint column (the default top placement would land in the same band).
  legend: { show: true, position: 'bottom' },
  // Don't set endpointLabels -> default `true` for multi-series, which is what
  // the mock asks for.
  annotations: [
    {
      type: 'text',
      x: '2023-07-01',
      y: 0.25,
      text: 'Max overtakes Disney+',
      subtitle: 'Q3 2023',
      dot: true,
      anchor: 'top',
      offset: { dx: 0, dy: -36 },
      connector: true,
    },
  ],
  // Don't set `labels.density: 'none'` here — the suppression truth table
  // treats that as a global "no labels" hint and switches off the endpoint
  // column too. The truth table already drops end-of-line labels when either
  // the legend or the endpoint column is showing, so leaving labels unset is
  // safe and lets the endpoint column render.
  chrome: {
    title: 'The lead changes hands every other year',
    subtitle:
      "Overlapping multi-series areas use lower fill opacity (12%) and lines stay full-strength to preserve each series' shape.",
    source: 'Source: OpenData · Streaming Subscriber Panel',
    byline: 'tryOpenData.ai',
  },
};

export const MultiSeriesAreaOverlap = () => (
  <div className="tfix-chart tfix-h-520">
    <Chart spec={multiSeriesAreaOverlapSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// MultiSeriesAreaStacked (from charts/line.stories.tsx)
// ---------------------------------------------------------------------------

const multiSeriesAreaStackedSpec: ChartSpec = {
  animation: true,
  mark: 'area',
  // Spend is in raw dollars so the d3-format `$~s` SI prefix prints e.g. "$26M".
  // Storing values pre-scaled to millions and trying to suffix "M" through
  // d3-format requires a custom locale, so we lift the values into raw dollars.
  data: [
    // AWS: ~17M -> ~26M, the leader, slight wobble in mid-2024
    { date: '2023-01-01', spend: 17_000_000, vendor: 'AWS' },
    { date: '2023-02-01', spend: 17_400_000, vendor: 'AWS' },
    { date: '2023-03-01', spend: 17_800_000, vendor: 'AWS' },
    { date: '2023-04-01', spend: 18_200_000, vendor: 'AWS' },
    { date: '2023-05-01', spend: 18_600_000, vendor: 'AWS' },
    { date: '2023-06-01', spend: 19_000_000, vendor: 'AWS' },
    { date: '2023-07-01', spend: 19_400_000, vendor: 'AWS' },
    { date: '2023-08-01', spend: 19_700_000, vendor: 'AWS' },
    { date: '2023-09-01', spend: 20_000_000, vendor: 'AWS' },
    { date: '2023-10-01', spend: 20_400_000, vendor: 'AWS' },
    { date: '2023-11-01', spend: 20_700_000, vendor: 'AWS' },
    { date: '2023-12-01', spend: 21_000_000, vendor: 'AWS' },
    { date: '2024-01-01', spend: 21_500_000, vendor: 'AWS' },
    { date: '2024-02-01', spend: 22_000_000, vendor: 'AWS' },
    { date: '2024-03-01', spend: 22_600_000, vendor: 'AWS' },
    { date: '2024-04-01', spend: 23_000_000, vendor: 'AWS' },
    { date: '2024-05-01', spend: 23_400_000, vendor: 'AWS' },
    { date: '2024-06-01', spend: 23_800_000, vendor: 'AWS' },
    { date: '2024-07-01', spend: 24_400_000, vendor: 'AWS' },
    { date: '2024-08-01', spend: 25_000_000, vendor: 'AWS' },
    { date: '2024-09-01', spend: 25_400_000, vendor: 'AWS' },
    { date: '2024-10-01', spend: 25_800_000, vendor: 'AWS' },
    { date: '2024-11-01', spend: 26_000_000, vendor: 'AWS' },
    // Azure: ~12M -> ~21M, catching up the fastest
    { date: '2023-01-01', spend: 12_000_000, vendor: 'Azure' },
    { date: '2023-02-01', spend: 12_400_000, vendor: 'Azure' },
    { date: '2023-03-01', spend: 12_800_000, vendor: 'Azure' },
    { date: '2023-04-01', spend: 13_200_000, vendor: 'Azure' },
    { date: '2023-05-01', spend: 13_600_000, vendor: 'Azure' },
    { date: '2023-06-01', spend: 14_000_000, vendor: 'Azure' },
    { date: '2023-07-01', spend: 14_500_000, vendor: 'Azure' },
    { date: '2023-08-01', spend: 15_000_000, vendor: 'Azure' },
    { date: '2023-09-01', spend: 15_400_000, vendor: 'Azure' },
    { date: '2023-10-01', spend: 15_800_000, vendor: 'Azure' },
    { date: '2023-11-01', spend: 16_200_000, vendor: 'Azure' },
    { date: '2023-12-01', spend: 16_600_000, vendor: 'Azure' },
    { date: '2024-01-01', spend: 17_000_000, vendor: 'Azure' },
    { date: '2024-02-01', spend: 17_400_000, vendor: 'Azure' },
    { date: '2024-03-01', spend: 17_800_000, vendor: 'Azure' },
    { date: '2024-04-01', spend: 18_200_000, vendor: 'Azure' },
    { date: '2024-05-01', spend: 18_600_000, vendor: 'Azure' },
    { date: '2024-06-01', spend: 19_000_000, vendor: 'Azure' },
    { date: '2024-07-01', spend: 19_400_000, vendor: 'Azure' },
    { date: '2024-08-01', spend: 19_800_000, vendor: 'Azure' },
    { date: '2024-09-01', spend: 20_200_000, vendor: 'Azure' },
    { date: '2024-10-01', spend: 20_600_000, vendor: 'Azure' },
    { date: '2024-11-01', spend: 20_900_000, vendor: 'Azure' },
    // GCP: ~6M -> ~12M, smaller but steady gains
    { date: '2023-01-01', spend: 6_000_000, vendor: 'GCP' },
    { date: '2023-02-01', spend: 6_200_000, vendor: 'GCP' },
    { date: '2023-03-01', spend: 6_500_000, vendor: 'GCP' },
    { date: '2023-04-01', spend: 6_800_000, vendor: 'GCP' },
    { date: '2023-05-01', spend: 7_100_000, vendor: 'GCP' },
    { date: '2023-06-01', spend: 7_400_000, vendor: 'GCP' },
    { date: '2023-07-01', spend: 7_700_000, vendor: 'GCP' },
    { date: '2023-08-01', spend: 8_000_000, vendor: 'GCP' },
    { date: '2023-09-01', spend: 8_300_000, vendor: 'GCP' },
    { date: '2023-10-01', spend: 8_600_000, vendor: 'GCP' },
    { date: '2023-11-01', spend: 8_900_000, vendor: 'GCP' },
    { date: '2023-12-01', spend: 9_200_000, vendor: 'GCP' },
    { date: '2024-01-01', spend: 9_500_000, vendor: 'GCP' },
    { date: '2024-02-01', spend: 9_800_000, vendor: 'GCP' },
    { date: '2024-03-01', spend: 10_100_000, vendor: 'GCP' },
    { date: '2024-04-01', spend: 10_400_000, vendor: 'GCP' },
    { date: '2024-05-01', spend: 10_600_000, vendor: 'GCP' },
    { date: '2024-06-01', spend: 10_800_000, vendor: 'GCP' },
    { date: '2024-07-01', spend: 11_000_000, vendor: 'GCP' },
    { date: '2024-08-01', spend: 11_300_000, vendor: 'GCP' },
    { date: '2024-09-01', spend: 11_500_000, vendor: 'GCP' },
    { date: '2024-10-01', spend: 11_700_000, vendor: 'GCP' },
    { date: '2024-11-01', spend: 11_900_000, vendor: 'GCP' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 7 } },
    y: {
      field: 'spend',
      type: 'quantitative',
      // Opt INTO stacking. Mock 1 reads as a parts-of-a-whole hyperscaler total.
      stack: 'zero',
      axis: { format: '$~s', grid: true, tickCount: 4 },
    },
    color: { field: 'vendor', type: 'nominal' },
  },
  // Endpoint column with open-circle markers on each series. `showMarker: true`
  // is the default; it's restated here to make the story self-documenting.
  endpointLabels: { showMarker: true },
  // No bottom legend; the endpoint column owns series identification.
  legend: { show: false },
  chrome: {
    title: 'AWS still leads, but Azure is catching up fastest',
    subtitle: 'Monthly infrastructure spend by hyperscaler · multi-series area, $M',
    source: 'Source: OpenData · Vendor Spend Panel',
    byline: 'tryOpenData.ai',
  },
};

export const MultiSeriesAreaStacked = () => (
  <div className="tfix-chart tfix-h-520">
    <Chart spec={multiSeriesAreaStackedSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// EditorialSingleLine (from charts/line.stories.tsx) — pinned dark fixture
// ---------------------------------------------------------------------------

const nvidiaCloses: Array<{ date: string; close: number }> = [
  { date: '2022-11-01', close: 14.61 },
  { date: '2022-12-01', close: 14.61 },
  { date: '2023-01-01', close: 19.55 },
  { date: '2023-02-01', close: 23.21 },
  { date: '2023-03-01', close: 27.78 },
  { date: '2023-04-01', close: 27.71 },
  { date: '2023-05-01', close: 37.86 },
  { date: '2023-06-01', close: 42.28 },
  { date: '2023-07-01', close: 46.78 },
  { date: '2023-08-01', close: 49.25 },
  { date: '2023-09-01', close: 43.51 },
  { date: '2023-10-01', close: 40.78 },
  { date: '2023-11-01', close: 46.7 },
  { date: '2023-12-01', close: 49.52 },
  { date: '2024-01-01', close: 61.59 },
  { date: '2024-02-01', close: 78.78 },
  { date: '2024-03-01', close: 90.36 },
  { date: '2024-04-01', close: 86.4 },
  { date: '2024-05-01', close: 109.6 },
  { date: '2024-06-01', close: 123.54 },
  { date: '2024-07-01', close: 117.02 },
  { date: '2024-08-01', close: 119.37 },
  { date: '2024-09-01', close: 121.44 },
  { date: '2024-10-01', close: 132.76 },
  { date: '2024-11-01', close: 138.25 },
  { date: '2024-12-01', close: 134.29 },
  { date: '2025-01-01', close: 120.07 },
  { date: '2025-02-01', close: 124.92 },
  { date: '2025-03-01', close: 108.38 },
  { date: '2025-04-01', close: 109.02 },
  { date: '2025-05-01', close: 135.13 },
  { date: '2025-06-01', close: 157.99 },
  { date: '2025-07-01', close: 173.5 },
  { date: '2025-08-01', close: 180.75 },
  { date: '2025-09-01', close: 191.04 },
  { date: '2025-10-01', close: 202.0 },
  { date: '2025-11-01', close: 186.1 },
];

const editorialSingleLineDarkSpec: ChartSpec = {
  animation: false,
  mark: { type: 'line', interpolate: 'monotone', strokeWidth: 1.75, point: false },
  data: nvidiaCloses,
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 5 } },
    y: {
      field: 'close',
      type: 'quantitative',
      axis: { format: '$.0f', grid: true, tickPosition: 'inline' },
    },
  },
  chrome: {
    eyebrow: 'Equities · Single ticker',
    title: 'NVIDIA Corporation',
    subtitle: 'Daily close, 3-year history',
    source: 'Source: Nasdaq historical data',
    byline: 'Chart: OpenChart',
    brand: 'tryOpenData.ai',
  },
  metrics: [
    { label: 'CLOSE', value: '$186.10', delta: '+1.4%', deltaTone: 'up' },
    { label: 'ALL-TIME HIGH', value: '$202.00' },
    { label: '3-YR RETURN', value: '+1,228%', secondary: '10.3x' },
    { label: 'AVG MONTHLY', value: '$104.95' },
  ],
  annotations: [
    {
      type: 'text',
      x: '2025-10-01',
      y: 202,
      text: 'All-time high · $202\nOct 2025',
      connector: 'drop-line',
      anchor: 'left',
    },
    {
      type: 'refline',
      y: 105,
      label: '3-yr avg · $105',
      style: 'dashed',
    },
    {
      type: 'range',
      x1: '2023-01-01',
      x2: '2023-04-01',
      label: 'ChatGPT mania',
    },
  ],
  darkMode: 'force',
};

export const EditorialSingleLine = () => (
  <div className="tfix-chart tfix-h-550">
    <Chart spec={editorialSingleLineDarkSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// MultiSeriesLine (from infographic.stories.tsx)
// ---------------------------------------------------------------------------

const lineSpec: ChartSpec = {
  mark: 'line',
  data: [
    // YouTube
    { date: '2023-01-01', mau: 2300, platform: 'YouTube' },
    { date: '2023-04-01', mau: 2340, platform: 'YouTube' },
    { date: '2023-07-01', mau: 2390, platform: 'YouTube' },
    { date: '2023-10-01', mau: 2420, platform: 'YouTube' },
    { date: '2024-01-01', mau: 2460, platform: 'YouTube' },
    { date: '2024-04-01', mau: 2500, platform: 'YouTube' },
    { date: '2024-07-01', mau: 2540, platform: 'YouTube' },
    { date: '2024-10-01', mau: 2580, platform: 'YouTube' },
    // Instagram
    { date: '2023-01-01', mau: 1480, platform: 'Instagram' },
    { date: '2023-04-01', mau: 1520, platform: 'Instagram' },
    { date: '2023-07-01', mau: 1550, platform: 'Instagram' },
    { date: '2023-10-01', mau: 1580, platform: 'Instagram' },
    { date: '2024-01-01', mau: 1600, platform: 'Instagram' },
    { date: '2024-04-01', mau: 1620, platform: 'Instagram' },
    { date: '2024-07-01', mau: 1640, platform: 'Instagram' },
    { date: '2024-10-01', mau: 1630, platform: 'Instagram' },
    // TikTok
    { date: '2023-01-01', mau: 1200, platform: 'TikTok' },
    { date: '2023-04-01', mau: 1310, platform: 'TikTok' },
    { date: '2023-07-01', mau: 1420, platform: 'TikTok' },
    { date: '2023-10-01', mau: 1500, platform: 'TikTok' },
    { date: '2024-01-01', mau: 1580, platform: 'TikTok' },
    { date: '2024-04-01', mau: 1680, platform: 'TikTok' },
    { date: '2024-07-01', mau: 1790, platform: 'TikTok' },
    { date: '2024-10-01', mau: 1880, platform: 'TikTok' },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal', axis: { tickCount: 4 } },
    y: {
      field: 'mau',
      type: 'quantitative',
      axis: { title: 'Monthly active users (millions)' },
    },
    color: { field: 'platform', type: 'nominal' },
  },
  annotations: [
    {
      type: 'text',
      x: '2024-04-01',
      y: 1650,
      text: 'TikTok overtakes Instagram\nin Q2 2024',
      fontSize: 11,
      anchor: 'left',
      offset: { dx: 0, dy: 45 },
      connector: true,
      background: true,
    },
    {
      type: 'text',
      x: '2023-07-01',
      y: 2390,
      text: 'YouTube holds steady\nabove 2.5B',
      fontSize: 11,
      anchor: 'bottom',
      offset: { dy: -12 },
      connector: false,
    },
  ],
  labels: { density: 'endpoints', offsets: { YouTube: { dy: 16 } } },
  legend: { position: 'bottom-right' },
  chrome: {
    title: "TikTok's Meteoric Rise Overtakes Instagram",
    subtitle: 'Monthly active users by platform, quarterly 2023-2024',
    source: 'Source: Data.ai, company reports',
    byline: 'Chart: OpenChart',
  },
};

export const MultiSeriesLine = () => (
  <div className="tfix-chart tfix-h-450">
    <Chart spec={lineSpec} />
  </div>
);

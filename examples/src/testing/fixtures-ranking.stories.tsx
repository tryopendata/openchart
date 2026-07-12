/**
 * Testing / Fixtures — slope + bump recipe pinned e2e stories (plan 14).
 *
 * Pinned by the Playwright visual suite as the pixel-level contract for the
 * ranking-and-change recipe family. These specs are copy-pasteable recipes:
 * they must stay byte-identical to the specs on docs/ranking-and-change.md
 * and use only public spec surface. Do not restyle: this content is a
 * frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// SlopeMarketShare — classic 2-point slope with both-end name + value labels
// ---------------------------------------------------------------------------

const slopeMarketShareSpec: ChartSpec = {
  mark: 'line',
  data: [
    { year: '2019', brand: 'Samsung', share: 0.216 },
    { year: '2024', brand: 'Samsung', share: 0.19 },
    { year: '2019', brand: 'Huawei', share: 0.176 },
    { year: '2024', brand: 'Huawei', share: 0.043 },
    { year: '2019', brand: 'Apple', share: 0.139 },
    { year: '2024', brand: 'Apple', share: 0.187 },
    { year: '2019', brand: 'Xiaomi', share: 0.092 },
    { year: '2024', brand: 'Xiaomi', share: 0.136 },
    { year: '2019', brand: 'Oppo', share: 0.083 },
    { year: '2024', brand: 'Oppo', share: 0.087 },
  ],
  encoding: {
    x: { field: 'year', type: 'ordinal' },
    y: {
      field: 'share',
      type: 'quantitative',
      axis: false,
      scale: { zero: false },
    },
    color: { field: 'brand', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label value',
    format: '.0%',
  },
  legend: { show: false },
  chrome: {
    title: 'Apple and Xiaomi Split What Huawei Lost',
    subtitle: 'Share of global smartphone shipments, 2019 vs 2024',
    source: 'Source: IDC Worldwide Quarterly Mobile Phone Tracker',
  },
};

export const SlopeMarketShare = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={slopeMarketShareSpec} />
  </div>
);

// 320px container: explicit endpointLabels config keeps both-end labels at
// the compact breakpoint, where a slope would otherwise lose its values.
export const SlopeMarketShareCompact = () => (
  <div
    className="tfix-debug-border tfix-fixed-size"
    style={{ '--w': '320px', '--h': '360px' } as React.CSSProperties}
  >
    <Chart spec={slopeMarketShareSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// BumpConstructors — 6-season bump chart: rank 1 at top, ordinal rank ticks
// ---------------------------------------------------------------------------

const bumpConstructorsSpec: ChartSpec = {
  mark: { type: 'line', interpolate: 'monotone', point: true },
  data: [
    { season: '2019', team: 'Mercedes', position: 1 },
    { season: '2020', team: 'Mercedes', position: 1 },
    { season: '2021', team: 'Mercedes', position: 1 },
    { season: '2022', team: 'Mercedes', position: 3 },
    { season: '2023', team: 'Mercedes', position: 2 },
    { season: '2024', team: 'Mercedes', position: 4 },
    { season: '2019', team: 'Red Bull', position: 3 },
    { season: '2020', team: 'Red Bull', position: 2 },
    { season: '2021', team: 'Red Bull', position: 2 },
    { season: '2022', team: 'Red Bull', position: 1 },
    { season: '2023', team: 'Red Bull', position: 1 },
    { season: '2024', team: 'Red Bull', position: 3 },
    { season: '2019', team: 'Ferrari', position: 2 },
    { season: '2020', team: 'Ferrari', position: 6 },
    { season: '2021', team: 'Ferrari', position: 3 },
    { season: '2022', team: 'Ferrari', position: 2 },
    { season: '2023', team: 'Ferrari', position: 3 },
    { season: '2024', team: 'Ferrari', position: 2 },
    { season: '2019', team: 'McLaren', position: 4 },
    { season: '2020', team: 'McLaren', position: 3 },
    { season: '2021', team: 'McLaren', position: 4 },
    { season: '2022', team: 'McLaren', position: 5 },
    { season: '2023', team: 'McLaren', position: 4 },
    { season: '2024', team: 'McLaren', position: 1 },
    { season: '2019', team: 'Alpine', position: 5 },
    { season: '2020', team: 'Alpine', position: 5 },
    { season: '2021', team: 'Alpine', position: 5 },
    { season: '2022', team: 'Alpine', position: 4 },
    { season: '2023', team: 'Alpine', position: 6 },
    { season: '2024', team: 'Alpine', position: 6 },
  ],
  encoding: {
    x: { field: 'season', type: 'ordinal' },
    y: {
      field: 'position',
      type: 'quantitative',
      scale: { reverse: true, zero: false },
      axis: { values: [1, 2, 3, 4, 5, 6], format: 'ordinal' },
    },
    color: { field: 'team', type: 'nominal' },
  },
  endpointLabels: {
    ends: 'both',
    content: 'label',
    showMarker: false,
  },
  legend: { show: false },
  chrome: {
    title: 'McLaren Went From Midfield to Champions',
    subtitle: 'Formula 1 constructors championship, final position by season',
    source: 'Source: FIA official standings',
  },
};

export const BumpConstructors = () => (
  <div className="tfix-chart tfix-h-460">
    <Chart spec={bumpConstructorsSpec} />
  </div>
);

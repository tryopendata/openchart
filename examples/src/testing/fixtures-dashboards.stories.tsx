/**
 * Testing / Fixtures Dashboards — pinned e2e stories for the phase-7 tile
 * surfaces: the metric pill row (label 11/500, value 600/-0.02em, delta chips)
 * and the chrome economy rules that drop gridlines under 150px and axes under
 * 200px.
 *
 * These use the library's own `chrome.metrics` row rather than the gallery's
 * hand-built StatCard, so the baseline pins a rendered OpenChart surface.
 *
 * Inline data keeps the fixtures frozen. Do not restyle: pixel contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures Dashboards' };

// ---------------------------------------------------------------------------
// Frozen data — weekly active users, in thousands.
// ---------------------------------------------------------------------------

const weeklyActive = [
  { week: '2024-09-02', users: 412 },
  { week: '2024-09-09', users: 419 },
  { week: '2024-09-16', users: 408 },
  { week: '2024-09-23', users: 431 },
  { week: '2024-09-30', users: 447 },
  { week: '2024-10-07', users: 452 },
  { week: '2024-10-14', users: 468 },
  { week: '2024-10-21', users: 461 },
  { week: '2024-10-28', users: 486 },
  { week: '2024-11-04', users: 502 },
  { week: '2024-11-11', users: 517 },
  { week: '2024-11-18', users: 534 },
];

// ---------------------------------------------------------------------------
// KpiTile — the metric pill row over a compact area chart. Sized at 620x420:
// the engine strips the metric row below MIN_BAR_WIDTH (480px) or with under
// 150px of chart area left, and a chart too short for its chrome loses the
// eyebrow first. A 360x320 version of this fixture pinned a baseline with
// neither, which is not a KPI tile.
// ---------------------------------------------------------------------------

const kpiSpec: ChartSpec = {
  animation: false,
  mark: { type: 'area', interpolate: 'monotone' },
  data: weeklyActive,
  encoding: {
    x: { field: 'week', type: 'temporal' },
    y: { field: 'users', type: 'quantitative' },
  },
  chrome: {
    eyebrow: 'Engagement',
    title: 'Weekly actives crossed half a million',
  },
  metrics: [
    { label: 'THIS WEEK', value: '534K', delta: '+3.3%', deltaTone: 'up' },
    { label: 'VS 12 WEEKS', value: '+29.6%' },
    { label: 'CHURN', value: '2.1%', delta: '-0.4pp', deltaTone: 'up' },
  ],
};

export const KpiTile = () => (
  <div className="tfix-chart" style={{ maxWidth: '620px', height: '420px' }}>
    <Chart spec={kpiSpec} />
  </div>
);

export const KpiTileDark = () => (
  <div
    className="tfix-chart oc-dark"
    style={{ maxWidth: '620px', height: '420px', background: 'var(--oc-bg)' }}
  >
    <Chart spec={kpiSpec} darkMode="force" />
  </div>
);

// ---------------------------------------------------------------------------
// TinyTile140 — 140px tall. Chrome economy drops the gridlines (under 150px)
// and the axes (under 200px) so the trend keeps the whole frame.
// ---------------------------------------------------------------------------

const tinyTileSpec: ChartSpec = {
  animation: false,
  mark: { type: 'line', interpolate: 'monotone' },
  data: weeklyActive,
  encoding: {
    x: { field: 'week', type: 'temporal' },
    y: { field: 'users', type: 'quantitative' },
  },
  chrome: {
    title: 'Weekly actives',
  },
};

export const TinyTile = () => (
  <div className="tfix-chart" style={{ maxWidth: '280px', height: '140px' }}>
    <Chart spec={tinyTileSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// TinyTileMetrics — 160px tall, cramped height class (100-199px) with a
// metric row. wantsMetrics/wantsSearch gate on chromeMode !== 'hidden', and
// cramped now renders chromeMode 'compact' instead of 'hidden', so a titled
// tile in this range reserves space for its metric bar where it previously
// couldn't. Pins that this stays legible rather than fighting the title.
// ---------------------------------------------------------------------------

const tinyTileMetricsSpec: ChartSpec = {
  animation: false,
  mark: { type: 'line', interpolate: 'monotone' },
  data: weeklyActive,
  encoding: {
    x: { field: 'week', type: 'temporal' },
    y: { field: 'users', type: 'quantitative' },
  },
  chrome: {
    title: 'Weekly actives',
  },
  metrics: [{ label: 'THIS WEEK', value: '534K', delta: '+3.3%', deltaTone: 'up' }],
};

export const TinyTileMetrics = () => (
  <div className="tfix-chart" style={{ maxWidth: '280px', height: '160px' }}>
    <Chart spec={tinyTileMetricsSpec} />
  </div>
);

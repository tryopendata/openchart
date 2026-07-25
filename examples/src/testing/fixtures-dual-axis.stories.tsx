/**
 * Testing / Fixtures — dual-axis and trendline pinned e2e stories.
 *
 * Verbatim copies of showcase story exports pinned by the Playwright visual
 * suite. Copied here (per the fixtures convention) so the gallery redesign can
 * delete/rewrite the originals without breaking the pixel baselines. Do not
 * restyle: this content is a frozen contract.
 *
 * Neither shape had a baseline before: every dual-axis assertion stopped at
 * engine layout, and the scatter trendline overlay was only unit-tested.
 */

import type { ChartSpec, LayerSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import { collegeFinances } from '../data';
import './testing.css';

export default { title: 'Testing / Fixtures' };

const BLUE = '#0e7490';
const ORANGE = '#e07b39';

// ---------------------------------------------------------------------------
// DualAxisCombo (from gallery/charts-building-blocks.stories.tsx)
// ---------------------------------------------------------------------------

const dualAxisSpec: LayerSpec = {
  animation: true,
  chrome: {
    title: 'Deficit Grows as Enrollment Slides',
    subtitle:
      'Net revenue (bars) and undergraduate enrollment (line) on independent y-axes, 2014-2024',
    source: collegeFinances.source,
  },
  resolve: { scale: { y: 'independent' } },
  layer: [
    {
      mark: { type: 'bar', opacity: 0.85 },
      data: [...collegeFinances.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'revenue',
          type: 'quantitative',
          axis: {
            title: 'Net revenue ($)',
            format: '~s',
            labelColor: BLUE,
            values: [-40_000_000, -20_000_000, 0, 20_000_000, 40_000_000, 60_000_000, 80_000_000],
          },
        },
        color: {
          condition: { test: { field: 'revenue', gte: 0 }, value: BLUE },
          value: '#d64045',
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
      data: [...collegeFinances.data],
      encoding: {
        x: { field: 'year', type: 'ordinal' },
        y: {
          field: 'enrollment',
          type: 'quantitative',
          axis: { title: 'Enrollment', format: '~s', labelColor: ORANGE },
          scale: { domain: [46_000, 66_000] },
        },
      },
      labels: { density: 'none' },
    },
  ],
};

export const DualAxisCombo = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={dualAxisSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// ScatterTrendline — SVG scatter with the trendline overlay
// ---------------------------------------------------------------------------

/** Deterministic PRNG so the cloud is identical run to run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const trendlineRand = mulberry32(3);
const scatterTrendlineSpec: ChartSpec = {
  animation: true,
  mark: { type: 'point', trendline: true, size: 4, opacity: 0.6 },
  // Correlated cloud so the fitted line has a visible, stable slope.
  data: Array.from({ length: 160 }, (_, i) => {
    const x = Math.round(trendlineRand() * 1000) / 10;
    const y = Math.round((x * 0.6 + 15 + (trendlineRand() - 0.5) * 30) * 10) / 10;
    return { id: `p${i}`, x, y };
  }),
  encoding: {
    x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
    y: { field: 'y', type: 'quantitative' },
    key: { field: 'id', type: 'nominal' },
  },
  chrome: {
    title: 'Scatter With Fitted Trendline',
    subtitle: 'SVG point marks with the regression overlay',
    source: 'Deterministic PRNG, seed 3',
  },
};

export const ScatterTrendline = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={scatterTrendlineSpec} />
  </div>
);

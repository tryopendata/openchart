/**
 * Testing / Fixtures: waffle mark pinned e2e stories.
 *
 * Pinned by the Playwright visual suite as the pixel-level contract for the
 * waffle mark (plan 15): a 10x10 unit grid filled bottom-left to top-right
 * by rows, plus color.highlight composition. Inline data keeps the fixtures
 * frozen. Do not restyle: this content is a frozen contract.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

// ---------------------------------------------------------------------------
// WaffleBasic: 10x10 grid, three categories, whole-number shares
// ---------------------------------------------------------------------------

const waffleBasicSpec: ChartSpec = {
  animation: true,
  mark: 'waffle',
  data: [
    { tenure: 'Own with mortgage', share: 40 },
    { tenure: 'Own outright', share: 26 },
    { tenure: 'Rent', share: 34 },
  ],
  encoding: {
    theta: { field: 'share', type: 'quantitative' },
    color: { field: 'tenure', type: 'nominal' },
  },
  chrome: {
    title: 'How 100 Households Are Housed',
    subtitle: 'Housing tenure per 100 US households. Each square is one household.',
    source: 'Illustrative data',
  },
};

export const WaffleBasic = () => (
  <div className="tfix-chart tfix-h-480">
    <Chart spec={waffleBasicSpec} />
  </div>
);

// ---------------------------------------------------------------------------
// WaffleHighlight: color.highlight singles out one category; fractional
// shares exercise the largest-remainder rounding (62.5 / 27.1 / 10.4 -> 63 /
// 27 / 10 cells)
// ---------------------------------------------------------------------------

const waffleHighlightSpec: ChartSpec = {
  animation: true,
  mark: 'waffle',
  data: [
    { source: 'Fossil fuels', share: 62.5 },
    { source: 'Renewables', share: 27.1 },
    { source: 'Nuclear', share: 10.4 },
  ],
  encoding: {
    theta: { field: 'share', type: 'quantitative' },
    color: { field: 'source', type: 'nominal', highlight: 'Renewables' },
  },
  chrome: {
    title: 'Renewables Power 27 of Every 100 Kilowatt-Hours',
    subtitle: 'Share of world electricity generation. Figures rounded to whole cells.',
    source: 'Illustrative data',
  },
};

export const WaffleHighlight = () => (
  <div className="tfix-chart tfix-h-480">
    <Chart spec={waffleHighlightSpec} />
  </div>
);

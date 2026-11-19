/**
 * Testing / Motion Choreography: fixtures for e2e/motion/choreography.spec.ts.
 *
 * Deterministic specs with entrance animation on. Deliberately absent from the
 * visual baseline set (the spec seeks animations, it never screenshots them).
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';

export default { title: 'Testing / Motion Choreography' };

const barSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar' },
  data: [
    { k: 'A', v: 90 },
    { k: 'B', v: 70 },
    { k: 'C', v: 50 },
    { k: 'D', v: 30 },
    { k: 'E', v: 10 },
  ],
  encoding: {
    x: { field: 'k', type: 'nominal' },
    y: { field: 'v', type: 'quantitative' },
  },
  labels: { density: 'all' },
};

const lineSpec: ChartSpec = {
  animation: true,
  mark: { type: 'line', point: true },
  data: [1, 2, 3, 4, 5, 6, 7, 8].map((x) => ({ x, y: 10 + ((x * 7) % 5) * 4 + x })),
  encoding: {
    x: { field: 'x', type: 'ordinal' },
    y: { field: 'y', type: 'quantitative' },
  },
};

const stackData = ['Q1', 'Q2', 'Q3', 'Q4'].flatMap((q, i) =>
  ['Solar', 'Wind', 'Gas'].map((s, j) => ({ q, s, v: 20 + i * 3 + j * 11 })),
);

const stackSpec: ChartSpec = {
  animation: true,
  mark: { type: 'bar' },
  data: stackData,
  encoding: {
    x: { field: 'q', type: 'nominal' },
    y: { field: 'v', type: 'quantitative', stack: 'zero' },
    color: { field: 's', type: 'nominal' },
  },
};

const heatmapSpec: ChartSpec = {
  animation: true,
  mark: { type: 'rect' },
  data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].flatMap((day, i) =>
    ['9am', '12pm', '3pm', '6pm'].map((hour, j) => ({ day, hour, v: ((i * 4 + j) * 7) % 20 })),
  ),
  encoding: {
    x: { field: 'day', type: 'nominal' },
    y: { field: 'hour', type: 'nominal' },
    color: { field: 'v', type: 'quantitative' },
  },
};

const box = { width: 640, height: 360 };

export const Bars = () => (
  <div style={box}>
    <Chart spec={barSpec} />
  </div>
);

export const Line = () => (
  <div style={box}>
    <Chart spec={lineSpec} />
  </div>
);

export const Stacks = () => (
  <div style={box}>
    <Chart spec={stackSpec} />
  </div>
);

export const Heatmap = () => (
  <div style={box}>
    <Chart spec={heatmapSpec} />
  </div>
);

/** A chart two screens down, so it mounts outside the viewport. */
export const BelowFold = () => (
  <div>
    <div style={{ height: 2400 }} />
    <div id="below-fold" style={box}>
      <Chart spec={barSpec} />
    </div>
    <div style={{ height: 400 }} />
  </div>
);

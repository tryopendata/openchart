/**
 * Testing / Fixtures — canvas mark mode pinned e2e stories.
 *
 * The flagship v8 canvas scatter had no pixel-level regression coverage: the
 * unit suite runs a stubbed 2D context and the parity spec samples single
 * pixels. These stories are screenshot baselines for the real rasterizer.
 *
 * `animation: false` is mandatory here: the Playwright harness kills CSS
 * animations via an injected stylesheet, but the canvas entrance runs on a JS
 * rAF scheduler the stylesheet cannot touch. An animated canvas story would
 * screenshot mid-entrance at a nondeterministic alpha (see
 * .claude/rules/visual-regression.md).
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { Chart } from '@opendata-ai/openchart-react';
import './testing.css';

export default { title: 'Testing / Fixtures' };

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

function canvasScatterSpec(dark: boolean): ChartSpec {
  const rand = mulberry32(7);
  return {
    animation: false,
    mark: { type: 'point', size: 3, opacity: 0.55, strokeWidth: 0 },
    data: Array.from({ length: 2000 }, (_, i) => ({
      id: `p${i}`,
      x: Math.round(rand() * 1000) / 10,
      y: Math.round((rand() * 60 + rand() * 40) * 10) / 10,
    })),
    encoding: {
      x: { field: 'x', type: 'quantitative', scale: { domain: [0, 100] } },
      y: { field: 'y', type: 'quantitative', scale: { domain: [0, 100] } },
      key: { field: 'id', type: 'nominal' },
    },
    chrome: {
      title: 'Two Thousand Points on Canvas',
      subtitle: 'Static baseline for the canvas mark rasterizer',
      source: 'Deterministic PRNG, seed 7',
    },
    ...(dark ? { darkMode: 'force' as const } : {}),
  };
}

export const CanvasScatterStatic = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={canvasScatterSpec(false)} renderer="canvas" />
  </div>
);

export const CanvasScatterStaticDark = () => (
  <div className="tfix-chart tfix-h-440">
    <Chart spec={canvasScatterSpec(true)} renderer="canvas" />
  </div>
);

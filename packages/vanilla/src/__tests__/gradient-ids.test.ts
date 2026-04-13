/**
 * Multi-chart SVG ID uniqueness: gradients AND clip-paths.
 *
 * Originally locked gradient-counter behavior from commit 73ef048 (fix for
 * random-hex gradient collisions). Step 6 of refactor/v7-cohesion unified
 * gradient and clip-path ID generation under `nextSvgId` in `svg-ids.ts`,
 * so this test now guards both halves.
 *
 * Why it matters: SVG `url(#id)` resolves against the full document. If two
 * charts on the same page generate overlapping IDs, one chart silently
 * inherits the other's gradient fill or clip region. The shared monotonic
 * counter makes uniqueness unconditional.
 */

import type { ChartSpec, LinearGradient } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

const barGradient: LinearGradient = {
  gradient: 'linear',
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  stops: [
    { offset: 0, color: '#1b7fa3', opacity: 0.4 },
    { offset: 1, color: '#1b7fa3' },
  ],
};

// A visibly different gradient so charts have distinct gradient defs, not
// identical ones that could be deduped by the gradient key system.
const altGradient: LinearGradient = {
  gradient: 'linear',
  x1: 0,
  y1: 0,
  x2: 1,
  y2: 0,
  stops: [
    { offset: 0, color: '#cc3366', opacity: 0.2 },
    { offset: 1, color: '#cc3366' },
  ],
};

function makeBarSpec(fill: LinearGradient): ChartSpec {
  return {
    mark: { type: 'bar', fill },
    data: [
      { category: 'A', value: 10 },
      { category: 'B', value: 20 },
      { category: 'C', value: 30 },
    ],
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'category', type: 'nominal' },
    },
  };
}

function collectGradientIds(root: HTMLElement): string[] {
  const ids: string[] = [];
  for (const el of root.querySelectorAll('linearGradient, radialGradient')) {
    const id = el.getAttribute('id');
    if (id) ids.push(id);
  }
  return ids;
}

function collectClipPathIds(root: HTMLElement): string[] {
  const ids: string[] = [];
  for (const el of root.querySelectorAll('clipPath')) {
    const id = el.getAttribute('id');
    if (id) ids.push(id);
  }
  return ids;
}

describe('SVG ID uniqueness across charts', () => {
  let a: HTMLDivElement;
  let b: HTMLDivElement;

  beforeEach(() => {
    a = createContainer();
    b = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('two charts produce disjoint gradient IDs', () => {
    const chartA = createChart(a, makeBarSpec(barGradient));
    const chartB = createChart(b, makeBarSpec(altGradient));

    const idsA = collectGradientIds(a);
    const idsB = collectGradientIds(b);

    // Each chart must have produced at least one gradient def.
    expect(idsA.length).toBeGreaterThan(0);
    expect(idsB.length).toBeGreaterThan(0);

    // Union has no duplicates: size of the Set equals the total count.
    const all = [...idsA, ...idsB];
    expect(new Set(all).size).toBe(all.length);

    // Every generated id follows the locked "oc-grad-N" shape.
    for (const id of all) {
      expect(id).toMatch(/^oc-grad-\d+$/);
    }

    chartA.destroy();
    chartB.destroy();
  });

  it('two charts produce disjoint clip-path IDs', () => {
    // Every chart render creates a <clipPath> for the plot area, so any spec
    // works here. Reuse the gradient specs for consistency.
    const chartA = createChart(a, makeBarSpec(barGradient));
    const chartB = createChart(b, makeBarSpec(altGradient));

    const idsA = collectClipPathIds(a);
    const idsB = collectClipPathIds(b);

    expect(idsA.length).toBeGreaterThan(0);
    expect(idsB.length).toBeGreaterThan(0);

    const all = [...idsA, ...idsB];
    expect(new Set(all).size).toBe(all.length);

    for (const id of all) {
      expect(id).toMatch(/^oc-clip-\d+$/);
    }

    chartA.destroy();
    chartB.destroy();
  });

  it('gradient and clip-path IDs never collide across two charts', () => {
    // Core guarantee of the unified nextSvgId counter: even though gradients
    // and clip-paths use different prefixes, the counter values are shared.
    // Collecting every ID from both <defs> trees should yield a strict set.
    const chartA = createChart(a, makeBarSpec(barGradient));
    const chartB = createChart(b, makeBarSpec(altGradient));

    const all = [
      ...collectGradientIds(a),
      ...collectClipPathIds(a),
      ...collectGradientIds(b),
      ...collectClipPathIds(b),
    ];

    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);

    chartA.destroy();
    chartB.destroy();
  });
});

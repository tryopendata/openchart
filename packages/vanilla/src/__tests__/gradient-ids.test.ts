/**
 * Characterization test for multi-chart gradient ID uniqueness.
 *
 * Part of refactor/v7-cohesion step 1. Pins the behavior of the global
 * gradient counter in `packages/vanilla/src/gradient-utils.ts` (commit 73ef048).
 *
 * Before the fix, gradient IDs used random hex suffixes that could collide when
 * multiple charts with gradient fills rendered into the same document. Because
 * SVG url(#id) resolves against the full document, a collision caused one chart
 * to inherit another chart's gradient. The fix replaced the random suffix with a
 * module-global monotonic counter so IDs are always unique across charts.
 *
 * Step 6 of the v7 refactor plans to unify gradient and clipPath ID generation.
 * This test guards uniqueness across that consolidation.
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

describe('gradient ID uniqueness across charts', () => {
  let a: HTMLDivElement;
  let b: HTMLDivElement;

  beforeEach(() => {
    a = createContainer();
    b = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('two charts mounted in separate containers produce disjoint gradient IDs', () => {
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
});

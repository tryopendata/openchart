/**
 * Fill pattern rendering: <pattern> defs lifecycle and mark fill references.
 *
 * Mirrors gradient-ids.test.ts for the pattern half of the defs system:
 * pattern IDs come from the shared nextSvgId counter, so they are
 * deterministic at generation time and globally unique across charts.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

function stackedSpec(): ChartSpec {
  return {
    mark: { type: 'bar', fillPattern: 'auto' },
    data: [
      { quarter: 'Q1', source: 'Solar', twh: 30 },
      { quarter: 'Q1', source: 'Wind', twh: 45 },
      { quarter: 'Q1', source: 'Hydro', twh: 25 },
      { quarter: 'Q1', source: 'Gas', twh: 60 },
      { quarter: 'Q2', source: 'Solar', twh: 35 },
      { quarter: 'Q2', source: 'Wind', twh: 50 },
      { quarter: 'Q2', source: 'Hydro', twh: 22 },
      { quarter: 'Q2', source: 'Gas', twh: 55 },
    ],
    encoding: {
      x: { field: 'quarter', type: 'nominal' },
      y: { field: 'twh', type: 'quantitative', stack: 'zero' },
      color: { field: 'source', type: 'nominal' },
    },
  };
}

function collectPatternIds(root: HTMLElement): string[] {
  const ids: string[] = [];
  for (const el of root.querySelectorAll('pattern')) {
    const id = el.getAttribute('id');
    if (id) ids.push(id);
  }
  return ids;
}

describe('pattern fill rendering', () => {
  let a: HTMLDivElement;
  let b: HTMLDivElement;

  beforeEach(() => {
    a = createContainer();
    b = createContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('creates one pattern def per series and references them from bar fills', () => {
    const chart = createChart(a, stackedSpec());

    const ids = collectPatternIds(a);
    expect(ids.length).toBe(4);
    for (const id of ids) {
      expect(id).toMatch(/^oc-pattern-\d+$/);
    }

    // Each pattern tile carries a base rect plus pattern geometry
    for (const pattern of a.querySelectorAll('pattern')) {
      expect(pattern.querySelector('rect')).not.toBeNull();
      expect(pattern.children.length).toBe(2);
    }

    // Every large-enough bar segment fills from a pattern url
    const rects = a.querySelectorAll('.oc-mark-rect rect, .oc-mark-rect path');
    const patternFills = [...rects].filter((el) =>
      (el.getAttribute('fill') ?? '').startsWith('url(#oc-pattern-'),
    );
    expect(patternFills.length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('renders solid fills when fillPattern is absent', () => {
    const spec = stackedSpec();
    spec.mark = { type: 'bar' };
    const chart = createChart(a, spec);
    expect(collectPatternIds(a)).toEqual([]);
    chart.destroy();
  });

  it('two charts produce disjoint pattern IDs', () => {
    const chartA = createChart(a, stackedSpec());
    const chartB = createChart(b, stackedSpec());

    const idsA = collectPatternIds(a);
    const idsB = collectPatternIds(b);
    expect(idsA.length).toBeGreaterThan(0);
    expect(idsB.length).toBeGreaterThan(0);

    const all = [...idsA, ...idsB];
    expect(new Set(all).size).toBe(all.length);

    chartA.destroy();
    chartB.destroy();
  });
});

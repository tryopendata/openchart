/**
 * Fill pattern assignment (mark.fillPattern: 'auto').
 *
 * Locks the deterministic pattern-to-series assignment, the opt-in gate,
 * and the minimum-area rule for thin marks.
 */

import type { ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../compile';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FOUR_SERIES_DATA = [
  { quarter: 'Q1', source: 'Solar', twh: 30 },
  { quarter: 'Q1', source: 'Wind', twh: 45 },
  { quarter: 'Q1', source: 'Hydro', twh: 25 },
  { quarter: 'Q1', source: 'Gas', twh: 60 },
  { quarter: 'Q2', source: 'Solar', twh: 35 },
  { quarter: 'Q2', source: 'Wind', twh: 50 },
  { quarter: 'Q2', source: 'Hydro', twh: 22 },
  { quarter: 'Q2', source: 'Gas', twh: 55 },
];

function stackedSpec(fillPattern?: 'auto' | 'none'): ChartSpec {
  return {
    mark: { type: 'bar', ...(fillPattern ? { fillPattern } : {}) },
    data: FOUR_SERIES_DATA,
    encoding: {
      x: { field: 'quarter', type: 'nominal' },
      y: { field: 'twh', type: 'quantitative', stack: 'zero' },
      color: { field: 'source', type: 'nominal' },
    },
  };
}

const OPTS = { width: 600, height: 400 };

function rectMarks(spec: ChartSpec): RectMark[] {
  return compileChart(spec, OPTS).marks.filter((m): m is RectMark => m.type === 'rect');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyFillPatterns via compileChart', () => {
  it('assigns four distinct patterns to a four-series stacked bar', () => {
    const rects = rectMarks(stackedSpec('auto'));
    expect(rects.length).toBeGreaterThan(0);

    const byColor = new Map<string, string>();
    for (const rect of rects) {
      expect(rect.pattern).toBeDefined();
      byColor.set(String(rect.fill), rect.pattern!.type);
    }
    // 4 series -> 4 distinct fills -> 4 distinct pattern shapes
    expect(byColor.size).toBe(4);
    expect(new Set(byColor.values()).size).toBe(4);
    expect([...byColor.values()].sort()).toEqual(
      ['crosshatch', 'diagonal', 'dot', 'vertical'].sort(),
    );
  });

  it('is deterministic across repeat compiles', () => {
    const first = rectMarks(stackedSpec('auto')).map((r) => r.pattern);
    const second = rectMarks(stackedSpec('auto')).map((r) => r.pattern);
    expect(second).toEqual(first);
  });

  it('picks a contrast-aware line color for each pattern', () => {
    for (const rect of rectMarks(stackedSpec('auto'))) {
      expect(['#ffffff', '#111111']).toContain(rect.pattern!.line);
      expect(rect.pattern!.base).toBe(rect.fill);
    }
  });

  it('does nothing by default or with fillPattern: none', () => {
    for (const rect of rectMarks(stackedSpec())) {
      expect(rect.pattern).toBeUndefined();
    }
    for (const rect of rectMarks(stackedSpec('none'))) {
      expect(rect.pattern).toBeUndefined();
    }
  });

  it('minimum-area rule: thin segments keep their solid fill', () => {
    // Tiny values force sub-12px stacked segments at 400px height.
    const thinData = FOUR_SERIES_DATA.map((row) =>
      row.source === 'Hydro' ? { ...row, twh: 0.5 } : row,
    );
    const spec = { ...stackedSpec('auto'), data: thinData };
    const rects = rectMarks(spec);

    const thin = rects.filter((r) => Math.min(r.width, r.height) < 12);
    const thick = rects.filter((r) => Math.min(r.width, r.height) >= 12);
    expect(thin.length).toBeGreaterThan(0);
    expect(thick.length).toBeGreaterThan(0);
    for (const rect of thin) expect(rect.pattern).toBeUndefined();
    for (const rect of thick) expect(rect.pattern).toBeDefined();
  });

  it('assignment does not shift when individual marks are too small', () => {
    // Same series order, one series squeezed below the minimum extent:
    // surviving patterns keep the same shape per series color.
    const thinData = FOUR_SERIES_DATA.map((row) =>
      row.source === 'Wind' ? { ...row, twh: 0.5 } : row,
    );
    const base = rectMarks(stackedSpec('auto'));
    const squeezed = rectMarks({ ...stackedSpec('auto'), data: thinData });

    const patternByFill = (rects: RectMark[]) => {
      const map = new Map<string, string>();
      for (const r of rects) {
        if (r.pattern) map.set(String(r.fill), r.pattern.type);
      }
      return map;
    };

    const baseMap = patternByFill(base);
    for (const [fill, type] of patternByFill(squeezed)) {
      expect(baseMap.get(fill)).toBe(type);
    }
  });
});

describe('fill patterns on arcs', () => {
  it('patterns pie slices and skips slivers', () => {
    const spec: ChartSpec = {
      mark: { type: 'arc', fillPattern: 'auto' },
      data: [
        { browser: 'Chrome', share: 64 },
        { browser: 'Safari', share: 20 },
        { browser: 'Edge', share: 15 },
        { browser: 'Other', share: 0.4 },
      ],
      encoding: {
        color: { field: 'browser', type: 'nominal' },
        y: { field: 'share', type: 'quantitative' },
      },
    };
    const layout = compileChart(spec, OPTS);
    const arcs = layout.marks.filter((m) => m.type === 'arc');
    expect(arcs.length).toBe(4);

    const patterned = arcs.filter((a) => a.pattern);
    const solid = arcs.filter((a) => !a.pattern);
    // The 0.4% sliver falls under the minimum-area rule.
    expect(patterned.length).toBe(3);
    expect(solid.length).toBe(1);
  });
});

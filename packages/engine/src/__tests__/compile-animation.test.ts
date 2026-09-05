/**
 * Integration tests for animation in the chart compilation pipeline.
 *
 * Verifies that animation specs flow through compileChart() correctly:
 * resolved animation on the layout, animationIndex on marks for value-based
 * stagger ordering, and breakpoint override behavior.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const barSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 30 },
    { name: 'C', value: 20 },
  ],
  encoding: {
    x: { field: 'value', type: 'quantitative' },
    y: { field: 'name', type: 'nominal' },
  },
};

const columnSpec: ChartSpec = {
  mark: 'bar',
  data: [
    { category: 'Q1', revenue: 100 },
    { category: 'Q2', revenue: 300 },
    { category: 'Q3', revenue: 200 },
  ],
  encoding: {
    x: { field: 'category', type: 'nominal' },
    y: { field: 'revenue', type: 'quantitative' },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('compileChart with animation', () => {
  it('includes resolved animation in layout when animation: true', () => {
    const spec = { ...barSpec, animation: true } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    expect(layout.animation).toBeDefined();
    expect(layout.animation!.enter).toBeDefined();
    expect(layout.animation!.enter!.duration).toBe(450);
    expect(layout.animation!.enter!.ease).toBe('smooth');
    expect(layout.animation!.enter!.staggerDelay).toBe(30);
    expect(layout.animation!.enter!.staggerOrder).toBe('index');
    expect(layout.animation!.annotationDelay).toBe(150);
  });

  it('omits animation from layout when animation is not specified', () => {
    const layout = compileChart(barSpec, { width: 600, height: 400 });
    expect(layout.animation).toBeUndefined();
  });

  it('omits animation from layout when animation is false', () => {
    const spec = { ...barSpec, animation: false } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.animation).toBeUndefined();
  });

  it('resolves custom animation config through compilation', () => {
    const spec = {
      ...barSpec,
      animation: {
        enter: { duration: 800, ease: 'smooth' as const },
        annotationDelay: 500,
      },
    } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    expect(layout.animation).toBeDefined();
    expect(layout.animation!.enter!.duration).toBe(800);
    expect(layout.animation!.enter!.ease).toBe('smooth');
    expect(layout.animation!.annotationDelay).toBe(500);
  });

  it('computes animationIndex on marks when stagger order is value', () => {
    const spec = {
      ...columnSpec,
      animation: {
        enter: { stagger: { order: 'value' as const } },
      },
    } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    // Should have rect marks for the 3 data points
    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    expect(rectMarks.length).toBe(3);

    // Each mark should have an animationIndex assigned
    const indices = rectMarks.map(
      (m) => (m as unknown as { animationIndex?: number }).animationIndex,
    );
    for (const idx of indices) {
      expect(idx).toBeDefined();
      expect(typeof idx).toBe('number');
    }

    // Indices should be unique and sequential (0, 1, 2)
    const sorted = [...indices].sort((a, b) => a! - b!);
    expect(sorted).toEqual([0, 1, 2]);
  });

  it('does not assign animationIndex when stagger order is index (default)', () => {
    const spec = { ...columnSpec, animation: true } as ChartSpec;
    const layout = compileChart(spec, { width: 600, height: 400 });

    // With staggerOrder='index' (default), animationIndex is not explicitly set
    const rectMarks = layout.marks.filter((m) => m.type === 'rect');
    const indices = rectMarks.map(
      (m) => (m as unknown as { animationIndex?: number }).animationIndex,
    );
    // Should all be undefined since value ordering isn't enabled
    for (const idx of indices) {
      expect(idx).toBeUndefined();
    }
  });

  it('applies breakpoint animation override', () => {
    // Compact breakpoint is < 400px width
    const spec = {
      ...barSpec,
      animation: true,
      overrides: {
        compact: { animation: false },
      },
    } as ChartSpec;

    // At compact width (< 400), the breakpoint override should disable animation.
    // Breakpoint overrides take precedence over spec-level animation (matching
    // how chrome, labels, legend, and annotation overrides work).
    const layout = compileChart(spec, { width: 350, height: 400 });
    expect(layout.animation).toBeUndefined();

    // Test the case where spec-level animation is not set and override provides it
    const specNoAnim = {
      ...barSpec,
      overrides: {
        compact: { animation: true },
      },
    } as ChartSpec;
    const layoutCompact = compileChart(specNoAnim, { width: 350, height: 400 });
    expect(layoutCompact.animation).toBeDefined();
    expect(layoutCompact.animation!.enter).toBeDefined();

    // At full width (> 700), no override applies, so no animation
    const layoutFull = compileChart(specNoAnim, { width: 800, height: 400 });
    expect(layoutFull.animation).toBeUndefined();
  });
});

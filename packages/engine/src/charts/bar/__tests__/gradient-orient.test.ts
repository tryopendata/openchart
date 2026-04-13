/**
 * Characterization tests for horizontal-bar gradient auto-orientation.
 *
 * Part of refactor/v7-cohesion step 1. Pins the behavior of
 * `orientGradientForHorizontalBar` in `packages/engine/src/charts/bar/compute.ts`:
 * when a user supplies the default vertical gradient (top-to-bottom) as a
 * horizontal-bar fill, the engine rotates it to horizontal (left-to-right) so
 * the gradient follows the bar's data direction. Vertical bars (columns) keep
 * the gradient unchanged. Explicit non-default coordinates are never rewritten.
 *
 * These tests protect the behavior through upcoming refactors that may consolidate
 * gradient logic across bar/column/stacked variants.
 */

import type { ChartSpec, LinearGradient, RectMark } from '@opendata-ai/openchart-core';
import { isGradientDef } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

// A default-vertical linear gradient (no explicit coords — defaults resolve to
// x1:0, y1:0, x2:0, y2:1 which is the "top-to-bottom" default).
const defaultVerticalGradient: LinearGradient = {
  gradient: 'linear',
  stops: [
    { offset: 0, color: '#1b7fa3', opacity: 0.4 },
    { offset: 1, color: '#1b7fa3' },
  ],
};

function firstGradientRectFill(marks: RectMark[]): LinearGradient {
  const mark = marks.find((m) => m.type === 'rect' && isGradientDef(m.fill));
  if (!mark) throw new Error('expected at least one RectMark with a gradient fill');
  const fill = mark.fill;
  if (!isGradientDef(fill) || fill.gradient !== 'linear') {
    throw new Error('expected a linear gradient fill');
  }
  return fill as LinearGradient;
}

describe('horizontal bar gradient auto-orientation', () => {
  it('rotates the default vertical gradient to horizontal on horizontal bars', () => {
    const spec: ChartSpec = {
      mark: { type: 'bar', fill: defaultVerticalGradient },
      data: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 },
      ],
      // Horizontal bar: x is quantitative, y is nominal
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
    };

    const layout = compileChart(spec, { width: 600, height: 400 });
    const grad = firstGradientRectFill(layout.marks as RectMark[]);

    // Horizontal gradient: x1 != x2, y1 == y2
    expect(grad.x1).toBe(0);
    expect(grad.y1).toBe(0);
    expect(grad.x2).toBe(1);
    expect(grad.y2).toBe(0);
    expect(grad.x1).not.toBe(grad.x2);
    expect(grad.y1).toBe(grad.y2);
  });

  it('leaves the default vertical gradient unchanged on vertical (column) bars', () => {
    const spec: ChartSpec = {
      mark: { type: 'bar', fill: defaultVerticalGradient },
      data: [
        { category: 'A', value: 10 },
        { category: 'B', value: 20 },
        { category: 'C', value: 30 },
      ],
      // Vertical bar (column): x is nominal, y is quantitative
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
    };

    const layout = compileChart(spec, { width: 600, height: 400 });
    const grad = firstGradientRectFill(layout.marks as RectMark[]);

    // Vertical gradient preserved: x1 == x2 (both 0), y1 != y2 (0 vs 1)
    expect(grad.x1 ?? 0).toBe(0);
    expect(grad.x2 ?? 0).toBe(0);
    expect(grad.y1 ?? 0).toBe(0);
    expect(grad.y2 ?? 1).toBe(1);
    expect(grad.x1 ?? 0).toBe(grad.x2 ?? 0);
    expect(grad.y1 ?? 0).not.toBe(grad.y2 ?? 1);
  });

  it('leaves an explicitly-oriented gradient unchanged on horizontal bars', () => {
    // Explicit non-default direction — user knows what they want, the engine
    // must not rewrite it. Here we pass a diagonal gradient.
    const explicitDiagonal: LinearGradient = {
      gradient: 'linear',
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      stops: [
        { offset: 0, color: '#1b7fa3' },
        { offset: 1, color: '#ff6600' },
      ],
    };

    const spec: ChartSpec = {
      mark: { type: 'bar', fill: explicitDiagonal },
      data: [{ category: 'A', value: 10 }],
      encoding: {
        x: { field: 'value', type: 'quantitative' },
        y: { field: 'category', type: 'nominal' },
      },
    };

    const layout = compileChart(spec, { width: 600, height: 400 });
    const grad = firstGradientRectFill(layout.marks as RectMark[]);

    expect(grad.x1).toBe(0);
    expect(grad.y1).toBe(0);
    expect(grad.x2).toBe(1);
    expect(grad.y2).toBe(1);
  });
});

import type { Mark, PointMark, RectMark, ResolvedAnimation } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { ResolvedScales } from '../../layout/scales';
import { assignAnimationIndices, computeMarkObstacles, resolveRendererKey } from '../post-process';

// ---------------------------------------------------------------------------
// computeMarkObstacles
// ---------------------------------------------------------------------------

describe('computeMarkObstacles', () => {
  it('returns individual rects for non-band rect marks', () => {
    const marks: Mark[] = [
      { type: 'rect', x: 10, y: 20, width: 50, height: 30, fill: '#000' } as RectMark,
      { type: 'rect', x: 80, y: 20, width: 50, height: 30, fill: '#000' } as RectMark,
    ];
    const scales = { y: { type: 'linear' } } as unknown as ResolvedScales;
    const result = computeMarkObstacles(marks, scales);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ x: 10, y: 20, width: 50, height: 30, kind: 'mark' });
    expect(result[1]).toEqual({ x: 80, y: 20, width: 50, height: 30, kind: 'mark' });
  });

  it('returns point mark bounds as bounding box from cx/cy/r', () => {
    const marks: Mark[] = [{ type: 'point', cx: 100, cy: 100, r: 10, fill: '#000' } as PointMark];
    const scales = { y: { type: 'linear' } } as unknown as ResolvedScales;
    const result = computeMarkObstacles(marks, scales);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ x: 90, y: 90, width: 20, height: 20, kind: 'mark' });
  });

  it('returns grouped row obstacles for band-scale charts', () => {
    const marks: Mark[] = [
      { type: 'rect', x: 10, y: 50, width: 40, height: 20, fill: '#000' } as RectMark,
      { type: 'rect', x: 60, y: 50, width: 30, height: 20, fill: '#000' } as RectMark,
    ];
    const bandScale = Object.assign((v: string) => (v === 'A' ? 40 : 100), {
      bandwidth: () => 30,
      domain: () => ['A', 'B'],
    });
    const scales = { y: { type: 'band', scale: bandScale } } as unknown as ResolvedScales;
    const result = computeMarkObstacles(marks, scales);
    // Both marks have cy ~60, so they group into one row obstacle
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(10);
    expect(result[0].width).toBe(80); // 90 - 10
  });

  it('returns empty array for empty marks', () => {
    const scales = { y: { type: 'linear' } } as unknown as ResolvedScales;
    const result = computeMarkObstacles([], scales);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// resolveRendererKey
// ---------------------------------------------------------------------------

describe('resolveRendererKey', () => {
  it('keeps bar as bar when x=quantitative, y=nominal (horizontal)', () => {
    const encoding = {
      x: { field: 'val', type: 'quantitative' },
      y: { field: 'cat', type: 'nominal' },
    };
    expect(resolveRendererKey('bar', encoding, {})).toBe('bar');
  });

  it('resolves bar to bar:vertical when x=nominal, y=quantitative', () => {
    const encoding = {
      x: { field: 'cat', type: 'nominal' },
      y: { field: 'val', type: 'quantitative' },
    };
    expect(resolveRendererKey('bar', encoding, {})).toBe('bar:vertical');
  });

  it('resolves bar to bar:vertical when x=ordinal, y=quantitative', () => {
    const encoding = {
      x: { field: 'cat', type: 'ordinal' },
      y: { field: 'val', type: 'quantitative' },
    };
    expect(resolveRendererKey('bar', encoding, {})).toBe('bar:vertical');
  });

  it('resolves bar to bar:vertical when x=temporal, y=quantitative', () => {
    const encoding = {
      x: { field: 'date', type: 'temporal' },
      y: { field: 'val', type: 'quantitative' },
    };
    expect(resolveRendererKey('bar', encoding, {})).toBe('bar:vertical');
  });

  it('resolves arc to arc:donut when innerRadius > 0', () => {
    expect(resolveRendererKey('arc', {}, { innerRadius: 50 })).toBe('arc:donut');
  });

  it('keeps arc as arc when no innerRadius', () => {
    expect(resolveRendererKey('arc', {}, {})).toBe('arc');
  });

  it('keeps arc as arc when innerRadius is 0', () => {
    expect(resolveRendererKey('arc', {}, { innerRadius: 0 })).toBe('arc');
  });

  it('passes through other mark types unchanged', () => {
    expect(resolveRendererKey('line', {}, {})).toBe('line');
    expect(resolveRendererKey('area', {}, {})).toBe('area');
    expect(resolveRendererKey('point', {}, {})).toBe('point');
  });
});

// ---------------------------------------------------------------------------
// assignAnimationIndices
// ---------------------------------------------------------------------------

describe('assignAnimationIndices', () => {
  it('assigns sequential indices sorted by primary value for value stagger', () => {
    const marks: Mark[] = [
      { type: 'rect', x: 0, y: 0, width: 10, height: 30, fill: '#000' } as RectMark,
      { type: 'rect', x: 0, y: 0, width: 10, height: 10, fill: '#000' } as RectMark,
      { type: 'rect', x: 0, y: 0, width: 10, height: 50, fill: '#000' } as RectMark,
    ];
    const animation: ResolvedAnimation = {
      enabled: true,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 50,
      staggerOrder: 'value',
      annotationDelay: 0,
    };
    assignAnimationIndices(marks, animation);
    // Sorted by height: 10, 30, 50 -> indices 0, 1, 2
    expect(marks[0].animationIndex).toBe(1); // height 30
    expect(marks[1].animationIndex).toBe(0); // height 10
    expect(marks[2].animationIndex).toBe(2); // height 50
  });

  it('assigns group-based indices for stacked rects', () => {
    const marks: Mark[] = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 30,
        fill: '#000',
        stackGroup: 'A',
      } as RectMark,
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 20,
        fill: '#000',
        stackGroup: 'A',
      } as RectMark,
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 40,
        fill: '#000',
        stackGroup: 'B',
      } as RectMark,
    ];
    const animation: ResolvedAnimation = {
      enabled: true,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 50,
      staggerOrder: 'value',
      annotationDelay: 0,
    };
    assignAnimationIndices(marks, animation);
    // Stack group A gets index 0, B gets index 1
    const rectMarks = marks as RectMark[];
    expect(rectMarks[0].animationIndex).toBe(0);
    expect(rectMarks[0].stackPos).toBe(0);
    expect(rectMarks[1].animationIndex).toBe(0);
    expect(rectMarks[1].stackPos).toBe(1);
    expect(rectMarks[2].animationIndex).toBe(1);
    expect(rectMarks[2].stackPos).toBe(0);
  });

  it('stack indices overwrite value-based indices', () => {
    const marks: Mark[] = [
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 30,
        fill: '#000',
        stackGroup: 'A',
      } as RectMark,
      {
        type: 'rect',
        x: 0,
        y: 0,
        width: 10,
        height: 50,
        fill: '#000',
        stackGroup: 'A',
      } as RectMark,
    ];
    const animation: ResolvedAnimation = {
      enabled: true,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 50,
      staggerOrder: 'value',
      annotationDelay: 0,
    };
    assignAnimationIndices(marks, animation);
    // Both should have the same group index (0), not value-sorted indices
    expect((marks[0] as RectMark).animationIndex).toBe(0);
    expect((marks[1] as RectMark).animationIndex).toBe(0);
  });

  it('is a no-op when animation is undefined', () => {
    const marks: Mark[] = [
      { type: 'rect', x: 0, y: 0, width: 10, height: 30, fill: '#000' } as RectMark,
    ];
    assignAnimationIndices(marks, undefined);
    expect(marks[0].animationIndex).toBeUndefined();
  });

  it('is a no-op when animation is disabled', () => {
    const marks: Mark[] = [
      { type: 'rect', x: 0, y: 0, width: 10, height: 30, fill: '#000' } as RectMark,
    ];
    const animation: ResolvedAnimation = {
      enabled: false,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 50,
      staggerOrder: 'value',
      annotationDelay: 0,
    };
    assignAnimationIndices(marks, animation);
    expect(marks[0].animationIndex).toBeUndefined();
  });

  it('handles empty marks array', () => {
    const animation: ResolvedAnimation = {
      enabled: true,
      duration: 500,
      ease: 'smooth',
      staggerDelay: 50,
      staggerOrder: 'value',
      annotationDelay: 0,
    };
    const marks: Mark[] = [];
    assignAnimationIndices(marks, animation);
    expect(marks).toHaveLength(0);
  });
});

import type { AxisTick, ChartLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import type { CameraTarget } from '../camera-math';
import { isDataCameraTarget, resolveCameraTarget } from '../resolve-camera-target';
import type { StoryDataCameraTarget } from '../types';

const AREA = { x: 40, y: 20, width: 500, height: 300 };

function tick(value: unknown, position: number): AxisTick {
  return { value, position, label: String(value) };
}

/** Minimal layout: only `area` and `axes` are read by resolveCameraTarget. */
function makeLayout(axes: { x?: AxisTick[]; y?: AxisTick[] } = {}): ChartLayout {
  return {
    area: { ...AREA },
    axes: {
      ...(axes.x ? { x: { ticks: axes.x } } : {}),
      ...(axes.y ? { y: { ticks: axes.y } } : {}),
    },
  } as unknown as ChartLayout;
}

describe('resolveCameraTarget', () => {
  it('resolves exact ordinal tick matches to their pixel positions', () => {
    const layout = makeLayout({ x: [tick('A', 100), tick('B', 200), tick('C', 300)] });
    const result = resolveCameraTarget(layout, { x: ['A', 'C'] });

    expect(result.x).toBe(100);
    expect(result.width).toBe(200);
    // No y target: falls back to the full chart area vertically.
    expect(result.y).toBe(AREA.y);
    expect(result.height).toBe(AREA.height);
    expect(result.padding).toBe(24);
  });

  it('interpolates linearly between the two nearest ticks', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const result = resolveCameraTarget(layout, { x: [25, 75] });

    expect(result.x).toBe(125);
    expect(result.width).toBe(250);
  });

  it('normalizes a reversed range to the same rect', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const forward = resolveCameraTarget(layout, { x: [25, 75] });
    const reversed = resolveCameraTarget(layout, { x: [75, 25] });

    expect(reversed).toEqual(forward);
  });

  it('interpolates temporal targets given as ISO strings against Date ticks', () => {
    const layout = makeLayout({
      x: [tick(new Date('2020-01-01'), 0), tick(new Date('2020-01-03'), 200)],
    });
    const result = resolveCameraTarget(layout, { x: ['2020-01-02', '2020-01-03'] });

    expect(result.x).toBe(100);
    expect(result.width).toBe(100);
  });

  it('passes explicit padding through and defaults to 24 when omitted', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });

    expect(resolveCameraTarget(layout, { x: [0, 100], padding: 5 }).padding).toBe(5);
    expect(resolveCameraTarget(layout, { x: [0, 100] }).padding).toBe(24);
  });

  it('falls back to the full chart area for an unknown category name', () => {
    const layout = makeLayout({ x: [tick('A', 100), tick('B', 200), tick('C', 300)] });
    // 'not-a-category' has no exact tick and is not date-parseable, so the
    // whole x resolution degrades to the full area (even though 'B' resolves).
    const result = resolveCameraTarget(layout, { x: ['not-a-category', 'B'] });

    expect(result).toEqual({ ...AREA, padding: 24 });
  });

  it('falls back to the full chart area when the axis has no ticks (empty data)', () => {
    const layout = makeLayout({ x: [], y: [] });
    const result = resolveCameraTarget(layout, { x: [0, 10], y: [0, 10] });

    expect(result).toEqual({ ...AREA, padding: 24 });
  });

  it('falls back for a targeted axis that is missing from the layout', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const result = resolveCameraTarget(layout, { x: [25, 75], y: [0, 10] });

    // x resolves normally, y (no axis) covers the full area height.
    expect(result.x).toBe(125);
    expect(result.width).toBe(250);
    expect(result.y).toBe(AREA.y);
    expect(result.height).toBe(AREA.height);
  });

  it('falls back when no tick value is comparable', () => {
    const layout = makeLayout({ x: [tick({ raw: 1 }, 0), tick({ raw: 2 }, 500)] });
    const result = resolveCameraTarget(layout, { x: [1, 2] });

    expect(result).toEqual({ ...AREA, padding: 24 });
  });

  it('clamps a zero-extent target to a minimum 1px width', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const result = resolveCameraTarget(layout, { x: [50, 50] });

    expect(result.x).toBe(250);
    expect(result.width).toBe(1);
  });

  it('resolves both endpoints to a single tick and clamps to 1px extents', () => {
    // Single-point domain: one tick per axis. Every target value clamps to it.
    const layout = makeLayout({ x: [tick(50, 250)], y: [tick(7, 160)] });
    const result = resolveCameraTarget(layout, { x: [10, 90], y: [0, 100] });

    expect(result).toEqual({ x: 250, y: 160, width: 1, height: 1, padding: 24 });
  });

  it('falls back to the full area when a target value is NaN', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const result = resolveCameraTarget(layout, { x: [Number.NaN, 100] });

    expect(result).toEqual({ ...AREA, padding: 24 });
  });

  it('clamps Infinity targets to the extreme tick positions', () => {
    const layout = makeLayout({ x: [tick(0, 0), tick(100, 500)] });
    const result = resolveCameraTarget(layout, {
      x: [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY],
    });

    expect(result.x).toBe(0);
    expect(result.width).toBe(500);
  });
});

describe('isDataCameraTarget', () => {
  it('accepts data-coordinate targets', () => {
    expect(isDataCameraTarget({ x: [0, 10] })).toBe(true);
    expect(isDataCameraTarget({ y: ['A', 'B'], padding: 10 })).toBe(true);
    expect(isDataCameraTarget({} as StoryDataCameraTarget)).toBe(true);
  });

  it('rejects raw viewBox CameraTarget rects', () => {
    const target: CameraTarget = { x: 0, y: 0, width: 100, height: 50 };
    expect(isDataCameraTarget(target)).toBe(false);
    expect(isDataCameraTarget({ ...target, padding: 12 })).toBe(false);
  });
});

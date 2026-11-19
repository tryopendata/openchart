/**
 * Update transitions evaluate the curve registry: exit-ghost geometry stays in
 * [from, to] on an overshooting ease, and marks entering during an update fade
 * on the update's own ease (SVG and canvas alike), not a hard-coded cubic.
 */

import {
  type AnimationEase,
  type ChartSpec,
  evalValueCurve,
  type MotionPhase,
  updateTimeline,
} from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { rectMarkGeometry } from '../__test-fixtures__/rect-geometry';
import { createChart } from '../mount';
import { applyCanvasGridlinesState, applyCanvasPointsState } from '../transition/canvas-tweens';
import type { CanvasGridlinesTween, CanvasPointsTween } from '../transition/types';

const UPDATE_MS = 500;
// Enters start at 40% of the update and run the remaining 60%.
const ENTER_DELAY = 0.4 * UPDATE_MS;
const ENTER_MS = UPDATE_MS - ENTER_DELAY;

function barSpec(categories: string[], ease: AnimationEase): ChartSpec {
  return {
    animation: {
      enter: false,
      update: { duration: UPDATE_MS, ease },
      exit: { duration: 300, ease },
    },
    mark: 'bar',
    data: categories.map((category) => ({ category, value: 80 })),
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
    },
  };
}

function height(el: Element | null): number {
  return rectMarkGeometry(el)?.height ?? Number.NaN;
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => {
    throw new Error('manual transition must not schedule requestAnimationFrame');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exit ghosts on an overshooting ease', () => {
  it('keeps ghost geometry within [from, to] on snappy', () => {
    const container = createContainer();
    const chart = createChart(container, barSpec(['A', 'B', 'C'], 'snappy'));
    const fromH = height(container.querySelector('.oc-mark-rect[data-series="C"]'));
    expect(fromH).toBeGreaterThan(0);

    const handle = chart.beginManualUpdate(barSpec(['A', 'B'], 'snappy'))!;
    expect(handle).not.toBeNull();
    const ghost = container.querySelector('.oc-mark-rect.oc-ghost');
    expect(ghost).not.toBeNull();

    let previous = fromH;
    for (let t = 0; t <= 300; t += 5) {
      handle.step(t);
      const h = height(ghost);
      expect(h).toBeGreaterThanOrEqual(-1e-6);
      expect(h).toBeLessThanOrEqual(fromH + 1e-6);
      // Collapsing toward 0 without bouncing back up.
      expect(h).toBeLessThanOrEqual(previous + 1e-6);
      previous = h;
    }
    handle.cancel();
    chart.destroy();
  });
});

describe('marks entering during an update', () => {
  /** Height of an entering bar D at 30% of its enter window. */
  function enteringHeight(ease: AnimationEase): { mid: number; final: number } {
    const container = createContainer();
    const chart = createChart(container, barSpec(['A', 'B'], ease));
    const handle = chart.beginManualUpdate(barSpec(['A', 'B', 'D'], ease))!;
    const el = container.querySelector('.oc-mark-rect[data-series="D"]');
    handle.step(ENTER_DELAY + 0.3 * ENTER_MS);
    const mid = height(el);
    handle.step(handle.totalMs);
    const final = height(el);
    handle.cancel();
    chart.destroy();
    return { mid, final };
  }

  it('grow on the update ease in SVG', () => {
    const smooth = enteringHeight('smooth');
    const snappy = enteringHeight('snappy');
    expect(smooth.mid).toBeCloseTo(smooth.final * evalValueCurve('smooth', 0.3), 3);
    expect(snappy.mid).toBeCloseTo(snappy.final * evalValueCurve('snappy', 0.3), 3);
    expect(Math.abs(smooth.mid - snappy.mid)).toBeGreaterThan(1);
  });

  function canvasPointsTween(): CanvasPointsTween {
    const empty = new Float32Array(0);
    return {
      tweenType: 'canvasPoints',
      kind: 'update',
      layer: {
        state: {
          marks: { x: empty, y: empty, r: empty },
          enterAlpha: new Float32Array(1),
          exiting: null,
        },
      },
      soaIndex: new Uint32Array(0),
      fromCx: empty,
      fromCy: empty,
      fromR: empty,
      toCx: empty,
      toCy: empty,
      toR: empty,
      soaKeys: [],
      enterSoaIndex: Uint32Array.of(0),
      exitState: null,
    } as unknown as CanvasPointsTween;
  }

  function canvasGridlinesTween(): CanvasGridlinesTween {
    return {
      tweenType: 'canvasGridlines',
      kind: 'update',
      layer: { state: { gridlines: [{ position: 10, alpha: 1 }] } },
      index: Uint32Array.of(0),
      fromPos: Float32Array.of(10),
      toPos: Float32Array.of(10),
      fromAlpha: Float32Array.of(0),
      toAlpha: Float32Array.of(1),
    } as unknown as CanvasGridlinesTween;
  }

  it('fade in on the update ease on canvas (points and gridlines)', () => {
    const at = ENTER_DELAY + 0.3 * ENTER_MS;
    const exit: MotionPhase = { duration: 300 };
    const alphaFor = (ease: AnimationEase) => {
      const update: MotionPhase = { duration: UPDATE_MS, ease };
      const points = canvasPointsTween();
      const clock = { update, exit, ...updateTimeline(update, exit, false) };
      applyCanvasPointsState(points, at, clock);
      const grid = canvasGridlinesTween();
      applyCanvasGridlinesState(grid, at, clock);
      return {
        point: points.layer.state.enterAlpha![0],
        gridline: grid.layer.state.gridlines[0].alpha,
      };
    };
    const smooth = alphaFor('smooth');
    const snappy = alphaFor('snappy');
    const gentle = alphaFor('gentle');
    for (const [ease, got] of [
      ['smooth', smooth],
      ['snappy', snappy],
      ['gentle', gentle],
    ] as const) {
      expect(got.point).toBeCloseTo(evalValueCurve(ease, 0.3), 6);
      expect(got.gridline).toBeCloseTo(evalValueCurve(ease, 0.3), 6);
    }
    expect(Math.abs(smooth.point - gentle.point)).toBeGreaterThan(0.05);
  });
});

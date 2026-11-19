/**
 * Camera flights and hover emphasis keep their analytic cubics after the
 * value/entrance/fade easings moved onto the curve registry: `'snappy'` is
 * cubicOut, `'smooth'` and `'gentle'` are cubicInOut.
 */

import { evalValueCurve } from '@opendata-ai/openchart-core';
import type { GraphCompilation } from '@opendata-ai/openchart-engine';
import { interpolateZoom } from 'd3-interpolate';
import { describe, expect, it } from 'vitest';
import { cubicInOut, cubicOut } from '../../motion/easing';
import type { Animation, AnimationScheduler } from '../../motion/scheduler';
import { resolveCameraEase, resolveEase } from '../../motion/tween';
import {
  createCameraFlight,
  transformToView,
  type Viewport,
  viewToTransform,
  type ZoomView,
} from '../camera';
import { createGraphFocusModel } from '../focus-model';
import { ZoomTransform } from '../zoom';

describe('resolveCameraEase', () => {
  it('keeps the analytic cubics', () => {
    for (const t of [0, 0.1, 0.25, 0.5, 0.8, 1]) {
      expect(resolveCameraEase('snappy')(t)).toBe(cubicOut(t));
      expect(resolveCameraEase('smooth')(t)).toBe(cubicInOut(t));
      expect(resolveCameraEase('gentle')(t)).toBe(cubicInOut(t));
    }
  });

  it('differs from the registry curve resolveEase now returns', () => {
    expect(resolveEase('smooth')(0.25)).toBe(evalValueCurve('smooth', 0.25));
    expect(resolveCameraEase('smooth')(0.25)).not.toBeCloseTo(resolveEase('smooth')(0.25), 3);
  });
});

describe('camera flight easing', () => {
  const viewport: Viewport = { width: 800, height: 600 };
  const from = new ZoomTransform(0, 0, 1);
  const to = new ZoomTransform(-400, -300, 2);

  function flightAt(ease: 'smooth' | 'snappy', fraction: number): ZoomTransform {
    const applied: ZoomTransform[] = [];
    const flight = createCameraFlight({
      from,
      to,
      viewport,
      apply: (t) => applied.push(t),
      opts: { duration: 100, ease },
    });
    flight.tick(0);
    flight.tick(100 * fraction);
    return applied.at(-1) as ZoomTransform;
  }

  function expected(eased: number): ZoomTransform {
    const interp = interpolateZoom(transformToView(from, viewport), transformToView(to, viewport));
    return viewToTransform(interp(eased) as ZoomView, viewport);
  }

  it.each([
    ['smooth', cubicInOut],
    ['snappy', cubicOut],
  ] as const)('%s follows its cubic', (ease, cubic) => {
    const got = flightAt(ease, 0.25);
    const want = expected(cubic(0.25));
    expect(got.k).toBeCloseTo(want.k, 10);
    expect(got.x).toBeCloseTo(want.x, 8);
    expect(got.y).toBeCloseTo(want.y, 8);
  });
});

describe('hover radius easing', () => {
  function hoverScaleAt(ease: 'smooth' | 'snappy', fraction: number): number {
    const anims: Animation[] = [];
    const scheduler = {
      add: (a: Animation) => anims.push(a),
      remove: () => {},
    } as unknown as AnimationScheduler;
    const compilation = {
      nodes: [],
      interaction: { hoverMode: 'neighbors', dimOpacity: 0.2 },
      animation: { hover: { duration: 100, ease } },
    } as unknown as GraphCompilation;
    const model = createGraphFocusModel({
      compilation: () => compilation,
      adjacency: () => new Map(),
      nodeCategory: () => new Map(),
      searchMatches: () => null,
      selected: () => new Set(),
      hovered: () => 'a',
      scheduler,
      invalidate: () => {},
    });
    model.hoverRadius('a');
    const tween = anims.at(-1) as Animation;
    tween.tick(0);
    tween.tick(100 * fraction);
    return model.frame(0).hoverRadiusScale?.get('a') as number;
  }

  it.each([
    ['smooth', cubicInOut],
    ['snappy', cubicOut],
  ] as const)('%s follows its cubic', (ease, cubic) => {
    expect(hoverScaleAt(ease, 0.25)).toBeCloseTo(1 + 0.15 * cubic(0.25), 12);
  });
});

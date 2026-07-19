/**
 * Camera flight: view <-> transform round-trip, flight progress/easing,
 * provider-form target tracking, duration resolution, and k clamping.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  clampK,
  createCameraFlight,
  createCameraFollow,
  resolveDuration,
  transformToView,
  type Viewport,
  viewToTransform,
} from '../camera';
import { ZoomTransform } from '../zoom';

const viewport: Viewport = { width: 800, height: 600 };

describe('transformToView / viewToTransform', () => {
  it('round-trips a transform exactly', () => {
    const t = new ZoomTransform(120, -40, 1.5);
    const back = viewToTransform(transformToView(t, viewport), viewport);
    expect(back.x).toBeCloseTo(t.x, 6);
    expect(back.y).toBeCloseTo(t.y, 6);
    expect(back.k).toBeCloseTo(t.k, 6);
  });

  it('view center is the graph point under the viewport center', () => {
    const t = new ZoomTransform(0, 0, 2);
    const [cx, cy] = transformToView(t, viewport);
    expect(cx).toBeCloseTo(200, 6); // (400 - 0)/2
    expect(cy).toBeCloseTo(150, 6); // (300 - 0)/2
  });
});

describe('clampK', () => {
  it('clamps into [0.05, 15]', () => {
    expect(clampK(0.001)).toBe(0.05);
    expect(clampK(1000)).toBe(15);
    expect(clampK(2)).toBe(2);
  });
  it('guards non-finite / non-positive', () => {
    expect(clampK(Number.NaN)).toBe(0.05);
    expect(clampK(0)).toBe(0.05);
    expect(clampK(-3)).toBe(0.05);
  });
});

describe('resolveDuration', () => {
  it('honors an explicit number, floored at 1ms', () => {
    expect(resolveDuration(500, 999)).toBe(500);
    expect(resolveDuration(0, 999)).toBe(1);
  });
  it('auto scales and clamps the interpolateZoom distance', () => {
    expect(resolveDuration('auto', 100)).toBe(300); // 100*0.6=60 -> min 300
    expect(resolveDuration('auto', 5000)).toBe(1200); // 5000*0.6=3000 -> max 1200
    expect(resolveDuration(undefined, 1000)).toBe(600); // 1000*0.6=600
  });
});

describe('createCameraFlight', () => {
  it('applies transforms from start to end, with a strictly-between midpoint', () => {
    const from = new ZoomTransform(0, 0, 1);
    const to = new ZoomTransform(-400, -300, 2);
    const applied: ZoomTransform[] = [];
    const flight = createCameraFlight({
      from,
      to,
      viewport,
      apply: (t) => applied.push(t),
      opts: { duration: 100, ease: 'smooth' },
    });

    // t=0
    expect(flight.tick(0)).toBe(true);
    const first = applied.at(-1) as ZoomTransform;
    expect(first.k).toBeCloseTo(from.k, 4);

    // mid
    expect(flight.tick(50)).toBe(true);
    const mid = applied.at(-1) as ZoomTransform;
    // Zoom is monotonic along the geodesic; midpoint k is strictly between.
    expect(mid.k).toBeGreaterThan(from.k);
    expect(mid.k).toBeLessThan(to.k);

    // end
    expect(flight.tick(100)).toBe(false);
    const last = applied.at(-1) as ZoomTransform;
    expect(last.k).toBeCloseTo(to.k, 3);
    expect(last.x).toBeCloseTo(to.x, 2);
    expect(last.y).toBeCloseTo(to.y, 2);
  });

  it('fires onDone once on completion', () => {
    const onDone = vi.fn();
    const flight = createCameraFlight({
      from: new ZoomTransform(0, 0, 1),
      to: new ZoomTransform(10, 10, 1),
      viewport,
      apply: () => {},
      onDone,
      opts: { duration: 10 },
    });
    flight.tick(0);
    flight.tick(100);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancel stops without firing onDone', () => {
    const onDone = vi.fn();
    const flight = createCameraFlight({
      from: new ZoomTransform(0, 0, 1),
      to: new ZoomTransform(10, 10, 1),
      viewport,
      apply: () => {},
      onDone,
      opts: { duration: 100 },
    });
    flight.tick(0);
    flight.cancel();
    expect(flight.tick(50)).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('provider form follows a moving target', () => {
    const from = new ZoomTransform(0, 0, 1);
    let targetX = 0;
    const provider = () => new ZoomTransform(targetX, 0, 1);
    const applied: ZoomTransform[] = [];
    const flight = createCameraFlight({
      from,
      to: provider,
      viewport,
      apply: (t) => applied.push(t),
      opts: { duration: 100 },
    });
    flight.tick(0);
    // Move the target, then advance: the end frame should reflect the NEW target.
    targetX = -200;
    flight.tick(100);
    const last = applied.at(-1) as ZoomTransform;
    expect(last.x).toBeCloseTo(-200, 1);
  });

  it('follow keeps tracking the provider after the flight completes', () => {
    // Post-flight follow: the flight converges at t=1 but the tracked node is
    // still settling; the follow snaps to the provider until the sim quiets.
    let targetX = -200;
    let alpha = 0.5;
    const applied: ZoomTransform[] = [];
    const follow = createCameraFollow({
      target: () => new ZoomTransform(targetX, 0, 1),
      apply: (t) => applied.push(t),
      isActive: () => alpha >= 0.05,
    });

    expect(follow.tick(0)).toBe(true);
    expect((applied.at(-1) as ZoomTransform).x).toBe(-200);

    // The node drifts; the follow tracks it.
    targetX = -250;
    expect(follow.tick(16)).toBe(true);
    expect((applied.at(-1) as ZoomTransform).x).toBe(-250);

    // Sim settles: the follow ends without applying another frame.
    alpha = 0.01;
    const frames = applied.length;
    expect(follow.tick(32)).toBe(false);
    expect(applied.length).toBe(frames);
  });

  it('follow cancel stops immediately', () => {
    const applied: ZoomTransform[] = [];
    const follow = createCameraFollow({
      target: () => new ZoomTransform(0, 0, 1),
      apply: (t) => applied.push(t),
      isActive: () => true,
    });
    expect(follow.tick(0)).toBe(true);
    follow.cancel();
    expect(follow.tick(16)).toBe(false);
    expect(applied.length).toBe(1);
  });

  it('degenerate from≈to still ticks and completes', () => {
    const t = new ZoomTransform(50, 50, 1);
    const flight = createCameraFlight({
      from: t,
      to: t,
      viewport,
      apply: () => {},
      opts: { duration: 'auto' },
    });
    expect(flight.tick(0)).toBe(true);
    expect(flight.tick(10_000)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  type Camera,
  camerasClose,
  cameraTransform,
  damp,
  dampCamera,
  FULL_VIEW,
  fitTarget,
  interpolateCamera,
  scrubCamera,
} from '../camera-math';
import { easingFns } from '../tween';

const VB = { width: 400, height: 340 };

describe('fitTarget', () => {
  it('full viewBox target is the identity camera', () => {
    const cam = fitTarget(FULL_VIEW(VB), VB);
    expect(cam).toEqual({ cx: 200, cy: 170, k: 1 });
  });

  it('limits by the tighter axis', () => {
    // Wide, short target: width is the limiting axis
    const wide = fitTarget({ x: 0, y: 0, width: 200, height: 20 }, VB);
    expect(wide.k).toBeCloseTo(400 / 200);

    // Narrow, tall target: height limits
    const tall = fitTarget({ x: 0, y: 0, width: 20, height: 170 }, VB);
    expect(tall.k).toBeCloseTo(340 / 170);
  });

  it('padding reduces zoom', () => {
    const noPad = fitTarget({ x: 0, y: 0, width: 100, height: 100 }, VB);
    const padded = fitTarget({ x: 0, y: 0, width: 100, height: 100, padding: 20 }, VB);
    expect(padded.k).toBeLessThan(noPad.k);
    expect(padded.k).toBeCloseTo(Math.min(400 / 140, 340 / 140));
  });

  it('centers on the target rect', () => {
    const cam = fitTarget({ x: 50, y: 80, width: 100, height: 60 }, VB);
    expect(cam.cx).toBe(100);
    expect(cam.cy).toBe(110);
  });
});

describe('interpolateCamera', () => {
  const a: Camera = { cx: 0, cy: 0, k: 1 };
  const b: Camera = { cx: 100, cy: 50, k: 4 };

  it('endpoints are exact', () => {
    expect(interpolateCamera(a, b, 0)).toEqual(a);
    const end = interpolateCamera(a, b, 1);
    expect(end.cx).toBeCloseTo(100);
    expect(end.k).toBeCloseTo(4);
  });

  it('zoom midpoint is geometric (log space): 1->4 passes through 2', () => {
    const mid = interpolateCamera(a, b, 0.5);
    expect(mid.k).toBeCloseTo(2); // not 2.5
    expect(mid.cx).toBeCloseTo(50); // pan stays linear
  });
});

describe('cameraTransform', () => {
  function apply(transform: string, x: number, y: number): [number, number] {
    // Parse `translate(tx ty) scale(k) translate(-cx -cy)` and apply.
    const nums = transform.match(/-?\d+(\.\d+)?(e-?\d+)?/g)!.map(Number);
    const [tx, ty, k, ncx, ncy] = nums;
    return [tx! + k! * (x + ncx!), ty! + k! * (y + ncy!)];
  }

  it('identity camera maps viewBox corners to themselves', () => {
    const t = cameraTransform({ cx: 200, cy: 170, k: 1 }, VB);
    expect(apply(t, 0, 0)).toEqual([0, 0]);
    expect(apply(t, 400, 340)).toEqual([400, 340]);
  });

  it('zoomed camera maps its center to the viewBox center', () => {
    const t = cameraTransform({ cx: 100, cy: 90, k: 2 }, VB);
    expect(apply(t, 100, 90)).toEqual([200, 170]);
  });
});

describe('damp', () => {
  it('converges toward the target', () => {
    let v = 0;
    for (let i = 0; i < 100; i++) v = damp(v, 100, 100, 16);
    expect(v).toBeCloseTo(100, 1);
  });

  it('is frame-rate independent: two 8ms steps ~= one 16ms step', () => {
    const one = damp(0, 100, 100, 16);
    const two = damp(damp(0, 100, 100, 8), 100, 100, 8);
    expect(two).toBeCloseTo(one, 6);
  });

  it('tau of 0 snaps', () => {
    expect(damp(0, 100, 0, 16)).toBe(100);
  });
});

describe('dampCamera / camerasClose', () => {
  it('damps k in log space and converges', () => {
    let cam: Camera = { cx: 0, cy: 0, k: 1 };
    const target: Camera = { cx: 10, cy: 10, k: 4 };
    for (let i = 0; i < 200; i++) cam = dampCamera(cam, target, 100, 16);
    expect(camerasClose(cam, target)).toBe(true);
  });
});

describe('scrubCamera (hold zones)', () => {
  const fitted: Camera[] = [
    { cx: 200, cy: 170, k: 1 },
    { cx: 110, cy: 160, k: 1.6 },
    { cx: 290, cy: 160, k: 1.6 },
  ];
  const HOLD = 0.65;

  it('holds the active target through the hold zone', () => {
    // The camera must DWELL on what the text describes, not depart on entry.
    expect(scrubCamera(1, 0, fitted, HOLD, easingFns.linear)).toEqual(fitted[1]);
    expect(scrubCamera(1, 0.4, fitted, HOLD, easingFns.linear)).toEqual(fitted[1]);
    expect(scrubCamera(1, 0.65, fitted, HOLD, easingFns.linear)).toEqual(fitted[1]);
  });

  it('interpolates toward the next target only in the tail', () => {
    const mid = scrubCamera(1, 0.825, fitted, HOLD, easingFns.linear);
    expect(mid.cx).toBeCloseTo((110 + 290) / 2);
    const end = scrubCamera(1, 1, fitted, HOLD, easingFns.linear);
    expect(end.cx).toBeCloseTo(290);
  });

  it('step -1 pins to the first target', () => {
    expect(scrubCamera(-1, 0.5, fitted, HOLD, easingFns.linear)).toEqual(fitted[0]);
  });

  it('last step never departs', () => {
    expect(scrubCamera(2, 0.99, fitted, HOLD, easingFns.linear)).toEqual(fitted[2]);
  });

  it('empty targets fall back to identity', () => {
    expect(scrubCamera(0, 0.5, [], HOLD, easingFns.linear)).toEqual({ cx: 0, cy: 0, k: 1 });
  });
});

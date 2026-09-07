import { describe, expect, it } from 'vitest';
import { computeFit, cross, type FitPoint, type FitView, normalize } from '../fit';

const view: FitView = {
  cameraPos: { x: 0, y: 0, z: 1000 },
  fovDeg: 50,
  aspect: 1.5,
  viewportHeight: 600,
  paddingPx: 40,
};

function pts(...coords: Array<[number, number, number]>): FitPoint[] {
  return coords.map(([x, y, z]) => ({ x, y, z, radius: 0 }));
}

describe('computeFit', () => {
  it('returns null for an empty cloud', () => {
    expect(computeFit([], view)).toBeNull();
  });

  // A simulation that diverges hands back Infinity/NaN coordinates. Only minX
  // used to be checked, so a blow-up on any other axis produced a fit whose
  // center or distance was non-finite and moved the camera nowhere useful.
  it.each([
    ['x', { x: Number.POSITIVE_INFINITY, y: 0, z: 0 }],
    ['y', { x: 0, y: Number.POSITIVE_INFINITY, z: 0 }],
    ['z', { x: 0, y: 0, z: Number.NEGATIVE_INFINITY }],
  ])('returns null when %s is non-finite', (_axis, bad) => {
    expect(computeFit([{ ...bad, radius: 0 }, ...pts([0, 0, 0], [10, 10, 10])], view)).toBeNull();
  });

  it('returns null for an all-NaN cloud', () => {
    const nan = Number.NaN;
    expect(computeFit([{ x: nan, y: nan, z: nan, radius: 0 }], view)).toBeNull();
  });

  it('centres on the cloud, not the world origin', () => {
    const fit = computeFit(pts([100, 100, 0], [300, 300, 0]), view);
    expect(fit?.center).toEqual({ x: 200, y: 200, z: 0 });
  });

  it('keeps the current viewing direction and only changes distance', () => {
    const fit = computeFit(pts([-50, 0, 0], [50, 0, 0]), {
      ...view,
      cameraPos: { x: 0, y: 0, z: 500 },
    });
    expect(fit?.dir).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('scales the distance with the cloud', () => {
    const small = computeFit(pts([-50, 0, 0], [50, 0, 0]), view);
    const large = computeFit(pts([-500, 0, 0], [500, 0, 0]), view);
    expect((large?.distance ?? 0) / (small?.distance ?? 1)).toBeCloseTo(10, 0);
  });

  it('frames tightly enough that the cloud fills most of the viewport', () => {
    // Half-height 100 at 50deg vertical fov: the exact fit distance is
    // 100 / tan(25deg) = 214.5, and padding may only add a little to that.
    const fit = computeFit(pts([0, -100, 0], [0, 100, 0]), { ...view, paddingPx: 0 });
    expect(fit?.distance).toBeCloseTo(100 / Math.tan((25 * Math.PI) / 180), 0);
  });

  it('pushes back for the depth in front of the cloud', () => {
    const flat = computeFit(pts([0, -100, 0], [0, 100, 0]), view);
    const deep = computeFit(pts([0, -100, 0], [0, 100, 0], [0, 0, 300]), view);
    expect(deep?.distance ?? 0).toBeGreaterThan(flat?.distance ?? 0);
  });

  it('never lands closer than the floor for a single node', () => {
    const fit = computeFit([{ x: 0, y: 0, z: 0, radius: 1 }], view);
    expect(fit?.distance ?? 0).toBeGreaterThanOrEqual(60);
  });

  it('accounts for node radius', () => {
    const bare = computeFit(pts([0, -100, 0], [0, 100, 0]), view);
    const fat = computeFit(
      [
        { x: 0, y: -100, z: 0, radius: 40 },
        { x: 0, y: 100, z: 0, radius: 40 },
      ],
      view,
    );
    expect(fat?.distance ?? 0).toBeGreaterThan(bare?.distance ?? 0);
  });
});

describe('vector helpers', () => {
  it('falls back to +z for a degenerate direction', () => {
    expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('normalizes to unit length', () => {
    const n = normalize({ x: 3, y: 4, z: 0 });
    expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1);
  });

  it('crosses right-handed', () => {
    expect(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });
});

import type { Rect } from '@opendata-ai/openchart-core';
import { overlapArea } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import {
  findBestPlacement,
  isAutoPlacement,
  type PlacementObstacle,
  samplePolylineObstacles,
} from '../placement';

// ---------------------------------------------------------------------------
// samplePolylineObstacles
// ---------------------------------------------------------------------------

describe('samplePolylineObstacles', () => {
  it('returns empty array for empty input', () => {
    expect(samplePolylineObstacles([], 'line')).toEqual([]);
  });

  it('returns single padded rect for a single point', () => {
    const pad = 3;
    const result = samplePolylineObstacles([{ x: 50, y: 100 }], 'line', 24, pad);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      x: 50 - pad,
      y: 100 - pad,
      width: pad * 2,
      height: pad * 2,
      kind: 'line',
    });
  });

  it('returns single vertical rect when all points share the same x', () => {
    const pad = 3;
    const points = [
      { x: 100, y: 10 },
      { x: 100, y: 50 },
      { x: 100, y: 30 },
    ];
    const result = samplePolylineObstacles(points, 'line', 24, pad);
    expect(result).toHaveLength(1);
    expect(result[0].x).toBe(100 - pad);
    expect(result[0].y).toBe(10 - pad);
    expect(result[0].width).toBe(pad * 2);
    expect(result[0].height).toBe(50 - 10 + pad * 2);
  });

  it('produces gap-free coverage for a steep sine wave', () => {
    // Generate a sine wave with enough amplitude to cross many buckets vertically
    const bucketWidth = 20;
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 200; i++) {
      const x = i;
      const y = Math.sin(x * 0.1) * 100;
      points.push({ x, y });
    }

    const obstacles = samplePolylineObstacles(points, 'line', bucketWidth, 0);
    expect(obstacles.length).toBeGreaterThan(0);

    // The union of obstacle x-ranges should cover the entire polyline x-extent
    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));

    // Sort obstacles by x and verify continuous coverage
    const sorted = [...obstacles].sort((a, b) => a.x - b.x);
    expect(sorted[0].x).toBeLessThanOrEqual(xMin);
    const lastObs = sorted[sorted.length - 1];
    expect(lastObs.x + lastObs.width).toBeGreaterThanOrEqual(xMax);

    // Check no gaps between consecutive obstacles
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = sorted[i - 1].x + sorted[i - 1].width;
      expect(sorted[i].x).toBeLessThanOrEqual(prevEnd + 0.001);
    }
  });

  it('captures min/max y within each bucket for monotone increasing data', () => {
    const bucketWidth = 50;
    const pad = 0;
    // Monotone increasing: y = x
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= 200; i += 10) {
      points.push({ x: i, y: i });
    }

    const obstacles = samplePolylineObstacles(points, 'line', bucketWidth, pad);

    for (const obs of obstacles) {
      // Find all points within this bucket's x-range
      const bucketXStart = obs.x;
      const bucketXEnd = obs.x + obs.width;
      const inBucket = points.filter((p) => p.x >= bucketXStart && p.x < bucketXEnd);

      if (inBucket.length === 0) continue;

      const minY = Math.min(...inBucket.map((p) => p.y));
      const maxY = Math.max(...inBucket.map((p) => p.y));

      // The obstacle's y range should contain the points' y range within this bucket
      // (it may be larger due to interpolation at bucket edges, but should not be smaller)
      expect(obs.y).toBeLessThanOrEqual(minY);
      expect(obs.y + obs.height).toBeGreaterThanOrEqual(maxY);
    }
  });

  it('bucket width parameter controls granularity', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ];

    const narrow = samplePolylineObstacles(points, 'line', 10, 0);
    const wide = samplePolylineObstacles(points, 'line', 50, 0);

    // Narrower buckets should produce more obstacles
    expect(narrow.length).toBeGreaterThan(wide.length);
    // Each obstacle's width matches the bucket width
    for (const obs of narrow) expect(obs.width).toBe(10);
    for (const obs of wide) expect(obs.width).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// overlapArea (from @opendata-ai/openchart-core)
// ---------------------------------------------------------------------------

describe('overlapArea', () => {
  it('returns 0 for disjoint rects', () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 20, y: 20, width: 10, height: 10 };
    expect(overlapArea(a, b)).toBe(0);
  });

  it('returns correct area for partial overlap', () => {
    const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
    const b: Rect = { x: 5, y: 5, width: 10, height: 10 };
    // Overlap region: x=[5,10], y=[5,10] => 5*5 = 25
    expect(overlapArea(a, b)).toBe(25);
  });

  it('returns smaller rects area when one rect is fully contained', () => {
    const outer: Rect = { x: 0, y: 0, width: 100, height: 100 };
    const inner: Rect = { x: 10, y: 10, width: 20, height: 30 };
    expect(overlapArea(outer, inner)).toBe(20 * 30);
    // Symmetric
    expect(overlapArea(inner, outer)).toBe(20 * 30);
  });

  it('returns full area for identical rects', () => {
    const r: Rect = { x: 5, y: 5, width: 40, height: 60 };
    expect(overlapArea(r, r)).toBe(40 * 60);
  });
});

// ---------------------------------------------------------------------------
// Scorer (via findBestPlacement)
// ---------------------------------------------------------------------------

describe('findBestPlacement scorer', () => {
  // A large chart area and SVG rect so nothing clips
  const chartArea: Rect = { x: 0, y: 0, width: 800, height: 600 };
  const svgRect: Rect = { x: 0, y: 0, width: 800, height: 600 };
  const style = { fontSize: 12, fontWeight: 400, lineHeight: 1.3 };

  it('picks NE (direction index 1) first for a lower-half anchor on an empty chart', () => {
    // Anchor in the lower half of the chart
    const result = findBestPlacement(
      400,
      400,
      'Test',
      style,
      undefined,
      undefined,
      [],
      chartArea,
      svgRect,
      undefined,
      true,
    );

    // LOWER_HALF_ORDER = [1, 0, 7, 2, 3, 4, 5, 6] => first tried is NE (index 1)
    // On empty chart, the first direction tried gets the lowest tiebreak and wins
    // (all candidates score close to 0 for obstacles/clipping, tiebreak resolves it)
    expect(result.debug).toBeDefined();
    // The best candidate should be direction index 1 (NE)
    const best = result.debug!.reduce((a, b) => (a.total <= b.total ? a : b));
    expect(best.direction).toBe('NE');
  });

  it('picks SE (direction index 3) first for an upper-half anchor on an empty chart', () => {
    // Anchor in the upper half of the chart
    const result = findBestPlacement(
      400,
      100,
      'Test',
      style,
      undefined,
      undefined,
      [],
      chartArea,
      svgRect,
      undefined,
      true,
    );

    // UPPER_HALF_ORDER = [3, 4, 5, 2, 1, 0, 7, 6] => first tried is SE (index 3)
    const best = result.debug!.reduce((a, b) => (a.total <= b.total ? a : b));
    expect(best.direction).toBe('SE');
  });

  it('avoids the N direction when blocked by a hard obstacle', () => {
    // Place a large hard obstacle directly above the anchor so that the N direction
    // would overlap it heavily
    const anchorX = 400;
    const anchorY = 400;
    const obstacle: PlacementObstacle = {
      x: anchorX - 100,
      y: anchorY - 80,
      width: 200,
      height: 60,
      kind: 'line',
    };

    const result = findBestPlacement(
      anchorX,
      anchorY,
      'Test label',
      style,
      undefined,
      undefined,
      [obstacle],
      chartArea,
      svgRect,
      undefined,
      true,
    );

    // The winning direction should NOT be N (index 0), because the obstacle blocks it
    const best = result.debug!.reduce((a, b) => (a.total <= b.total ? a : b));
    expect(best.direction).not.toBe('N');
  });

  it('penalizes area-fill overlap less than line overlap of equal area', () => {
    const anchorX = 400;
    const anchorY = 300;

    // Surround the anchor with obstacles on all sides so every candidate
    // overlaps at least one. The winning candidate will necessarily overlap,
    // making the obstacle kind weight the differentiating factor.
    function makeWall(kind: 'line' | 'area-fill'): PlacementObstacle[] {
      return [{ x: anchorX - 200, y: anchorY - 200, width: 400, height: 400, kind }];
    }

    const lineResult = findBestPlacement(
      anchorX,
      anchorY,
      'Test',
      style,
      undefined,
      undefined,
      makeWall('line'),
      chartArea,
      svgRect,
      undefined,
      true,
    );

    const areaResult = findBestPlacement(
      anchorX,
      anchorY,
      'Test',
      style,
      undefined,
      undefined,
      makeWall('area-fill'),
      chartArea,
      svgRect,
      undefined,
      true,
    );

    // Both winners overlap their obstacle, but area-fill weight (1.5) is much
    // lower than line weight (20), so the area-fill score should be smaller.
    expect(areaResult.score).toBeLessThan(lineResult.score);
  });
});

// ---------------------------------------------------------------------------
// isAutoPlacement
// ---------------------------------------------------------------------------

describe('isAutoPlacement', () => {
  it('returns true for plain annotation without offset/anchor/drop-line', () => {
    expect(isAutoPlacement({})).toBe(true);
  });

  it('returns false when offset is set', () => {
    expect(isAutoPlacement({ offset: { dx: 10 } })).toBe(false);
  });

  it('returns false when anchor is not auto', () => {
    expect(isAutoPlacement({ anchor: 'top' })).toBe(false);
    expect(isAutoPlacement({ anchor: 'left' })).toBe(false);
    expect(isAutoPlacement({ anchor: 'right' })).toBe(false);
    expect(isAutoPlacement({ anchor: 'bottom' })).toBe(false);
  });

  it('returns false when connector is drop-line', () => {
    expect(isAutoPlacement({ connector: 'drop-line' })).toBe(false);
  });

  it('returns true when anchor is explicitly auto', () => {
    expect(isAutoPlacement({ anchor: 'auto' })).toBe(true);
  });
});

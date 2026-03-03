import type { PointMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { computeTrendLine } from '../trendline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a PointMark with the given center coordinates. */
function makePoint(cx: number, cy: number): PointMark {
  return {
    type: 'point',
    cx,
    cy,
    r: 5,
    fill: '#333',
    stroke: '#fff',
    strokeWidth: 1,
    data: {},
    aria: { label: `point at (${cx}, ${cy})` },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeTrendLine', () => {
  describe('linear regression computation', () => {
    it('returns a LineMark with two endpoint coordinates', () => {
      const points = [makePoint(100, 200), makePoint(200, 150), makePoint(300, 100)];
      const result = computeTrendLine(points);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('line');
      expect(result!.points).toHaveLength(2);
    });

    it('computes correct regression for a perfect positive slope', () => {
      // y = 2x + 10: when x=0,y=10; x=100,y=210; x=200,y=410
      // Note: these are pixel coordinates, not data coordinates
      const points = [makePoint(0, 10), makePoint(100, 210), makePoint(200, 410)];
      const result = computeTrendLine(points)!;

      // Line spans from x=0 to x=200
      expect(result.points[0].x).toBeCloseTo(0, 1);
      expect(result.points[1].x).toBeCloseTo(200, 1);

      // y at x=0 should be 10, y at x=200 should be 410
      expect(result.points[0].y).toBeCloseTo(10, 1);
      expect(result.points[1].y).toBeCloseTo(410, 1);
    });

    it('computes correct regression for a perfect negative slope', () => {
      // y = -x + 300: when x=0,y=300; x=100,y=200; x=200,y=100
      const points = [makePoint(0, 300), makePoint(100, 200), makePoint(200, 100)];
      const result = computeTrendLine(points)!;

      expect(result.points[0].x).toBeCloseTo(0, 1);
      expect(result.points[0].y).toBeCloseTo(300, 1);
      expect(result.points[1].x).toBeCloseTo(200, 1);
      expect(result.points[1].y).toBeCloseTo(100, 1);
    });

    it('computes a flat line for horizontal data', () => {
      // All y values are the same
      const points = [makePoint(50, 150), makePoint(150, 150), makePoint(250, 150)];
      const result = computeTrendLine(points)!;

      expect(result.points[0].y).toBeCloseTo(150, 1);
      expect(result.points[1].y).toBeCloseTo(150, 1);
    });

    it('spans from minimum to maximum x of input points', () => {
      const points = [makePoint(80, 100), makePoint(250, 200), makePoint(120, 130)];
      const result = computeTrendLine(points)!;

      expect(result.points[0].x).toBeCloseTo(80, 1);
      expect(result.points[1].x).toBeCloseTo(250, 1);
    });

    it('fits a noisy dataset with approximate best-fit line', () => {
      // Roughly y = 0.5x + 50, with noise
      const points = [
        makePoint(0, 48),
        makePoint(50, 76),
        makePoint(100, 98),
        makePoint(150, 122),
        makePoint(200, 152),
      ];
      const result = computeTrendLine(points)!;

      // The slope should be approximately 0.5
      const slope =
        (result.points[1].y - result.points[0].y) / (result.points[1].x - result.points[0].x);
      expect(slope).toBeCloseTo(0.5, 0);

      // Intercept at x=0 should be approximately 50
      expect(result.points[0].y).toBeCloseTo(50, -1); // within 10
    });
  });

  describe('visual properties', () => {
    it('renders with a dashed stroke pattern', () => {
      const points = [makePoint(100, 200), makePoint(300, 100)];
      const result = computeTrendLine(points)!;

      expect(result.strokeDasharray).toBe('6 4');
    });

    it('has a subdued stroke color', () => {
      const points = [makePoint(100, 200), makePoint(300, 100)];
      const result = computeTrendLine(points)!;

      expect(result.stroke).toBe('#666666');
    });

    it('has a thin stroke width', () => {
      const points = [makePoint(100, 200), makePoint(300, 100)];
      const result = computeTrendLine(points)!;

      expect(result.strokeWidth).toBe(1.5);
    });

    it('has an aria label describing the trend', () => {
      const points = [makePoint(100, 200), makePoint(300, 100)];
      const result = computeTrendLine(points)!;

      expect(result.aria.label).toContain('Trend line');
      expect(result.aria.label).toContain('linear regression');
    });
  });

  describe('edge cases', () => {
    it('returns null for an empty array', () => {
      expect(computeTrendLine([])).toBeNull();
    });

    it('returns null for a single point', () => {
      expect(computeTrendLine([makePoint(100, 200)])).toBeNull();
    });

    it('handles exactly two points (deterministic line)', () => {
      const points = [makePoint(100, 300), makePoint(400, 150)];
      const result = computeTrendLine(points)!;

      // With two points, the regression line passes through both
      expect(result.points[0].x).toBeCloseTo(100, 1);
      expect(result.points[0].y).toBeCloseTo(300, 1);
      expect(result.points[1].x).toBeCloseTo(400, 1);
      expect(result.points[1].y).toBeCloseTo(150, 1);
    });

    it('returns null for vertical data (all same x)', () => {
      // All points have the same x coordinate: denominator in regression is 0
      const points = [makePoint(100, 50), makePoint(100, 150), makePoint(100, 250)];
      const result = computeTrendLine(points);

      expect(result).toBeNull();
    });

    it('handles points at the same location gracefully', () => {
      // All points are identical: zero variance in both x and y
      const points = [makePoint(100, 100), makePoint(100, 100)];
      const result = computeTrendLine(points);

      // Denominator is zero, so regression returns null
      expect(result).toBeNull();
    });

    it('handles large coordinate values without overflow', () => {
      const points = [makePoint(10000, 50000), makePoint(20000, 60000), makePoint(30000, 70000)];
      const result = computeTrendLine(points)!;

      expect(result.points[0].x).toBeCloseTo(10000, 0);
      expect(result.points[1].x).toBeCloseTo(30000, 0);
      // Perfect slope = 1
      const slope =
        (result.points[1].y - result.points[0].y) / (result.points[1].x - result.points[0].x);
      expect(slope).toBeCloseTo(1, 5);
    });

    it('handles negative coordinates', () => {
      const points = [makePoint(-200, -100), makePoint(0, 0), makePoint(200, 100)];
      const result = computeTrendLine(points)!;

      expect(result.points[0].x).toBeCloseTo(-200, 1);
      expect(result.points[1].x).toBeCloseTo(200, 1);
    });
  });
});

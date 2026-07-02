import { overlapArea } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { findBestPlacement, type PlacementObstacle, samplePolylineObstacles } from '../placement';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const CHART_AREA = { x: 50, y: 20, width: 500, height: 300 };
const SVG_RECT = { x: 0, y: 0, width: 600, height: 360 };
const DEFAULT_STYLE = { fontSize: 12, fontWeight: 400, lineHeight: 1.3 };

// ---------------------------------------------------------------------------
// 1. Pairwise non-overlap
// ---------------------------------------------------------------------------

describe('pairwise non-overlap', () => {
  it('two annotations at the same point do not overlap', () => {
    const anchorX = 300;
    const anchorY = 170;

    const r1 = findBestPlacement(
      anchorX,
      anchorY,
      'Label A',
      DEFAULT_STYLE,
      undefined,
      undefined,
      [],
      CHART_AREA,
      SVG_RECT,
    );

    // Feed the first result's bounds as an obstacle for the second
    const obstacle: PlacementObstacle = { ...r1.bounds, kind: 'annotation' };
    const r2 = findBestPlacement(
      anchorX,
      anchorY,
      'Label B',
      DEFAULT_STYLE,
      undefined,
      undefined,
      [obstacle],
      CHART_AREA,
      SVG_RECT,
    );

    expect(overlapArea(r1.bounds, r2.bounds)).toBe(0);
  });

  it('three annotations at the same point do not overlap each other', () => {
    const anchorX = 250;
    const anchorY = 160;
    const obstacles: PlacementObstacle[] = [];

    const results = [];
    for (const label of ['Alpha', 'Beta', 'Gamma']) {
      const r = findBestPlacement(
        anchorX,
        anchorY,
        label,
        DEFAULT_STYLE,
        undefined,
        undefined,
        obstacles,
        CHART_AREA,
        SVG_RECT,
      );
      results.push(r);
      obstacles.push({ ...r.bounds, kind: 'annotation' });
    }

    // Check all pairs
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(
          overlapArea(results[i].bounds, results[j].bounds),
          `annotations ${i} and ${j} should not overlap`,
        ).toBe(0);
      }
    }
  });

  it('two annotations at nearby points (within 20px) do not overlap', () => {
    const r1 = findBestPlacement(
      200,
      150,
      'Nearby A',
      DEFAULT_STYLE,
      undefined,
      undefined,
      [],
      CHART_AREA,
      SVG_RECT,
    );

    const obstacle: PlacementObstacle = { ...r1.bounds, kind: 'annotation' };
    const r2 = findBestPlacement(
      215,
      155,
      'Nearby B',
      DEFAULT_STYLE,
      undefined,
      undefined,
      [obstacle],
      CHART_AREA,
      SVG_RECT,
    );

    expect(overlapArea(r1.bounds, r2.bounds)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Bounds within SVG
// ---------------------------------------------------------------------------

describe('bounds within SVG', () => {
  const MARGIN = 2;

  function expectWithinSvg(label: string, anchorX: number, anchorY: number) {
    const r = findBestPlacement(
      anchorX,
      anchorY,
      label,
      DEFAULT_STYLE,
      undefined,
      undefined,
      [],
      CHART_AREA,
      SVG_RECT,
    );

    expect(r.bounds.x).toBeGreaterThanOrEqual(SVG_RECT.x - MARGIN);
    expect(r.bounds.y).toBeGreaterThanOrEqual(SVG_RECT.y - MARGIN);
    expect(r.bounds.x + r.bounds.width).toBeLessThanOrEqual(SVG_RECT.x + SVG_RECT.width + MARGIN);
    expect(r.bounds.y + r.bounds.height).toBeLessThanOrEqual(SVG_RECT.y + SVG_RECT.height + MARGIN);
  }

  it('annotation near top-left corner stays within SVG', () => {
    expectWithinSvg('Top Left', CHART_AREA.x + 10, CHART_AREA.y + 10);
  });

  it('annotation near bottom-right corner stays within SVG', () => {
    expectWithinSvg(
      'Bottom Right',
      CHART_AREA.x + CHART_AREA.width - 10,
      CHART_AREA.y + CHART_AREA.height - 10,
    );
  });

  it('annotation near right edge stays within SVG', () => {
    expectWithinSvg(
      'Right Edge',
      CHART_AREA.x + CHART_AREA.width - 5,
      CHART_AREA.y + CHART_AREA.height / 2,
    );
  });

  it('annotation at center is well within SVG', () => {
    const cx = CHART_AREA.x + CHART_AREA.width / 2;
    const cy = CHART_AREA.y + CHART_AREA.height / 2;
    const r = findBestPlacement(
      cx,
      cy,
      'Center',
      DEFAULT_STYLE,
      undefined,
      undefined,
      [],
      CHART_AREA,
      SVG_RECT,
    );

    // Center placement should be comfortably inside -- use a stricter margin
    const STRICT = 10;
    expect(r.bounds.x).toBeGreaterThanOrEqual(SVG_RECT.x + STRICT);
    expect(r.bounds.y).toBeGreaterThanOrEqual(SVG_RECT.y + STRICT);
    expect(r.bounds.x + r.bounds.width).toBeLessThanOrEqual(SVG_RECT.x + SVG_RECT.width - STRICT);
    expect(r.bounds.y + r.bounds.height).toBeLessThanOrEqual(SVG_RECT.y + SVG_RECT.height - STRICT);
  });
});

// ---------------------------------------------------------------------------
// 3. Line avoidance
// ---------------------------------------------------------------------------

describe('line avoidance', () => {
  it('annotation placed on a line avoids nearby line obstacles', () => {
    // Create a simple ascending line spanning the chart
    const points = [];
    for (let i = 0; i <= 10; i++) {
      points.push({
        x: CHART_AREA.x + (i / 10) * CHART_AREA.width,
        y: CHART_AREA.y + CHART_AREA.height - (i / 10) * CHART_AREA.height,
      });
    }

    const bucketWidth = 24;
    const lineObstacles = samplePolylineObstacles(points, 'line', bucketWidth);

    // Pick an anchor that sits on the line (midpoint)
    const anchorX = CHART_AREA.x + CHART_AREA.width / 2;
    const anchorY = CHART_AREA.y + CHART_AREA.height / 2;

    const result = findBestPlacement(
      anchorX,
      anchorY,
      'On the line',
      DEFAULT_STYLE,
      undefined,
      undefined,
      lineObstacles,
      CHART_AREA,
      SVG_RECT,
    );

    // Check that the result doesn't overlap line obstacles within +/-2 buckets of anchor
    const nearbyObstacles = lineObstacles.filter((obs) => {
      const obsMidX = obs.x + obs.width / 2;
      return Math.abs(obsMidX - anchorX) <= bucketWidth * 2;
    });

    for (const obs of nearbyObstacles) {
      expect(
        overlapArea(result.bounds, obs),
        `annotation should not overlap nearby line obstacle at x=${obs.x}`,
      ).toBe(0);
    }
  });

  it('annotation avoids a steep line segment', () => {
    // Steep V-shape line where the anchor is at the valley
    const points = [
      { x: CHART_AREA.x + 100, y: CHART_AREA.y + 50 },
      { x: CHART_AREA.x + 200, y: CHART_AREA.y + 250 },
      { x: CHART_AREA.x + 300, y: CHART_AREA.y + 50 },
    ];

    const bucketWidth = 24;
    const lineObstacles = samplePolylineObstacles(points, 'line', bucketWidth);

    // Anchor at the valley
    const anchorX = CHART_AREA.x + 200;
    const anchorY = CHART_AREA.y + 250;

    const result = findBestPlacement(
      anchorX,
      anchorY,
      'Valley',
      DEFAULT_STYLE,
      undefined,
      undefined,
      lineObstacles,
      CHART_AREA,
      SVG_RECT,
    );

    const nearbyObstacles = lineObstacles.filter((obs) => {
      const obsMidX = obs.x + obs.width / 2;
      return Math.abs(obsMidX - anchorX) <= bucketWidth * 2;
    });

    for (const obs of nearbyObstacles) {
      expect(
        overlapArea(result.bounds, obs),
        `annotation should not overlap nearby line obstacle at x=${obs.x}`,
      ).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Determinism
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('identical inputs produce identical outputs', () => {
    const anchorX = 300;
    const anchorY = 170;
    const text = 'Deterministic';
    const obstacles: PlacementObstacle[] = [
      { x: 280, y: 140, width: 40, height: 20, kind: 'mark' },
    ];

    const r1 = findBestPlacement(
      anchorX,
      anchorY,
      text,
      DEFAULT_STYLE,
      undefined,
      undefined,
      obstacles,
      CHART_AREA,
      SVG_RECT,
    );

    const r2 = findBestPlacement(
      anchorX,
      anchorY,
      text,
      DEFAULT_STYLE,
      undefined,
      undefined,
      obstacles,
      CHART_AREA,
      SVG_RECT,
    );

    expect(r1.labelX).toBe(r2.labelX);
    expect(r1.labelY).toBe(r2.labelY);
    expect(r1.textAnchor).toBe(r2.textAnchor);
    expect(r1.bounds).toEqual(r2.bounds);
    expect(r1.score).toBe(r2.score);
  });

  it('deterministic with multiple obstacles', () => {
    const obstacles: PlacementObstacle[] = [
      { x: 100, y: 100, width: 60, height: 30, kind: 'mark' },
      { x: 200, y: 80, width: 50, height: 40, kind: 'line' },
      { x: 150, y: 200, width: 80, height: 20, kind: 'legend' },
    ];

    const args = [
      250,
      150,
      'Stable',
      DEFAULT_STYLE,
      undefined,
      undefined,
      obstacles,
      CHART_AREA,
      SVG_RECT,
    ] as const;

    const r1 = findBestPlacement(...args);
    const r2 = findBestPlacement(...args);

    expect(r1.labelX).toBe(r2.labelX);
    expect(r1.labelY).toBe(r2.labelY);
    expect(r1.textAnchor).toBe(r2.textAnchor);
    expect(r1.bounds).toEqual(r2.bounds);
    expect(r1.score).toBe(r2.score);
  });
});

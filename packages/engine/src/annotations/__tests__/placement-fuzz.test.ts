import type { Rect } from '@opendata-ai/openchart-core';
import { overlapArea } from '@opendata-ai/openchart-core';
import { describe, it } from 'vitest';
import type { PlacementObstacle, PlacementResult } from '../placement';
import { findBestPlacement, samplePolylineObstacles } from '../placement';

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) - deterministic, no Date.now or Math.random
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Random helpers
// ---------------------------------------------------------------------------

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ---------------------------------------------------------------------------
// Case generator
// ---------------------------------------------------------------------------

type ChartType = 'line' | 'column' | 'scatter';

interface FuzzCase {
  caseIndex: number;
  containerWidth: number;
  containerHeight: number;
  chartArea: Rect;
  svgRect: Rect;
  chartType: ChartType;
  dataPoints: Array<{ x: number; y: number }>;
  annotationIndices: number[];
  obstacles: PlacementObstacle[];
}

function generateCase(rng: () => number, caseIndex: number): FuzzCase {
  const containerWidth = randInt(rng, 320, 1200);
  const containerHeight = randInt(rng, 240, 600);
  const inset = 50;

  const svgRect: Rect = { x: 0, y: 0, width: containerWidth, height: containerHeight };
  const chartArea: Rect = {
    x: inset,
    y: inset,
    width: containerWidth - inset * 2,
    height: containerHeight - inset * 2,
  };

  const chartType = randPick<ChartType>(rng, ['line', 'column', 'scatter']);
  const numPoints = randInt(rng, 5, 60);

  // Generate random data points within the chart area
  const dataPoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < numPoints; i++) {
    dataPoints.push({
      x: randRange(rng, chartArea.x, chartArea.x + chartArea.width),
      y: randRange(rng, chartArea.y, chartArea.y + chartArea.height),
    });
  }

  // Sort by x for line charts (polyline needs ordered points)
  if (chartType === 'line') {
    dataPoints.sort((a, b) => a.x - b.x);
  }

  // Generate obstacles based on chart type
  let obstacles: PlacementObstacle[] = [];

  if (chartType === 'line') {
    obstacles = samplePolylineObstacles(dataPoints, 'line', 24, 3);
  } else if (chartType === 'column') {
    // Rect obstacles for column bars
    const barWidth = Math.max(4, (chartArea.width / numPoints) * 0.6);
    for (const pt of dataPoints) {
      const barHeight = chartArea.y + chartArea.height - pt.y;
      obstacles.push({
        x: pt.x - barWidth / 2,
        y: pt.y,
        width: barWidth,
        height: barHeight,
        kind: 'mark',
      });
    }
  } else {
    // Scatter: point obstacles as small rects
    const pointRadius = 4;
    for (const pt of dataPoints) {
      obstacles.push({
        x: pt.x - pointRadius,
        y: pt.y - pointRadius,
        width: pointRadius * 2,
        height: pointRadius * 2,
        kind: 'mark',
      });
    }
  }

  // Pick 1-5 annotation anchor indices from the data points
  const numAnnotations = randInt(rng, 1, 5);
  const annotationIndices: number[] = [];
  for (let i = 0; i < numAnnotations; i++) {
    annotationIndices.push(randInt(rng, 0, numPoints - 1));
  }

  return {
    caseIndex,
    containerWidth,
    containerHeight,
    chartArea,
    svgRect,
    chartType,
    dataPoints,
    annotationIndices,
    obstacles,
  };
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

const ANNOTATION_STYLE = { fontSize: 12, fontWeight: 600, lineHeight: 1.2 };

describe('placement engine fuzz', () => {
  it('passes 200 fuzz cases', () => {
    const rng = mulberry32(42);

    for (let i = 0; i < 200; i++) {
      const tc = generateCase(rng, i);
      const results: PlacementResult[] = [];
      // Copy obstacles so we can append placed annotation bounds
      const liveObstacles: PlacementObstacle[] = [...tc.obstacles];

      for (const ptIdx of tc.annotationIndices) {
        const anchor = tc.dataPoints[ptIdx];
        const text = `Annotation ${ptIdx}`;

        const result = findBestPlacement(
          anchor.x,
          anchor.y,
          text,
          ANNOTATION_STYLE,
          undefined, // no subtitle
          undefined,
          liveObstacles,
          tc.chartArea,
          tc.svgRect,
        );

        results.push(result);

        // Add this placed annotation as an obstacle for subsequent annotations
        liveObstacles.push({
          ...result.bounds,
          kind: 'annotation',
        });
      }

      const caseInfo = () =>
        JSON.stringify(
          {
            caseIndex: tc.caseIndex,
            containerWidth: tc.containerWidth,
            containerHeight: tc.containerHeight,
            chartType: tc.chartType,
            numDataPoints: tc.dataPoints.length,
            annotationIndices: tc.annotationIndices,
            chartArea: tc.chartArea,
            svgRect: tc.svgRect,
          },
          null,
          2,
        );

      // Invariant 1: Pairwise non-overlap when all placements found clean spots
      const allClean = results.every((r) => r.score < 0.1);
      if (allClean && results.length > 1) {
        for (let a = 0; a < results.length; a++) {
          for (let b = a + 1; b < results.length; b++) {
            const overlap = overlapArea(results[a].bounds, results[b].bounds);
            if (overlap >= 0.5) {
              throw new Error(
                `Invariant 1 failed: pairwise overlap ${overlap.toFixed(2)}px^2 between annotation ${a} and ${b} (both scored < 0.1).\n${caseInfo()}`,
              );
            }
          }
        }
      }

      // Invariant 2: Bounds within SVG (2px margin tolerance)
      const margin = 2;
      for (let r = 0; r < results.length; r++) {
        const b = results[r].bounds;
        const inBounds =
          b.x >= tc.svgRect.x - margin &&
          b.y >= tc.svgRect.y - margin &&
          b.x + b.width <= tc.svgRect.x + tc.svgRect.width + margin &&
          b.y + b.height <= tc.svgRect.y + tc.svgRect.height + margin;

        if (!inBounds) {
          // Only fail if the placement engine scored it well (low score means
          // it thought this was a good placement). High-score placements may
          // be pushed out of bounds when the chart is too crowded.
          if (results[r].score < 1) {
            throw new Error(
              `Invariant 2 failed: annotation ${r} bounds outside SVG rect (score=${results[r].score.toFixed(3)}).\n` +
                `bounds: ${JSON.stringify(b)}\nsvgRect: ${JSON.stringify(tc.svgRect)}\n${caseInfo()}`,
            );
          }
        }
      }

      // Invariant 3: Line avoidance - when chart type is 'line', verify
      // low-score annotations don't overlap line obstacles near their anchor
      if (tc.chartType === 'line') {
        for (let r = 0; r < results.length; r++) {
          if (results[r].score >= 0.1) continue; // only check clean placements

          const anchor = tc.dataPoints[tc.annotationIndices[r]];
          // Check line obstacles near the anchor (within 30px horizontally)
          const nearbyLineObs = tc.obstacles.filter(
            (obs) =>
              obs.kind === 'line' && obs.x < anchor.x + 30 && obs.x + obs.width > anchor.x - 30,
          );

          for (const obs of nearbyLineObs) {
            const overlap = overlapArea(results[r].bounds, obs);
            if (overlap > 5) {
              throw new Error(
                `Invariant 3 failed: annotation ${r} overlaps nearby line obstacle by ${overlap.toFixed(2)}px^2 (score=${results[r].score.toFixed(3)}).\n${caseInfo()}`,
              );
            }
          }
        }
      }
    }
  });
});

/**
 * Trend line computation for scatter plots.
 *
 * Computes a simple linear regression (least squares) over the
 * point marks and returns a LineMark representing the best-fit line.
 */

import type { LineMark, MarkAria, PointMark } from '@opendata-ai/core';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRENDLINE_COLOR = '#666666';
const TRENDLINE_STROKE_WIDTH = 1.5;
const TRENDLINE_DASH = '6 4';

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------

/**
 * Compute slope and intercept for a simple linear regression.
 * Returns null if there aren't enough points or variance is zero.
 */
function linearRegression(
  points: { x: number; y: number }[],
): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a trend line (linear regression) over scatter point marks.
 *
 * Returns a single LineMark spanning the x-range of the data points,
 * rendered as a dashed line. Returns null if regression can't be computed.
 */
export function computeTrendLine(marks: PointMark[]): LineMark | null {
  if (marks.length < 2) return null;

  const points = marks.map((m) => ({ x: m.cx, y: m.cy }));
  const result = linearRegression(points);
  if (!result) return null;

  const { slope, intercept } = result;

  // Find x range from marks
  let minX = Infinity;
  let maxX = -Infinity;
  for (const m of marks) {
    if (m.cx < minX) minX = m.cx;
    if (m.cx > maxX) maxX = m.cx;
  }

  // Compute y values at the endpoints
  const y1 = slope * minX + intercept;
  const y2 = slope * maxX + intercept;

  const aria: MarkAria = {
    label: `Trend line: linear regression`,
  };

  return {
    type: 'line',
    points: [
      { x: minX, y: y1 },
      { x: maxX, y: y2 },
    ],
    stroke: TRENDLINE_COLOR,
    strokeWidth: TRENDLINE_STROKE_WIDTH,
    strokeDasharray: TRENDLINE_DASH,
    data: [],
    aria,
  };
}

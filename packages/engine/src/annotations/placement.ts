/**
 * Annotation placement engine: typed obstacles, candidate generation,
 * scored search, and two-pass deterministic placement.
 */

import { overlapArea, type Rect } from '@opendata-ai/openchart-core';
import { ANCHOR_OFFSET } from './constants';
import {
  type AnnotationMeasureTextFn,
  computeTextBlockBounds,
  heuristicMeasure,
  unionRects,
} from './geometry';

export type ObstacleKind =
  | 'mark'
  | 'line'
  | 'area-fill'
  | 'legend'
  | 'data-label'
  | 'endpoint-label'
  | 'watermark'
  | 'axis-band'
  | 'annotation';

export interface PlacementObstacle extends Rect {
  kind: ObstacleKind;
}

/**
 * Sample a polyline into bucket-based obstacle rects. Each bucket spans a
 * fixed x-width and covers the min/max y of the line within that bucket,
 * padded vertically. Interpolates segment y-values at bucket edges so steep
 * segments produce gap-free coverage.
 */
function lerpY(p0: { x: number; y: number }, p1: { x: number; y: number }, x: number): number {
  const dx = p1.x - p0.x;
  if (Math.abs(dx) < 1e-9) return (p0.y + p1.y) / 2;
  const t = (x - p0.x) / dx;
  return p0.y + t * (p1.y - p0.y);
}

function fillBucketsFromSegments(
  points: Array<{ x: number; y: number }>,
  buckets: Array<{ minY: number; maxY: number }>,
  xMin: number,
  bucketWidth: number,
): void {
  const bucketCount = buckets.length;

  function updateBucket(b: number, y: number): void {
    if (b < 0 || b >= bucketCount) return;
    if (y < buckets[b].minY) buckets[b].minY = y;
    if (y > buckets[b].maxY) buckets[b].maxY = y;
  }

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const segXMin = Math.min(p0.x, p1.x);
    const segXMax = Math.max(p0.x, p1.x);
    const bStart = Math.max(0, Math.floor((segXMin - xMin) / bucketWidth));
    const bEnd = Math.min(bucketCount - 1, Math.floor((segXMax - xMin) / bucketWidth));
    for (let b = bStart; b <= bEnd; b++) {
      const bx0 = xMin + b * bucketWidth;
      const bx1 = xMin + (b + 1) * bucketWidth;
      updateBucket(b, lerpY(p0, p1, Math.max(bx0, segXMin)));
      updateBucket(b, lerpY(p0, p1, Math.min(bx1, segXMax)));
    }
  }

  for (const p of points) {
    const b = Math.min(Math.floor((p.x - xMin) / bucketWidth), bucketCount - 1);
    updateBucket(b, p.y);
  }
}

export function samplePolylineObstacles(
  points: Array<{ x: number; y: number }>,
  kind: 'line' | 'area-fill' = 'line',
  bucketWidth = 24,
  pad = 3,
): PlacementObstacle[] {
  if (points.length === 0) return [];

  if (points.length === 1) {
    const p = points[0];
    return [
      {
        x: p.x - pad,
        y: p.y - pad,
        width: pad * 2,
        height: pad * 2,
        kind,
      },
    ];
  }

  let xMin = Infinity;
  let xMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
  }

  const span = xMax - xMin;
  if (span <= 0) {
    // All points at same x: single vertical rect
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of points) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    return [
      {
        x: xMin - pad,
        y: yMin - pad,
        width: pad * 2,
        height: yMax - yMin + pad * 2,
        kind,
      },
    ];
  }

  const bucketCount = Math.ceil(span / bucketWidth);
  const buckets: Array<{ minY: number; maxY: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    buckets.push({ minY: Infinity, maxY: -Infinity });
  }

  fillBucketsFromSegments(points, buckets, xMin, bucketWidth);

  const obstacles: PlacementObstacle[] = [];
  for (let b = 0; b < bucketCount; b++) {
    const bucket = buckets[b];
    if (bucket.minY === Infinity) continue;
    obstacles.push({
      x: xMin + b * bucketWidth,
      y: bucket.minY - pad,
      width: bucketWidth,
      height: bucket.maxY - bucket.minY + pad * 2,
      kind,
    });
  }

  return obstacles;
}

/**
 * Sample an area mark's fill region into bucket-based obstacles. The top
 * boundary produces 'line' obstacles (hard), and the fill between top and
 * bottom produces 'area-fill' obstacles (soft).
 */
export function sampleAreaObstacles(
  topPoints: Array<{ x: number; y: number }>,
  bottomPoints: Array<{ x: number; y: number }>,
  bucketWidth = 24,
  pad = 3,
): PlacementObstacle[] {
  const lineObs = samplePolylineObstacles(topPoints, 'line', bucketWidth, pad);

  // For the fill region, sample both top and bottom boundaries and create
  // fill obstacles spanning from the top boundary down to the bottom boundary
  // within each bucket.
  if (topPoints.length < 2 || bottomPoints.length < 2) return lineObs;

  let xMin = Infinity;
  let xMax = -Infinity;
  for (const p of topPoints) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
  }

  const span = xMax - xMin;
  if (span <= 0) return lineObs;

  const bucketCount = Math.ceil(span / bucketWidth);
  const topBuckets: Array<{ minY: number; maxY: number }> = [];
  const bottomBuckets: Array<{ minY: number; maxY: number }> = [];
  for (let i = 0; i < bucketCount; i++) {
    topBuckets.push({ minY: Infinity, maxY: -Infinity });
    bottomBuckets.push({ minY: Infinity, maxY: -Infinity });
  }

  fillBucketsFromSegments(topPoints, topBuckets, xMin, bucketWidth);
  fillBucketsFromSegments(bottomPoints, bottomBuckets, xMin, bucketWidth);

  const fillObs: PlacementObstacle[] = [];
  for (let b = 0; b < bucketCount; b++) {
    const top = topBuckets[b];
    const bottom = bottomBuckets[b];
    if (top.minY === Infinity || bottom.minY === Infinity) continue;

    const fillTop = Math.min(top.minY, top.maxY);
    const fillBottom = Math.max(bottom.minY, bottom.maxY);
    if (fillBottom <= fillTop) continue;

    fillObs.push({
      x: xMin + b * bucketWidth,
      y: fillTop,
      width: bucketWidth,
      height: fillBottom - fillTop,
      kind: 'area-fill',
    });
  }

  return [...lineObs, ...fillObs];
}

/** Normalize a plain Rect[] to PlacementObstacle[] with a default kind. */
export function normalizeObstacles(
  rects: Rect[],
  kind: ObstacleKind = 'mark',
): PlacementObstacle[] {
  return rects.map((r) => ({ ...r, kind }));
}

// ---------------------------------------------------------------------------
// Scored placement search
// ---------------------------------------------------------------------------

const OBSTACLE_WEIGHTS: Record<ObstacleKind, number> = {
  annotation: 30,
  line: 20,
  mark: 8,
  'data-label': 8,
  'endpoint-label': 8,
  legend: 6,
  watermark: 6,
  'axis-band': 6,
  'area-fill': 1.5,
};

const W_SVG = 50;
const W_CHART = 6;
const W_DIST = 2;
const EPSILON = 0.001;
const CLEAN_THRESHOLD = EPSILON * 16;

interface DirectionDef {
  ux: number;
  uy: number;
  textAnchor: 'start' | 'middle' | 'end';
  attach:
    | 'bottom-center'
    | 'bottom-left'
    | 'left-middle'
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'right-middle'
    | 'bottom-right';
}

const D = Math.SQRT1_2;

const DIRECTIONS: DirectionDef[] = [
  { ux: 0, uy: -1, textAnchor: 'start', attach: 'bottom-center' }, // N
  { ux: D, uy: -D, textAnchor: 'start', attach: 'bottom-left' }, // NE
  { ux: 1, uy: 0, textAnchor: 'start', attach: 'left-middle' }, // E
  { ux: D, uy: D, textAnchor: 'start', attach: 'top-left' }, // SE
  { ux: 0, uy: 1, textAnchor: 'start', attach: 'top-center' }, // S
  { ux: -D, uy: D, textAnchor: 'end', attach: 'top-right' }, // SW
  { ux: -1, uy: 0, textAnchor: 'end', attach: 'right-middle' }, // W
  { ux: -D, uy: -D, textAnchor: 'end', attach: 'bottom-right' }, // NW
];

// Preferred direction orderings: away from data vertically, right over left
const LOWER_HALF_ORDER = [1, 0, 7, 2, 3, 4, 5, 6]; // NE, N, NW, E, SE, S, SW, W
const UPPER_HALF_ORDER = [3, 4, 5, 2, 1, 0, 7, 6]; // SE, S, SW, E, NE, N, NW, W

export interface PlacementCandidate {
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'middle' | 'end';
  box: Rect;
  directionIndex: number;
  ring: 1 | 2 | 3;
  score: number;
  candidateIdx: number;
}

export interface CandidateScoreBreakdown {
  direction: string;
  ring: 1 | 2 | 3;
  box: Rect;
  perObstacle: Array<{ kind: ObstacleKind; overlap: number; contribution: number }>;
  outsideSvg: number;
  outsideChart: number;
  distance: number;
  tiebreak: number;
  total: number;
}

function computeAttachmentPoint(
  anchorX: number,
  anchorY: number,
  dir: DirectionDef,
  radius: number,
): { x: number; y: number } {
  return {
    x: anchorX + dir.ux * radius,
    y: anchorY + dir.uy * radius,
  };
}

function labelPositionFromAttachment(
  attachPt: { x: number; y: number },
  dir: DirectionDef,
  boxHeight: number,
  fontSize: number,
  boxWidth: number,
): { labelX: number; labelY: number } {
  const attach = dir.attach;

  // A `*-center` attach means the block straddles the point, so `labelX` (the
  // text's start edge, since these directions render textAnchor 'start') has to
  // back off by half the block width. Centering the BLOCK is not the same as
  // center-aligning the TEXT: the lines inside stay left-aligned and ragged
  // right, per the reference voice. Without this the point sits at the block's
  // left edge and a "top" anchor reads as "up and to the right".
  const centered = attach === 'top-center' || attach === 'bottom-center';
  const labelX = centered ? attachPt.x - boxWidth / 2 : attachPt.x;

  let labelY: number;
  if (attach === 'left-middle' || attach === 'right-middle') {
    labelY = attachPt.y - boxHeight / 2 + fontSize;
  } else if (attach === 'top-left' || attach === 'top-center' || attach === 'top-right') {
    labelY = attachPt.y + fontSize;
  } else {
    labelY = attachPt.y - boxHeight + fontSize;
  }

  return { labelX, labelY };
}

function areaOutside(box: Rect, container: Rect): number {
  const insideX = Math.max(
    0,
    Math.min(box.x + box.width, container.x + container.width) - Math.max(box.x, container.x),
  );
  const insideY = Math.max(
    0,
    Math.min(box.y + box.height, container.y + container.height) - Math.max(box.y, container.y),
  );
  const insideArea = insideX * insideY;
  const boxArea = box.width * box.height;
  return Math.max(0, boxArea - insideArea);
}

function inflateRect(r: Rect, pad: number): Rect {
  return {
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  };
}

function scoreCandidate(
  box: Rect,
  obstacles: Rect[],
  svgRect: Rect,
  chartArea: Rect,
  anchorX: number,
  anchorY: number,
  chartDiagonal: number,
  candidateIndex: number,
  debug?: boolean,
): { score: number; breakdown?: CandidateScoreBreakdown } {
  const boxArea = box.width * box.height || 1;
  const inflated = inflateRect(box, 3);

  let obstacleScore = 0;
  const perObstacle: CandidateScoreBreakdown['perObstacle'] = [];

  for (const obs of obstacles) {
    const kind = 'kind' in obs ? (obs as PlacementObstacle).kind : 'mark';
    const overlap = overlapArea(inflated, obs);
    if (overlap > 0) {
      const weight = OBSTACLE_WEIGHTS[kind] ?? 8;
      const contribution = (weight * overlap) / boxArea;
      obstacleScore += contribution;
      if (debug) {
        perObstacle.push({ kind, overlap, contribution });
      }
    }
  }

  const outsideSvg = (W_SVG * areaOutside(box, svgRect)) / boxArea;
  const outsideChart = (W_CHART * areaOutside(box, chartArea) * 0.3) / boxArea;

  const nearestX = Math.max(box.x, Math.min(anchorX, box.x + box.width));
  const nearestY = Math.max(box.y, Math.min(anchorY, box.y + box.height));
  const dx = anchorX - nearestX;
  const dy = anchorY - nearestY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const distance = (W_DIST * dist) / (chartDiagonal || 1);

  const tiebreak = candidateIndex * EPSILON;
  const score = obstacleScore + outsideSvg + outsideChart + distance + tiebreak;

  if (debug) {
    return {
      score,
      breakdown: {
        direction: '',
        ring: 1,
        box,
        perObstacle,
        outsideSvg,
        outsideChart,
        distance,
        tiebreak,
        total: score,
      },
    };
  }

  return { score };
}

export interface PlacementResult {
  labelX: number;
  labelY: number;
  textAnchor: 'start' | 'middle' | 'end';
  bounds: Rect;
  score: number;
  debug?: CandidateScoreBreakdown[];
}

/**
 * Run the scored placement search for a single auto annotation.
 * Generates candidates around the anchor point, scores each, returns the best.
 */
export function findBestPlacement(
  anchorX: number,
  anchorY: number,
  text: string,
  style: { fontSize: number; fontWeight: number; lineHeight: number; fontFamily?: string },
  subtitleText: string | undefined,
  subtitleStyle:
    | { fontSize: number; fontWeight: number; lineHeight: number; fontFamily?: string }
    | undefined,
  obstacles: Rect[],
  chartArea: Rect,
  svgRect: Rect,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
  debug = false,
): PlacementResult {
  const isUpperHalf = anchorY < chartArea.y + chartArea.height / 2;
  const dirOrder = isUpperHalf ? UPPER_HALF_ORDER : LOWER_HALF_ORDER;
  const chartDiagonal = Math.sqrt(chartArea.width ** 2 + chartArea.height ** 2);

  // Compute box dimensions for candidate generation
  const sampleBounds = computeTextBlockBounds(
    0,
    style.fontSize,
    text,
    {
      ...style,
      textAnchor: 'start',
    },
    measure,
  );
  const boxHeight = sampleBounds.height;

  // Centering a `*-center` attach needs the width of the WHOLE block, not just
  // the primary line: a subtitle is often the wider of the two, and centering on
  // the primary width alone would leave a lede+subtitle stack visibly off-center
  // over its point.
  const subtitleSampleWidth =
    subtitleText && subtitleStyle
      ? computeTextBlockBounds(
          0,
          subtitleStyle.fontSize,
          subtitleText,
          { ...subtitleStyle, textAnchor: 'start' },
          measure,
        ).width
      : 0;
  const boxWidth = Math.max(sampleBounds.width, subtitleSampleWidth);

  // The innermost ring is the default setback for an auto-placed label, so it's
  // the same quantity ANCHOR_OFFSET expresses for the explicit path — keep them
  // as one constant. A 12px ring sat inside the standoff + marker-pullback
  // overhead, so an auto-placed label's connector was always shorter than
  // MIN_CONNECTOR_LENGTH and got suppressed: six bare callouts rendered as
  // floating text with no leader back to the data.
  const r1 = ANCHOR_OFFSET;
  const r2 = r1 + boxHeight + 8;
  const r3 = 2 * r2;

  let nextCandidateIdx = 0;

  function generateCandidates(radii: number[]): PlacementCandidate[] {
    const candidates: PlacementCandidate[] = [];

    for (const radius of radii) {
      const ring = radius === r1 ? 1 : radius === r2 ? 2 : 3;
      for (const di of dirOrder) {
        const dir = DIRECTIONS[di];
        const attachPt = computeAttachmentPoint(anchorX, anchorY, dir, radius);
        const { labelX, labelY } = labelPositionFromAttachment(
          attachPt,
          dir,
          boxHeight,
          style.fontSize,
          boxWidth,
        );

        let box = computeTextBlockBounds(
          labelX,
          labelY,
          text,
          {
            ...style,
            textAnchor: dir.textAnchor,
          },
          measure,
        );

        // Union with subtitle bounds if present
        if (subtitleText && subtitleStyle) {
          const primaryLineCount = text.split('\n').length;
          const subtitleY = labelY + style.fontSize * style.lineHeight * primaryLineCount + 2;
          const subBounds = computeTextBlockBounds(
            labelX,
            subtitleY,
            subtitleText,
            {
              ...subtitleStyle,
              textAnchor: dir.textAnchor,
            },
            measure,
          );
          box = unionRects(box, subBounds);
        }

        const idx = nextCandidateIdx++;
        const { score } = scoreCandidate(
          box,
          obstacles,
          svgRect,
          chartArea,
          anchorX,
          anchorY,
          chartDiagonal,
          idx,
        );

        candidates.push({
          labelX,
          labelY,
          textAnchor: dir.textAnchor,
          box,
          directionIndex: di,
          ring: ring as 1 | 2 | 3,
          score,
          candidateIdx: idx,
        });
      }
    }

    return candidates;
  }

  // Ring 1 + Ring 2 (16 candidates)
  let candidates = generateCandidates([r1, r2]);
  let best = candidates.reduce((a, b) => (a.score <= b.score ? a : b));

  // Ring 3 if no clean placement found
  if (best.score > CLEAN_THRESHOLD) {
    const ring3 = generateCandidates([r3]);
    candidates = [...candidates, ...ring3];
    best = candidates.reduce((a, b) => (a.score <= b.score ? a : b));
  }

  let debugBreakdowns: CandidateScoreBreakdown[] | undefined;
  if (debug) {
    const dirNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    debugBreakdowns = candidates.map((c) => {
      const { breakdown } = scoreCandidate(
        c.box,
        obstacles,
        svgRect,
        chartArea,
        anchorX,
        anchorY,
        chartDiagonal,
        c.candidateIdx,
        true,
      );
      return {
        ...breakdown!,
        direction: dirNames[c.directionIndex],
        ring: c.ring,
      };
    });
  }

  return {
    labelX: best.labelX,
    labelY: best.labelY,
    textAnchor: best.textAnchor,
    bounds: best.box,
    score: best.score,
    debug: debugBreakdowns,
  };
}

/** Check if an annotation should use the placement search (pure-auto, non-drop-line). */
export function isAutoPlacement(annotation: {
  anchor?: string;
  offset?: { dx?: number; dy?: number };
  connector?: string | boolean | { type?: string };
}): boolean {
  if (annotation.offset) return false;
  if (annotation.anchor && annotation.anchor !== 'auto') return false;
  if (annotation.connector === 'drop-line') return false;
  if (
    typeof annotation.connector === 'object' &&
    annotation.connector !== null &&
    annotation.connector.type === 'drop-line'
  )
    return false;
  return true;
}

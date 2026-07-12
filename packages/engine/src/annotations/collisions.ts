/**
 * Collision avoidance for annotations: nudging away from obstacles,
 * resolving annotation-to-annotation overlaps, and clamping to SVG bounds.
 */

import type {
  Rect,
  ResolvedAnnotation,
  ResolvedLabel,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { detectCollision } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import { CLAMP_MARGIN, NUDGE_PADDING } from './constants';
import {
  type AnnotationMeasureTextFn,
  computeTextBlockBounds,
  estimateLabelBounds,
  heuristicMeasure,
  refreshConnector,
  unionRects,
} from './geometry';
import { resolvePosition } from './position';
import { markerClearance } from './resolve-text';

/** The full block an annotation occupies: label text plus its subtitle. */
function annotationBlockBounds(
  annotation: ResolvedAnnotation,
  label: ResolvedLabel,
  measure: AnnotationMeasureTextFn,
): Rect {
  const labelBounds = estimateLabelBounds(label, measure);
  const sub = annotation.subtitle;
  if (!sub) return labelBounds;

  const subBounds = computeTextBlockBounds(
    sub.x,
    sub.y,
    sub.text,
    {
      fontSize: sub.style.fontSize ?? 10,
      fontWeight: Number(sub.style.fontWeight) || 400,
      lineHeight: sub.style.lineHeight ?? 1.3,
      textAnchor: sub.style.textAnchor ?? 'start',
    },
    measure,
  );
  return unionRects(labelBounds, subBounds);
}

/**
 * Move an annotation's label (and its subtitle, which carries absolute
 * coordinates) by (dx, dy), refreshing the connector and both bounds caches.
 */
function shiftAnnotation(
  annotation: ResolvedAnnotation,
  label: ResolvedLabel,
  dx: number,
  dy: number,
  measure: AnnotationMeasureTextFn,
): void {
  const movedLabel: ResolvedLabel = { ...label, x: label.x + dx, y: label.y + dy };
  if (annotation.subtitle) {
    annotation.subtitle = {
      ...annotation.subtitle,
      x: annotation.subtitle.x + dx,
      y: annotation.subtitle.y + dy,
    };
  }

  movedLabel.bounds = estimateLabelBounds(movedLabel, measure);
  const blockBounds = annotationBlockBounds(annotation, movedLabel, measure);

  if (movedLabel.connector) {
    movedLabel.connector = refreshConnector(
      movedLabel.connector,
      blockBounds,
      markerClearance(annotation.dot),
    );
  }

  annotation.label = movedLabel;
  annotation.bounds = blockBounds;
}

/**
 * Generate candidate displacement vectors to move `selfBounds` clear of each
 * obstacle in 4 directions (below, above, left, right), sorted by smallest
 * movement first.
 */
export function generateNudgeCandidates(
  selfBounds: Rect,
  obstacles: Rect[],
  padding: number,
): { dx: number; dy: number; distance: number }[] {
  const candidates: { dx: number; dy: number; distance: number }[] = [];

  for (const obs of obstacles) {
    // Below: shift self so its top edge clears the obstacle bottom
    const belowDy = obs.y + obs.height + padding - selfBounds.y;
    candidates.push({ dx: 0, dy: belowDy, distance: Math.abs(belowDy) });

    // Above: shift self so its bottom edge clears the obstacle top
    const aboveDy = obs.y - padding - (selfBounds.y + selfBounds.height);
    candidates.push({ dx: 0, dy: aboveDy, distance: Math.abs(aboveDy) });

    // Left: shift self so its right edge clears the obstacle left
    const leftDx = obs.x - padding - (selfBounds.x + selfBounds.width);
    candidates.push({ dx: leftDx, dy: 0, distance: Math.abs(leftDx) });

    // Right: shift self so its left edge clears the obstacle right
    const rightDx = obs.x + obs.width + padding - selfBounds.x;
    candidates.push({ dx: rightDx, dy: 0, distance: Math.abs(rightDx) });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/**
 * Try to reposition a text annotation to avoid overlapping with obstacle rects
 * (legend bounds, etc.). First tries standard anchor alternatives, then
 * calculates specific offsets needed to clear obstacles. Returns true if moved.
 */
export function nudgeAnnotationFromObstacles(
  annotation: ResolvedAnnotation,
  originalAnnotation: TextAnnotation,
  scales: ResolvedScales,
  chartArea: Rect,
  obstacles: Rect[],
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): boolean {
  if (annotation.type !== 'text' || !annotation.label) return false;

  const label = annotation.label;
  const bounds = annotation.bounds ?? annotationBlockBounds(annotation, label, measure);
  const collidingObs = obstacles.filter(
    (obs) => obs.width > 0 && obs.height > 0 && detectCollision(bounds, obs),
  );

  if (collidingObs.length === 0) return false;

  // Resolve the data point pixel position for offset calculations
  const px = resolvePosition(originalAnnotation.x, scales.x);
  const py = resolvePosition(originalAnnotation.y, scales.y);
  if (px === null || py === null) return false;

  const candidates = generateNudgeCandidates(bounds, collidingObs, NUDGE_PADDING);
  const fontSize = bounds.height / Math.max(1, label.text.split('\n').length);

  for (const { dx, dy } of candidates) {
    const candidateBounds: Rect = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };

    // Check no collisions with any obstacle
    const stillCollides = obstacles.some(
      (obs) => obs.width > 0 && obs.height > 0 && detectCollision(candidateBounds, obs),
    );
    if (stillCollides) continue;

    // Annotations render outside the clip path, so they can extend into margins.
    // Only check that the label center is reasonably within the chart and that
    // the text doesn't go completely off-screen.
    const labelCenterX = candidateBounds.x + candidateBounds.width / 2;
    const labelCenterY = candidateBounds.y + candidateBounds.height / 2;
    // Allow nudged labels to extend into the chrome region below the chart
    // (source/footer area) since annotations near the bottom edge often
    // need to shift into that space to avoid marks or the brand watermark.
    const inBounds =
      labelCenterX >= chartArea.x &&
      labelCenterX <= chartArea.x + chartArea.width + 10 &&
      labelCenterY >= chartArea.y - fontSize &&
      labelCenterY <= chartArea.y + chartArea.height + fontSize * 3;

    if (inBounds) {
      shiftAnnotation(annotation, label, dx, dy, measure);
      return true;
    }
  }

  return false;
}

/**
 * Resolve collisions between text annotation labels using a greedy algorithm.
 *
 * Iterates through text annotations in order, building a list of "placed"
 * bounding rects. When a later annotation overlaps an already-placed one,
 * it tries offset positions (below, above, left, right) to find a
 * non-colliding spot. Recomputes the connector after nudging.
 */
export function resolveAnnotationCollisions(
  annotations: ResolvedAnnotation[],
  originalSpecs: NormalizedChartSpec['annotations'],
  scales: ResolvedScales,
  chartArea: Rect,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): void {
  const placedBounds: Rect[] = [];

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (annotation.type !== 'text' || !annotation.label) {
      continue;
    }

    const label = annotation.label;
    const bounds = annotation.bounds ?? annotationBlockBounds(annotation, label, measure);

    // Check against all previously placed annotation blocks
    const collidingBounds = placedBounds.filter(
      (pb) => pb.width > 0 && pb.height > 0 && detectCollision(bounds, pb),
    );

    if (collidingBounds.length > 0) {
      // Find the original spec to get data point coordinates for connector recomputation
      const originalSpec = originalSpecs[i];

      if (originalSpec?.type === 'text') {
        const px = resolvePosition(originalSpec.x, scales.x);
        const py = resolvePosition(originalSpec.y, scales.y);

        if (px !== null && py !== null) {
          const candidates = generateNudgeCandidates(bounds, collidingBounds, NUDGE_PADDING);
          const fontSize = bounds.height / Math.max(1, label.text.split('\n').length);

          for (const { dx, dy } of candidates) {
            const candidateBounds: Rect = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };

            // Check no collisions with any placed block
            const stillCollides = placedBounds.some(
              (pb) => pb.width > 0 && pb.height > 0 && detectCollision(candidateBounds, pb),
            );
            if (stillCollides) continue;

            // Check the label center stays reasonably in bounds
            const labelCenterX = candidateBounds.x + candidateBounds.width / 2;
            const labelCenterY = candidateBounds.y + candidateBounds.height / 2;
            const inBounds =
              labelCenterX >= chartArea.x &&
              labelCenterX <= chartArea.x + chartArea.width + 10 &&
              labelCenterY >= chartArea.y - fontSize &&
              labelCenterY <= chartArea.y + chartArea.height + fontSize;

            if (inBounds) {
              shiftAnnotation(annotation, label, dx, dy, measure);
              break;
            }
          }
        }
      }
    }

    // Add this annotation's final bounds to the placed list
    placedBounds.push(
      annotation.bounds ?? annotationBlockBounds(annotation, annotation.label, measure),
    );
  }
}

/**
 * Shift text annotation labels so they stay within the total SVG bounds.
 * If a label overflows the right, left, top, or bottom edge, its position
 * is adjusted inward by the overflow amount. Connector geometry is updated
 * to match.
 */
export function clampAnnotationsToBounds(
  annotations: ResolvedAnnotation[],
  svgWidth: number,
  svgHeight: number,
  measure: AnnotationMeasureTextFn = heuristicMeasure,
): void {
  for (const annotation of annotations) {
    if (annotation.type !== 'text' || !annotation.label) continue;

    const label = annotation.label;
    const bounds = annotation.bounds ?? annotationBlockBounds(annotation, label, measure);
    let dx = 0;
    let dy = 0;

    // Right overflow
    if (bounds.x + bounds.width > svgWidth - CLAMP_MARGIN) {
      dx = svgWidth - CLAMP_MARGIN - (bounds.x + bounds.width);
    }
    // Left overflow
    if (bounds.x + dx < CLAMP_MARGIN) {
      dx = CLAMP_MARGIN - bounds.x;
    }
    // Top overflow
    if (bounds.y < CLAMP_MARGIN) {
      dy = CLAMP_MARGIN - bounds.y;
    }
    // Bottom overflow
    if (bounds.y + bounds.height + dy > svgHeight - CLAMP_MARGIN) {
      dy = svgHeight - CLAMP_MARGIN - (bounds.y + bounds.height);
    }

    if (dx === 0 && dy === 0) continue;

    shiftAnnotation(annotation, label, dx, dy, measure);
  }
}

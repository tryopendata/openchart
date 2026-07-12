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
import {
  CLAMP_MARGIN,
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  NUDGE_PADDING,
  SUBTITLE_FONT_WEIGHT,
  subtitleFontSize,
} from './constants';
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
      // Every resolver stamps all three, so these fallbacks are unreachable today.
      // They still come from the constants: a hand-rolled `?? 10` here is a second
      // definition of the subtitle's type, free to drift from the real one.
      fontSize: sub.style.fontSize ?? subtitleFontSize(DEFAULT_ANNOTATION_FONT_SIZE),
      fontWeight: Number(sub.style.fontWeight) || SUBTITLE_FONT_WEIGHT,
      lineHeight: sub.style.lineHeight ?? DEFAULT_LINE_HEIGHT,
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

  // A guard, not an input: the nudge geometry below comes from `bounds` and
  // `connector.endpoint`, not from the data point. But an annotation whose
  // position no longer resolves has nothing to anchor a connector to, so refuse
  // to move it rather than shift a label away from a point we can't locate.
  if (
    resolvePosition(originalAnnotation.x, scales.x) === null ||
    resolvePosition(originalAnnotation.y, scales.y) === null
  ) {
    return false;
  }

  const candidates = generateNudgeCandidates(bounds, collidingObs, NUDGE_PADDING);
  // Read the size off the label, don't back-derive it from the box: `bounds` is
  // the label ∪ subtitle union, so dividing its height by the *primary* line
  // count returns roughly double the real size on a subtitled annotation, which
  // silently doubles the margin slop below.
  const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;

  // A drop-line is a vertical rule running DOWN from the block to the point. Nudge
  // the block below its own endpoint and the line inverts: it points up, away from
  // the data, and the block covers the mark it was labelling. The resolver already
  // placed it (side auto-flip, clamp against the chart top), so the only nudges
  // worth taking are ones that keep it overhead.
  const dropLineEndpointY =
    label.connector?.style === 'drop-line' ? label.connector.endpoint?.y : undefined;

  for (const { dx, dy } of candidates) {
    const candidateBounds: Rect = { ...bounds, x: bounds.x + dx, y: bounds.y + dy };

    if (
      dropLineEndpointY !== undefined &&
      candidateBounds.y + candidateBounds.height > dropLineEndpointY
    ) {
      continue;
    }

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
      // `annotations` is a filtered view of `originalSpecs` -- an annotation that
      // failed to resolve was dropped -- so index by the stamped spec index, not
      // by position here. Falling back to `i` keeps a hand-built layout working.
      const originalSpec = originalSpecs[annotation.specIndex ?? i];

      if (originalSpec?.type === 'text') {
        // A guard, not an input: same as in nudgeAnnotationFromObstacles, the
        // geometry below comes from `bounds` and `connector.endpoint`. Refuse to
        // move a label whose data point we can no longer locate.
        const px = resolvePosition(originalSpec.x, scales.x);
        const py = resolvePosition(originalSpec.y, scales.y);

        if (px !== null && py !== null) {
          const candidates = generateNudgeCandidates(bounds, collidingBounds, NUDGE_PADDING);
          // Read the size off the label, don't back-derive it from the box: `bounds` is
          // the label ∪ subtitle union, so dividing its height by the *primary* line
          // count returns roughly double the real size on a subtitled annotation, which
          // silently doubles the margin slop below.
          const fontSize = label.style.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE;

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

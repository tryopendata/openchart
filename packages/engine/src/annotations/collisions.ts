/**
 * Collision avoidance for annotations: nudging away from obstacles,
 * resolving annotation-to-annotation overlaps, and clamping to SVG bounds.
 */

import type { Rect, ResolvedAnnotation, TextAnnotation } from '@opendata-ai/openchart-core';
import { detectCollision } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import { CLAMP_MARGIN, DEFAULT_ANNOTATION_FONT_SIZE, NUDGE_PADDING } from './constants';
import { type AnnotationMeasureTextFn, heuristicMeasure } from './geometry';
import { annotationBlockBounds, moveAnnotationBy } from './move';
import { isAutoPlacement } from './placement';
import { resolvePosition } from './position';

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
 * Did the author hand-place this block?
 *
 * A hand-placed block goes exactly where it was put, and the automatic passes keep
 * their hands off it. Without that, the obstacle pass overrides the author: on a line
 * chart the polyline is one long obstacle, so `dy: -10` moved a block by ZERO pixels
 * while `dy: -15` teleported it 56px. Same knob, no monotonicity -- unaimable.
 *
 * `isAutoPlacement` is the ONLY definition of "did the author place this". It already
 * decides which resolve path an annotation takes, and a non-zero `offset` disqualifies
 * the scored search there, so an offset ALWAYS means hand-placed -- with or without an
 * `anchor`. A second, subtly different rule here (an earlier version of this function
 * additionally demanded an `anchor`) does not create a second tier of annotation; it
 * just disagrees with the function that actually routed the thing, and the disagreement
 * shows up as an un-aimable offset on exactly the annotations the extra condition
 * excluded.
 *
 * `offset: { dx: 0 }` is not an instruction, just the default spelled out, so it does
 * not count -- matching `applyOffset`, which is likewise a no-op for it.
 */
function hasExplicitOffset(annotation: TextAnnotation): boolean {
  const moved = (annotation.offset?.dx ?? 0) !== 0 || (annotation.offset?.dy ?? 0) !== 0;
  return moved && !isAutoPlacement(annotation);
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

  // An `offset` is the author stating where the block goes. Auto-avoidance is for
  // annotations that didn't say. Nudging one anyway makes the offset behave like a
  // suggestion the engine is free to ignore: on a line chart the polyline is one
  // long obstacle, so `dy: -10` moved a right-anchored block by *zero* pixels and
  // `dy: -15` teleported it 56px. Same knob, no monotonicity -- unauthorable.
  if (hasExplicitOffset(originalAnnotation)) return false;

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
      moveAnnotationBy(annotation, label, dx, dy, measure);
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
  /**
   * Predicate on the index into `annotations`: true for an auto-placed entry.
   *
   * The scored placement pass already positioned those to avoid everything, so
   * they must not be nudged again — but they still occupy space, so they stay in
   * `placedBounds` and the explicit annotations avoid them. Callers pass the full
   * annotation list; nobody hand-builds a filtered copy, because a second
   * representation of the list is what breaks `specIndex` lookups.
   */
  isAutoPlaced?: (index: number) => boolean,
): void {
  /** Immovable here: sited by the scored search, or hand-placed by the author. */
  const isPinned = (annotation: ResolvedAnnotation, i: number): boolean => {
    if (isAutoPlaced?.(i)) return true;
    // `annotations` is a filtered view of `originalSpecs` -- an annotation that
    // failed to resolve was dropped -- so index by the stamped spec index, not
    // by position here. Falling back to `i` keeps a hand-built layout working.
    const spec = originalSpecs[annotation.specIndex ?? i];
    return spec?.type === 'text' && hasExplicitOffset(spec);
  };

  const isText = (a: ResolvedAnnotation) => a.type === 'text' && !!a.label;

  // Seed with EVERY pinned block before nudging anything.
  //
  // This used to be one forward sweep that pushed a pinned block's bounds when it
  // reached it. That only lets annotations authored *after* a pinned one route
  // around it -- everything earlier was nudged against a `placedBounds` that did not
  // contain it yet, so "the pinned block claims its space" held or failed purely on
  // spec order, and two callouts on the same point printed on top of each other when
  // the pinned one happened to be listed second.
  const placedBounds: Rect[] = [];
  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (!isText(annotation) || !isPinned(annotation, i)) continue;
    placedBounds.push(
      annotation.bounds ?? annotationBlockBounds(annotation, annotation.label!, measure),
    );
  }

  for (let i = 0; i < annotations.length; i++) {
    const annotation = annotations[i];
    if (!isText(annotation) || isPinned(annotation, i)) continue;

    const label = annotation.label!;
    const bounds = annotation.bounds ?? annotationBlockBounds(annotation, label, measure);
    const originalSpec = originalSpecs[annotation.specIndex ?? i];

    // Check against all previously placed annotation blocks
    const collidingBounds = placedBounds.filter(
      (pb) => pb.width > 0 && pb.height > 0 && detectCollision(bounds, pb),
    );

    if (collidingBounds.length > 0) {
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
              moveAnnotationBy(annotation, label, dx, dy, measure);
              break;
            }
          }
        }
      }
    }

    // Add this annotation's final bounds to the placed list
    placedBounds.push(annotation.bounds ?? annotationBlockBounds(annotation, label, measure));
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

    moveAnnotationBy(annotation, label, dx, dy, measure);
  }
}

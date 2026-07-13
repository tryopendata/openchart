/**
 * The single owner of "where a resolved annotation sits".
 *
 * WHY THIS MODULE EXISTS
 *
 * An annotation's position is not one number, it's five that have to agree: the
 * label origin, the subtitle origin (absolute, not relative), the label-only
 * bounds, the label-union-subtitle block bounds, and the connector endpoints. The
 * resolver establishes that agreement -- and then FOUR later passes re-position
 * the block (obstacle nudge, mutual-collision nudge, clamp-to-bounds, and the
 * auto-placement search). Every one of them has to re-establish all five.
 *
 * When two of those passes each did their own arithmetic, the two copies drifted:
 * one spelled the subtitle gap `SUBTITLE_GAP`, the other spelled it `+ 2`, and a
 * subtitled auto-placed callout rendered its second line 3px off from where the
 * search had scored it. That is the bug this module exists to make unrepresentable.
 *
 * So: nothing outside this file writes annotation geometry. `moveAnnotationTo`
 * (absolute) and `moveAnnotationBy` (delta) are the only doors, and they always
 * leave all five in agreement.
 */

import type { Rect, ResolvedAnnotation, ResolvedLabel } from '@opendata-ai/openchart-core';
import {
  DEFAULT_ANNOTATION_FONT_SIZE,
  DEFAULT_LINE_HEIGHT,
  SUBTITLE_FONT_WEIGHT,
  subtitleFontSize,
} from './constants';
import {
  type AnnotationMeasureTextFn,
  computeTextBlockBounds,
  estimateLabelBounds,
  refreshConnector,
  unionRects,
} from './geometry';
import { markerClearance } from './resolve-text';

/**
 * The full block an annotation occupies: label text plus its subtitle.
 *
 * This is the box other annotations must avoid, and the box the connector exits.
 * It is NOT `label.bounds` -- that one is label-only by contract, because the
 * renderer sizes the `background` plate from it and a subtitled annotation must
 * not get a plate sized to both lines.
 */
export function annotationBlockBounds(
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
 * Put a resolved annotation's block at an absolute origin, keeping every piece of
 * its geometry in agreement.
 *
 * The subtitle is TRANSLATED with the label rather than re-derived from a font-metric
 * sum: the resolver already placed it correctly relative to the label, and a second
 * derivation here is a second chance to disagree with the first.
 *
 * `textAnchor` is optional because only the auto-placement search chooses a side;
 * the nudge passes slide a block that has already picked one.
 */
export function moveAnnotationTo(
  annotation: ResolvedAnnotation,
  label: ResolvedLabel,
  x: number,
  y: number,
  measure: AnnotationMeasureTextFn,
  textAnchor?: 'start' | 'middle' | 'end',
): void {
  moveAnnotationBy(annotation, label, x - label.x, y - label.y, measure, textAnchor);
}

/**
 * Slide a resolved annotation's block by (dx, dy), keeping every piece of its
 * geometry in agreement. See `moveAnnotationTo`.
 */
export function moveAnnotationBy(
  annotation: ResolvedAnnotation,
  label: ResolvedLabel,
  dx: number,
  dy: number,
  measure: AnnotationMeasureTextFn,
  textAnchor?: 'start' | 'middle' | 'end',
): void {
  const movedLabel: ResolvedLabel = { ...label, x: label.x + dx, y: label.y + dy };
  if (textAnchor) {
    movedLabel.style = { ...movedLabel.style, textAnchor };
  }

  if (annotation.subtitle) {
    annotation.subtitle = {
      ...annotation.subtitle,
      x: annotation.subtitle.x + dx,
      y: annotation.subtitle.y + dy,
      ...(textAnchor ? { style: { ...annotation.subtitle.style, textAnchor } } : {}),
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

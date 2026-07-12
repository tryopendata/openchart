/**
 * Annotation auto-thinning: demotes text annotations that can't fit without
 * overlap to numbered dot markers with footnote text below the chart.
 *
 * Single deterministic pass: run collision resolution once at the full chart
 * area, then greedily place by priority. A candidate is demoted when it either
 * overlaps an already-placed label or escapes the plot area. No iterative
 * layout convergence.
 */

import type {
  Annotation,
  AnnotationFootnote,
  Rect,
  ResolvedAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { detectCollision } from '@opendata-ai/openchart-core';
import { type AnnotationMeasureTextFn, estimateLabelBounds } from './geometry';

export interface ThinningResult {
  annotations: ResolvedAnnotation[];
  footnotes: AnnotationFootnote[];
}

/**
 * Apply auto-thinning to resolved annotations. Text annotations that still
 * overlap after collision resolution are demoted to footnote markers.
 *
 * Priority ordering: annotations with lower `priority` values are kept in
 * place first. When priority is equal (or omitted), spec order wins (earlier
 * annotations are kept). Non-text annotations are never thinned.
 *
 * Explicit `responsive: false` on an annotation exempts it from thinning
 * (it is always placed first and never demoted).
 *
 * @param annotations - Resolved annotations (text + range + refline, in spec order
 *   minus any that were skipped by `computeAnnotations`).
 * @param specs - The full spec annotations array, index-aligned with `annotations`.
 *   Non-text specs are ignored; text specs provide `priority` and `responsive`.
 * @param plotArea - The plot rect. Candidates whose label doesn't fit inside it are
 *   demoted: at narrow widths labels spread across different y positions never
 *   pairwise-collide, so collision alone would leave them inline and overflowing.
 *   Omit to skip the containment test.
 */
export function thinAnnotations(
  annotations: ResolvedAnnotation[],
  specs: Annotation[],
  measure: AnnotationMeasureTextFn,
  plotArea?: Rect,
): ThinningResult {
  if (annotations.length <= 1) {
    return { annotations, footnotes: [] };
  }

  // Build index pairs: (resolved, spec, original index).
  // Only text specs carry priority/responsive; non-text specs are ignored.
  const entries = annotations.map((a, i) => ({
    resolved: a,
    spec: i < specs.length && specs[i].type === 'text' ? (specs[i] as TextAnnotation) : undefined,
    index: i,
  }));

  // Separate pinned (responsive: false) from candidates
  const pinned: typeof entries = [];
  const candidates: typeof entries = [];
  for (const entry of entries) {
    if (entry.resolved.type !== 'text' || !entry.resolved.label) {
      pinned.push(entry);
    } else if (entry.spec?.responsive === false) {
      pinned.push(entry);
    } else {
      candidates.push(entry);
    }
  }

  // Sort candidates by priority (lower first), then by spec order
  candidates.sort((a, b) => {
    const pa = a.spec?.priority ?? Number.MAX_SAFE_INTEGER;
    const pb = b.spec?.priority ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.index - b.index;
  });

  // Place pinned annotations first (they're always kept)
  const placedBounds: Rect[] = [];
  for (const entry of pinned) {
    if (entry.resolved.type === 'text' && entry.resolved.label) {
      const bounds = entry.resolved.bounds ?? estimateLabelBounds(entry.resolved.label, measure);
      placedBounds.push(bounds);
    }
  }

  // Greedily place candidates; demote overlapping ones to footnotes
  const footnotes: AnnotationFootnote[] = [];

  for (const entry of candidates) {
    const bounds = entry.resolved.bounds ?? estimateLabelBounds(entry.resolved.label!, measure);

    if (bounds.width <= 0 || bounds.height <= 0) {
      placedBounds.push(bounds);
      continue;
    }

    const overlaps = placedBounds.some(
      (pb) => pb.width > 0 && pb.height > 0 && detectCollision(bounds, pb),
    );

    if (overlaps || !fitsWithin(bounds, plotArea)) {
      const footnoteIndex = footnotes.length + 1;
      footnotes.push({
        index: footnoteIndex,
        text: entry.resolved.label!.text,
      });
      entry.resolved.footnoteIndex = footnoteIndex;
    } else {
      placedBounds.push(bounds);
    }
  }

  return { annotations, footnotes };
}

/**
 * Whether a label's bounds sit entirely inside the plot. No plot area means no
 * containment constraint, so everything fits.
 */
function fitsWithin(bounds: Rect, plotArea: Rect | undefined): boolean {
  if (!plotArea || plotArea.width <= 0 || plotArea.height <= 0) return true;
  return (
    bounds.x >= plotArea.x &&
    bounds.y >= plotArea.y &&
    bounds.x + bounds.width <= plotArea.x + plotArea.width &&
    bounds.y + bounds.height <= plotArea.y + plotArea.height
  );
}

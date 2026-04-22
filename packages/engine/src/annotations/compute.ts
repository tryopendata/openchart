/**
 * Annotation computation: converts spec-level annotations to pixel-positioned
 * ResolvedAnnotation objects using the resolved scales.
 *
 * Handles three annotation types:
 * - text: positioned at a data coordinate with an optional callout
 * - range: a highlighted rectangle between two data values
 * - refline: a horizontal or vertical reference line at a data value
 *
 * Supports fine-grained positioning via offset, anchor, connector, and zIndex.
 * At compact breakpoints, annotations are simplified or hidden.
 */

import type { LayoutStrategy, Rect, ResolvedAnnotation } from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import {
  clampAnnotationsToBounds,
  nudgeAnnotationFromObstacles,
  resolveAnnotationCollisions,
} from './collisions';
import { resolveRangeAnnotation } from './resolve-range';
import { resolveRefLineAnnotation } from './resolve-refline';
import { resolveTextAnnotation } from './resolve-text';

/**
 * Compute resolved annotations from spec annotations using the resolved scales.
 *
 * Converts data-coordinate annotations to pixel-positioned ResolvedAnnotation
 * objects. Supports offset, anchor, connector, and zIndex. At compact
 * breakpoints, annotations are hidden (strategy says "tooltip-only").
 *
 * When obstacle rects are provided (e.g. legend bounds), text annotations
 * that overlap with them are automatically repositioned using alternate
 * anchor directions. After individual obstacle avoidance, annotation-to-
 * annotation collisions are resolved using a greedy placement algorithm.
 * Finally, labels are clamped to stay within the total SVG bounds.
 */
export function computeAnnotations(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  isDark = false,
  obstacles: Rect[] = [],
  svgDimensions?: { width: number; height: number },
): ResolvedAnnotation[] {
  const isCompact = strategy.annotationPosition === 'tooltip-only';

  const annotations: ResolvedAnnotation[] = [];

  for (const annotation of spec.annotations) {
    // At compact breakpoints, skip annotations unless they opt out with responsive: false
    if (isCompact && annotation.responsive !== false) {
      continue;
    }
    let resolved: ResolvedAnnotation | null = null;

    switch (annotation.type) {
      case 'text':
        resolved = resolveTextAnnotation(annotation, scales, chartArea, isDark);
        break;
      case 'range':
        resolved = resolveRangeAnnotation(annotation, scales, chartArea, isDark);
        break;
      case 'refline':
        resolved = resolveRefLineAnnotation(annotation, scales, chartArea, isDark);
        break;
    }

    if (resolved) {
      // For text annotations, check for collisions with obstacles and nudge if needed
      if (annotation.type === 'text' && obstacles.length > 0) {
        nudgeAnnotationFromObstacles(resolved, annotation, scales, chartArea, obstacles);
      }
      annotations.push(resolved);
    }
  }

  // Resolve annotation-to-annotation collisions (greedy, order-preserving)
  resolveAnnotationCollisions(annotations, spec.annotations, scales, chartArea);

  // Clamp labels that overflow the SVG boundary back inside
  if (svgDimensions) {
    clampAnnotationsToBounds(annotations, svgDimensions.width, svgDimensions.height);
  }

  // Sort by zIndex (lower first, undefined treated as 0)
  annotations.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return annotations;
}

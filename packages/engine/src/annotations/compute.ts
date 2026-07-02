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

import type {
  LayoutStrategy,
  Rect,
  ResolvedAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import type { NormalizedChartSpec } from '../compiler/types';
import type { ResolvedScales } from '../layout/scales';
import {
  clampAnnotationsToBounds,
  nudgeAnnotationFromObstacles,
  resolveAnnotationCollisions,
} from './collisions';
import type { AnnotationMeasureTextFn } from './geometry';
import { heuristicMeasure } from './geometry';
import { findBestPlacement, isAutoPlacement } from './placement';
import { resolvePosition } from './position';
import { resolveRangeAnnotation } from './resolve-range';
import { resolveRefLineAnnotation } from './resolve-refline';
import { makeAnnotationLabelStyle, resolveTextAnnotation } from './resolve-text';

export interface AnnotationContext {
  scales: ResolvedScales;
  chartArea: Rect;
  strategy: LayoutStrategy;
  isDark: boolean;
  obstacles: Rect[];
  svg: { width: number; height: number };
  measure: AnnotationMeasureTextFn;
  debugPlacement?: boolean;
}

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
  ctx: AnnotationContext,
): ResolvedAnnotation[];

/**
 * @deprecated Use the context-object overload instead.
 */
export function computeAnnotations(
  spec: NormalizedChartSpec,
  scales: ResolvedScales,
  chartArea: Rect,
  strategy: LayoutStrategy,
  isDark?: boolean,
  obstacles?: Rect[],
  svgDimensions?: { width: number; height: number },
): ResolvedAnnotation[];

export function computeAnnotations(
  spec: NormalizedChartSpec,
  scalesOrCtx: ResolvedScales | AnnotationContext,
  chartArea?: Rect,
  strategy?: LayoutStrategy,
  isDark?: boolean,
  obstacles?: Rect[],
  svgDimensions?: { width: number; height: number },
): ResolvedAnnotation[] {
  let ctx: AnnotationContext;

  if ('scales' in scalesOrCtx && 'chartArea' in scalesOrCtx) {
    ctx = scalesOrCtx as AnnotationContext;
  } else {
    ctx = {
      scales: scalesOrCtx as ResolvedScales,
      chartArea: chartArea!,
      strategy: strategy!,
      isDark: isDark ?? false,
      obstacles: obstacles ?? [],
      svg: svgDimensions ?? { width: 0, height: 0 },
      measure: heuristicMeasure,
    };
  }

  const isCompact = ctx.strategy.annotationPosition === 'tooltip-only';

  const svgRect: Rect = { x: 0, y: 0, width: ctx.svg.width, height: ctx.svg.height };
  const annotations: ResolvedAnnotation[] = [];

  // Deferred auto-placement entries (resolved in Pass 2)
  const autoQueue: Array<{
    annotation: TextAnnotation;
    anchorX: number;
    anchorY: number;
    resolved: ResolvedAnnotation;
    index: number;
  }> = [];

  // ---- Pass 1: resolve explicit annotations and queue auto ones ----
  for (const annotation of spec.annotations) {
    if (isCompact && annotation.responsive !== false) {
      continue;
    }
    let resolved: ResolvedAnnotation | null = null;

    switch (annotation.type) {
      case 'text':
        resolved = resolveTextAnnotation(
          annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.isDark,
          ctx.measure,
        );
        if (resolved && ctx.svg.width > 0 && ctx.svg.height > 0 && isAutoPlacement(annotation)) {
          const px = resolvePosition(annotation.x, ctx.scales.x);
          const py = resolvePosition(annotation.y, ctx.scales.y);
          if (px !== null && py !== null) {
            autoQueue.push({
              annotation,
              anchorX: px,
              anchorY: py,
              resolved,
              index: annotations.length,
            });
            annotations.push(resolved);
            continue;
          }
        }
        break;
      case 'range':
        resolved = resolveRangeAnnotation(annotation, ctx.scales, ctx.chartArea, ctx.isDark);
        break;
      case 'refline':
        resolved = resolveRefLineAnnotation(annotation, ctx.scales, ctx.chartArea, ctx.isDark);
        break;
    }

    if (resolved) {
      if (annotation.type === 'text' && ctx.obstacles.length > 0) {
        nudgeAnnotationFromObstacles(
          resolved,
          annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.obstacles,
          ctx.measure,
        );
      }
      annotations.push(resolved);
    }
  }

  // ---- Pass 2: scored placement search for auto annotations ----
  if (autoQueue.length > 0 && ctx.svg.width > 0 && ctx.svg.height > 0) {
    // Build the working obstacle list: base obstacles + explicitly placed annotations
    const workingObstacles: Rect[] = [...ctx.obstacles];
    for (let i = 0; i < annotations.length; i++) {
      const a = annotations[i];
      if (a.bounds && !autoQueue.some((q) => q.index === i)) {
        workingObstacles.push({ ...a.bounds, kind: 'annotation' } as Rect);
      }
    }

    for (const entry of autoQueue) {
      const { annotation, anchorX, anchorY, resolved } = entry;
      const labelStyle = makeAnnotationLabelStyle(
        annotation.fontSize,
        annotation.fontWeight,
        undefined,
        ctx.isDark,
      );

      const subtitleStyle = annotation.subtitle
        ? {
            fontSize: labelStyle.fontSize * 0.85,
            fontWeight: 400,
            lineHeight: labelStyle.lineHeight,
          }
        : undefined;

      const result = findBestPlacement(
        anchorX,
        anchorY,
        annotation.text,
        {
          fontSize: labelStyle.fontSize,
          fontWeight: Number(labelStyle.fontWeight) || 400,
          lineHeight: labelStyle.lineHeight,
        },
        annotation.subtitle,
        subtitleStyle,
        workingObstacles,
        ctx.chartArea,
        svgRect,
        ctx.measure,
        ctx.debugPlacement,
      );

      // Apply placement result to the resolved annotation
      if (resolved.label) {
        resolved.label.x = result.labelX;
        resolved.label.y = result.labelY;
        resolved.label.style = {
          ...resolved.label.style,
          textAnchor: result.textAnchor,
        };
        resolved.label.bounds = result.bounds;

        // Update connector endpoint if present
        if (resolved.label.connector) {
          const box = result.bounds;
          const cx = box.x + box.width / 2;
          const cy = box.y + box.height / 2;
          const dx = anchorX - cx;
          const dy = anchorY - cy;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          let fromX: number;
          let fromY: number;
          if (absDx > absDy) {
            fromX = dx > 0 ? box.x + box.width : box.x;
            fromY = cy;
          } else {
            fromX = cx;
            fromY = dy > 0 ? box.y + box.height : box.y;
          }
          resolved.label.connector.from = { x: fromX, y: fromY };
        }
      }
      resolved.bounds = result.bounds;

      // Add this annotation's bounds as obstacle for subsequent auto annotations
      workingObstacles.push({ ...result.bounds, kind: 'annotation' } as Rect);
    }
  } else if (autoQueue.length > 0) {
    // Fallback: no SVG dimensions, use legacy nudge for auto annotations
    for (const entry of autoQueue) {
      if (ctx.obstacles.length > 0) {
        nudgeAnnotationFromObstacles(
          entry.resolved,
          entry.annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.obstacles,
          ctx.measure,
        );
      }
    }
  }

  // Resolve annotation-to-annotation collisions for non-auto-placed annotations.
  // When auto placement ran, those annotations already avoid each other via the
  // obstacle-accumulation loop above, so only explicitly placed ones need this.
  if (autoQueue.length > 0) {
    const explicitAnnotations = annotations.filter((_, i) => !autoQueue.some((q) => q.index === i));
    if (explicitAnnotations.length > 1) {
      const explicitSpecs = spec.annotations.filter(
        (a) => !(a.type === 'text' && isAutoPlacement(a)),
      );
      resolveAnnotationCollisions(
        explicitAnnotations,
        explicitSpecs,
        ctx.scales,
        ctx.chartArea,
        ctx.measure,
      );
    }
  } else {
    resolveAnnotationCollisions(
      annotations,
      spec.annotations,
      ctx.scales,
      ctx.chartArea,
      ctx.measure,
    );
  }

  // Clamp labels that overflow the SVG boundary back inside
  if (ctx.svg.width > 0 && ctx.svg.height > 0) {
    clampAnnotationsToBounds(annotations, ctx.svg.width, ctx.svg.height, ctx.measure);
  }

  // Sort by zIndex (lower first, undefined treated as 0)
  annotations.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return annotations;
}

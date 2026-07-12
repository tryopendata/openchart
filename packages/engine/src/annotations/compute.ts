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
import { SUBTITLE_FONT_WEIGHT, SUBTITLE_GAP, subtitleFontSize } from './constants';
import type { AnnotationMeasureTextFn } from './geometry';
import { computeTextBlockBounds, heuristicMeasure, refreshConnector } from './geometry';
import {
  findBestPlacement,
  isAutoPlacement,
  normalizeObstacles,
  type PlacementObstacle,
} from './placement';
import { resolvePosition } from './position';
import { resolveRangeAnnotation } from './resolve-range';
import { resolveRefLineAnnotation } from './resolve-refline';
import {
  makeAnnotationLabelStyle,
  markerClearance,
  resolveLedeFontWeight,
  resolveTextAnnotation,
} from './resolve-text';

export interface AnnotationContext {
  scales: ResolvedScales;
  chartArea: Rect;
  strategy: LayoutStrategy;
  isDark: boolean;
  obstacles: PlacementObstacle[];
  svg: { width: number; height: number };
  measure: AnnotationMeasureTextFn;
  /** Theme font stack, so annotation text is measured and rendered in the same face. */
  fontFamily?: string;
  debugPlacement?: boolean;
  /** When true, annotations that overlap are demoted to footnote markers instead of being hidden. */
  autoThin?: boolean;
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

  if ('measure' in scalesOrCtx) {
    ctx = scalesOrCtx as AnnotationContext;
  } else {
    ctx = {
      scales: scalesOrCtx as ResolvedScales,
      chartArea: chartArea!,
      strategy: strategy!,
      isDark: isDark ?? false,
      obstacles: obstacles ? normalizeObstacles(obstacles) : [],
      svg: svgDimensions ?? { width: 0, height: 0 },
      measure: heuristicMeasure,
    };
  }

  const isCompact = ctx.strategy.annotationPosition === 'tooltip-only' && !ctx.autoThin;

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
  for (const [specIndex, annotation] of spec.annotations.entries()) {
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
          ctx.fontFamily,
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
            // Same contract as the push below -- this branch `continue`s past it.
            resolved.specIndex = specIndex;
            annotations.push(resolved);
            continue;
          }
        }
        break;
      case 'range':
        resolved = resolveRangeAnnotation(
          annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.isDark,
          ctx.fontFamily,
        );
        break;
      case 'refline':
        resolved = resolveRefLineAnnotation(
          annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.isDark,
          ctx.fontFamily,
        );
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
      // The resolved array is filtered (an out-of-domain annotation resolves to
      // nothing), so carry the spec index along -- it's the only stable way back
      // to the authored annotation from here on.
      resolved.specIndex = specIndex;
      annotations.push(resolved);
    }
  }

  // ---- Pass 2: scored placement search for auto annotations ----
  if (autoQueue.length > 0 && ctx.svg.width > 0 && ctx.svg.height > 0) {
    // Build the working obstacle list: base obstacles + explicitly placed annotations
    const workingObstacles: PlacementObstacle[] = [...ctx.obstacles];
    for (let i = 0; i < annotations.length; i++) {
      const a = annotations[i];
      if (a.bounds && !autoQueue.some((q) => q.index === i)) {
        workingObstacles.push({ ...a.bounds, kind: 'annotation' } as PlacementObstacle);
      }
    }

    for (const entry of autoQueue) {
      const { annotation, anchorX, anchorY, resolved } = entry;
      // Must mirror resolveTextAnnotation exactly (lede weight, theme font):
      // findBestPlacement measures with this style, and the resolved annotation
      // renders with the other one. Any drift and the scored bounds are a lie.
      const labelStyle = makeAnnotationLabelStyle(
        annotation.fontSize,
        resolveLedeFontWeight(annotation),
        undefined,
        ctx.isDark,
        ctx.fontFamily,
      );

      const subtitleStyle = annotation.subtitle
        ? {
            fontSize: subtitleFontSize(labelStyle.fontSize),
            fontWeight: SUBTITLE_FONT_WEIGHT,
            lineHeight: labelStyle.lineHeight,
            fontFamily: labelStyle.fontFamily,
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
          fontFamily: labelStyle.fontFamily,
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
        // `result.bounds` is the UNION of the label and its subtitle — the box
        // placement scored, and the box other annotations must avoid. But
        // `label.bounds` is the label-only text box by contract (the renderer
        // sizes the `background` plate from it), so recompute it rather than
        // stamping the union in and handing a subtitled annotation a plate sized
        // to both lines. The union goes to `resolved.bounds` below.
        resolved.label.bounds = computeTextBlockBounds(
          result.labelX,
          result.labelY,
          annotation.text,
          { ...resolved.label.style, textAnchor: result.textAnchor },
          ctx.measure,
        );

        // The subtitle carries absolute coordinates, so it has to follow the
        // label. findBestPlacement scored the candidate with the subtitle in
        // exactly this spot, so the stamped result must land there too.
        if (resolved.subtitle) {
          const primaryLineCount = annotation.text.split('\n').length;
          const primaryFontSize = labelStyle.fontSize;
          resolved.subtitle.x = result.labelX;
          resolved.subtitle.y =
            result.labelY +
            primaryFontSize * labelStyle.lineHeight * primaryLineCount +
            SUBTITLE_GAP;
          resolved.subtitle.style = {
            ...resolved.subtitle.style,
            textAnchor: result.textAnchor,
          };
        }

        if (resolved.label.connector) {
          resolved.label.connector = refreshConnector(
            resolved.label.connector,
            result.bounds,
            markerClearance(resolved.dot),
          );
        }
      }
      resolved.bounds = result.bounds;

      // Add this annotation's bounds as obstacle for subsequent auto annotations
      workingObstacles.push({ ...result.bounds, kind: 'annotation' } as PlacementObstacle);
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
    // Build aligned pairs of explicit annotations + their specs
    const autoIndices = new Set(autoQueue.map((q) => q.index));
    const explicitAnnotations: ResolvedAnnotation[] = [];
    const explicitSpecs: NormalizedChartSpec['annotations'] = [];
    let specIdx = 0;
    for (let i = 0; i < annotations.length; i++) {
      // Walk specIdx past any compact-skipped specs
      while (specIdx < spec.annotations.length) {
        const s = spec.annotations[specIdx];
        if (!isCompact || s.responsive === false) break;
        specIdx++;
      }
      if (specIdx >= spec.annotations.length) break;
      if (autoIndices.has(i)) {
        specIdx++;
        continue;
      }
      explicitAnnotations.push(annotations[i]);
      explicitSpecs.push(spec.annotations[specIdx]);
      specIdx++;
    }
    if (explicitAnnotations.length > 1) {
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

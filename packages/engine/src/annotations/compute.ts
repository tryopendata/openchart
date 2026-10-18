import { ConnectorCrossings } from './connector-crossings';
import { rememberAnnotationGeometry } from './edit-context';
import {
  defaultReferenceContainer,
  NO_REFERENCE_RESERVE,
  placeReferenceLabel,
  type ReferenceLanes,
  type ReferenceReserve,
} from './reference-layout';
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
  nudgeRefLineLabel,
  resolveAnnotationCollisions,
} from './collisions';
import { DEFAULT_ANNOTATION_FONT_SIZE, SUBTITLE_FONT_WEIGHT, subtitleFontSize } from './constants';
import { type AnnotationMeasureTextFn, stopAtTargetLabel } from './geometry';
import { annotationBlockBounds, moveAnnotationTo } from './move';
import { findBestPlacement, isAutoPlacement, type PlacementObstacle } from './placement';
import { resolvePosition } from './position';
import { resolveRangeAnnotation } from './resolve-range';
import { resolveRefLineAnnotation } from './resolve-refline';
import {
  makeAnnotationLabelStyle,
  resolveLedeFontWeight,
  resolveTextAnnotation,
  textConnectorSeed,
} from './resolve-text';

export interface AnnotationContext {
  scales: ResolvedScales;
  chartArea: Rect;
  referenceContainer?: Rect;
  referenceLanes?: ReferenceLanes;
  /**
   * Outside reference lanes resolved by the figure budget, the only source of
   * the reserve. Without one, outside labels place inside the plot.
   */
  referenceReserve?: ReferenceReserve;
  strategy: LayoutStrategy;
  isDark: boolean;
  obstacles: PlacementObstacle[];
  svg: { width: number; height: number };
  measure: AnnotationMeasureTextFn;
  /** Theme font stack, so annotation text is measured and rendered in the same face. */
  fontFamily?: string;
  padding?: number;
  smallFontSize?: number;
  colors?: import('@opendata-ai/openchart-core').ThemeColors;
  debugPlacement?: boolean;
  onWarn?: (message: string) => void;
  /** When true, annotations that overlap are demoted to footnote markers instead of being hidden. */
  autoThin?: boolean;
  /**
   * First y an annotation label may occupy, in SVG coordinates. Callers pass
   * the bottom of the top chrome block so hand-placed callouts stay clear of
   * the title/subtitle. Defaults to the plain SVG clamp margin.
   */
  topBound?: number;
  /** Endpoint markers drawn on data points (see `adoptPointMarker`). */
  pointMarkers?: ReadonlyArray<{ x: number; y: number; fill: string; stroke: string }>;
}

/**
 * Default callout wrap width: up to 240px inside the padded plot, but never
 * narrower than about four ems, so a tiny plot does not stack one glyph per line.
 */
function defaultCalloutMaxWidth(annotation: TextAnnotation, ctx: AnnotationContext): number {
  const floor = (annotation.fontSize ?? DEFAULT_ANNOTATION_FONT_SIZE) * 4;
  return Math.max(floor, Math.min(240, ctx.chartArea.width - 2 * (ctx.padding ?? 16)));
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
/**
 * A default annotation dot on a point that already carries an endpoint marker
 * takes the marker's colors, so the two draw as one ring instead of two.
 */
function adoptPointMarker(
  dot: NonNullable<ResolvedAnnotation['dot']>,
  markers: AnnotationContext['pointMarkers'],
): void {
  const marker = markers?.find((m) => Math.abs(m.x - dot.x) < 0.5 && Math.abs(m.y - dot.y) < 0.5);
  if (!marker) return;
  dot.fill = marker.fill;
  dot.stroke = marker.stroke;
}

export function computeAnnotations(
  spec: NormalizedChartSpec,
  ctx: AnnotationContext,
): ResolvedAnnotation[] {
  const isCompact = ctx.strategy.annotationPosition === 'tooltip-only' && !ctx.autoThin;

  const svgRect: Rect = { x: 0, y: 0, width: ctx.svg.width, height: ctx.svg.height };
  const annotations: ResolvedAnnotation[] = [];
  const referenceReserve = ctx.referenceReserve ?? NO_REFERENCE_RESERVE;
  const referenceLanes: ReferenceLanes = ctx.referenceLanes ?? {};
  // Value labels a leader may run into on its way to its own data point.
  const dataLabels = ctx.obstacles.filter((obstacle) => obstacle.kind === 'data-label');

  // Deferred auto-placement entries (resolved in Pass 2)
  const autoQueue: Array<{
    annotation: TextAnnotation;
    anchorX: number;
    anchorY: number;
    resolved: ResolvedAnnotation;
    index: number;
  }> = [];

  // ---- Pass 1: resolve explicit annotations and queue auto ones ----
  for (const [specIndex, sourceAnnotation] of spec.annotations.entries()) {
    const annotation =
      sourceAnnotation.type === 'text'
        ? {
            ...sourceAnnotation,
            maxWidth:
              sourceAnnotation.maxWidth === undefined
                ? defaultCalloutMaxWidth(sourceAnnotation, ctx)
                : sourceAnnotation.maxWidth,
          }
        : { ...sourceAnnotation, fontSize: sourceAnnotation.fontSize ?? ctx.smallFontSize ?? 12 };
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
          ctx.colors,
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
          ctx.colors,
        );
        break;
      case 'refline':
        resolved = resolveRefLineAnnotation(
          annotation,
          ctx.scales,
          ctx.chartArea,
          ctx.isDark,
          ctx.measure,
          ctx.fontFamily,
          ctx.colors,
        );
        break;
    }

    if (resolved) {
      // Range labels are fixed obstacles too; their bands are not. Record the
      // measured text block before automatic callouts choose a placement.
      if (resolved.label && !resolved.bounds)
        resolved.bounds = annotationBlockBounds(resolved, resolved.label, ctx.measure);
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
      // to the authored annotation from here on (reference lanes key on it too).
      resolved.specIndex = specIndex;
      if (annotation.type === 'refline' && annotation.labelPlacement)
        placeReferenceLabel(
          annotation,
          resolved,
          ctx.chartArea,
          ctx.referenceContainer ?? defaultReferenceContainer(ctx.svg, ctx.topBound),
          referenceReserve,
          referenceLanes,
          ctx.measure,
          ctx.colors,
          ctx.onWarn,
          [
            ...ctx.obstacles,
            ...annotations.flatMap((a) =>
              a.bounds ? [{ ...a.bounds, kind: 'annotation' as const }] : [],
            ),
          ],
        );
      if (annotation.type === 'refline' && !annotation.labelPlacement && ctx.obstacles.length > 0) {
        nudgeRefLineLabel(resolved, annotation, ctx.obstacles, ctx.chartArea, ctx.measure);
      }
      annotations.push(resolved);
    }
  }

  // ---- Pass 2: scored placement search for auto annotations ----
  if (autoQueue.length > 0 && ctx.svg.width > 0 && ctx.svg.height > 0) {
    // Build the working obstacle list: base obstacles + explicitly placed annotations
    const workingObstacles: PlacementObstacle[] = [...ctx.obstacles];
    for (let i = 0; i < annotations.length; i++) {
      const a = annotations[i];
      if (a.bounds && !autoQueue.some((q) => q.resolved === a)) {
        workingObstacles.push({ ...a.bounds, kind: 'annotation' } as PlacementObstacle);
      }
    }

    const crossingIndex = new ConnectorCrossings();
    for (const obstacle of workingObstacles) crossingIndex.addBox(obstacle);
    for (const placed of annotations) {
      if (!autoQueue.some((entry) => entry.resolved === placed))
        crossingIndex.addConnector(placed.label?.connector);
    }
    autoQueue.sort(
      (a, b) =>
        (a.annotation.priority ?? Number.MAX_SAFE_INTEGER) -
          (b.annotation.priority ?? Number.MAX_SAFE_INTEGER) || a.index - b.index,
    );
    for (const entry of autoQueue) {
      const { annotation, anchorX, anchorY, resolved } = entry;
      // Seed before the search so the leader it scores is the one the commit
      // below rebuilds; a too-short initial stub left the label unconnected.
      if (resolved.label)
        resolved.label.connector ??= textConnectorSeed(
          annotation,
          ctx.scales,
          ctx.isDark,
          ctx.colors,
        );
      // Must mirror resolveTextAnnotation exactly (font weight, theme font):
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
            fontSize: annotation.subtitleFontSize ?? subtitleFontSize(labelStyle.fontSize),
            fontWeight: SUBTITLE_FONT_WEIGHT,
            lineHeight: labelStyle.lineHeight,
            fontFamily: labelStyle.fontFamily,
          }
        : undefined;

      const result = findBestPlacement(
        anchorX,
        anchorY,
        resolved.label?.lines?.join('\n') ?? annotation.text,
        {
          fontSize: labelStyle.fontSize,
          fontWeight: Number(labelStyle.fontWeight) || 400,
          lineHeight: labelStyle.lineHeight,
          fontFamily: labelStyle.fontFamily,
        },
        resolved.subtitle?.lines?.join('\n') ?? annotation.subtitle,
        subtitleStyle,
        workingObstacles,
        ctx.chartArea,
        svgRect,
        ctx.measure,
        ctx.debugPlacement,
        (x, y, anchor) => {
          // No connector config means no leader at any candidate.
          if (!resolved.label?.connector) return 0;
          // The mover replaces label, subtitle and bounds rather than mutating
          // them, so a shallow copy keeps the resolved annotation untouched.
          const candidate = { ...resolved };
          moveAnnotationTo(candidate, resolved.label, x, y, ctx.measure, anchor);
          const connector = candidate.label?.connector;
          // Score the leader as it will draw: stopped short of its own value
          // label. One cut to nothing still strikes that label, so it scores whole.
          return crossingIndex.score(
            (connector && stopAtTargetLabel(connector, dataLabels)) || connector,
          );
        },
      );

      // Commit the placement. `moveAnnotationTo` owns every piece of the block's
      // geometry -- label, subtitle, both bounds caches, connector -- so this pass
      // does not get to invent its own copy of any of them. It used to, and the
      // copies drifted: this one re-derived the subtitle's baseline from a font-metric
      // sum spelled `+ 2` while the resolver spelled it `SUBTITLE_GAP`, so a subtitled
      // callout rendered 3px off from where the search had actually scored it.
      if (resolved.label) {
        moveAnnotationTo(
          resolved,
          resolved.label,
          result.labelX,
          result.labelY,
          ctx.measure,
          result.textAnchor,
        );
      }

      // Add this annotation's bounds as obstacle for subsequent auto annotations.
      // Read it back off the annotation rather than reusing `result.bounds`: the
      // mover is the authority on the block's extent, and `result.bounds` is the
      // search's own estimate of it. One of them has to be the source of truth.
      const placedBounds = resolved.bounds ?? result.bounds;
      workingObstacles.push({ ...placedBounds, kind: 'annotation' } as PlacementObstacle);
      crossingIndex.addBox({ ...placedBounds, kind: 'annotation' });
      crossingIndex.addConnector(resolved.label?.connector);
    }
  }

  // Resolve annotation-to-annotation collisions for non-auto-placed annotations.
  // When auto placement ran, those annotations already avoid each other via the
  // obstacle-accumulation loop above, so only explicitly placed ones need this.
  //
  // There used to be a hand-rolled walk here that built a *compacted* pair of
  // arrays (explicit annotations + their specs) and passed those. It was the
  // second representation of the same list, and once `resolveAnnotationCollisions`
  // started keying on the stamped `specIndex` — a GLOBAL index — the compacted
  // spec array no longer matched it. Every lookup was off by the number of auto
  // annotations, and the `type === 'text'` guard swallowed the resulting
  // `undefined`, so collision avoidance silently did nothing the moment a single
  // auto-placed annotation was present. Which is the *encouraged* authoring style:
  // a bare `{ type: 'text' }` is auto-placed by definition.
  //
  // So don't rebuild the list. Pass the real one, and let the pass skip the
  // auto-placed entries itself — `specIndex` already tells it which spec each
  // resolved annotation came from.
  const autoIndices = new Set(autoQueue.map((q) => q.index));
  resolveAnnotationCollisions(
    annotations,
    spec.annotations,
    ctx.scales,
    ctx.chartArea,
    ctx.measure,
    autoQueue.length > 0 ? (i) => autoIndices.has(i) : undefined,
  );

  // Clamp labels that overflow the SVG boundary back inside
  if (ctx.svg.width > 0 && ctx.svg.height > 0) {
    clampAnnotationsToBounds(annotations, ctx.svg.width, ctx.svg.height, ctx.measure, ctx.topBound);
  }

  // Sort by zIndex (lower first, undefined treated as 0)
  annotations.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  for (const resolved of annotations) {
    const authored = spec.annotations[resolved.specIndex!];
    // Routing, not placement: an authored block stays put while its leader
    // stops short of the value label it would otherwise strike through.
    const connector = resolved.label?.connector;
    if (authored?.type === 'text' && connector && dataLabels.length > 0) {
      const stopped = stopAtTargetLabel(connector, dataLabels);
      if (stopped !== undefined)
        resolved.label = { ...resolved.label!, connector: stopped ?? undefined };
    }
    if (authored?.type === 'text' && authored.dot === undefined && resolved.dot)
      adoptPointMarker(resolved.dot, ctx.pointMarkers);
    if (authored?.type === 'text')
      rememberAnnotationGeometry(
        resolved,
        {
          ...authored,
          maxWidth:
            authored.maxWidth === undefined
              ? defaultCalloutMaxWidth(authored, ctx)
              : authored.maxWidth,
        },
        ctx,
      );
  }
  return annotations;
}

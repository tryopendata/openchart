/** Frozen, engine-owned geometry for a single annotation editing gesture. */
import type {
  ChartLayout,
  ElementRef,
  Rect,
  ResolvedAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { annotationSource } from '@opendata-ai/openchart-core';
import { clampAnnotationsToBounds } from './collisions';
import type { AnnotationContext } from './compute';
import { refreshConnector } from './geometry';
import { moveAnnotationBy } from './move';
import { markerClearance, resolveTextAnnotation, textConnectorSeed } from './resolve-text';

// Keep measurement functions and scales out of serializable public layout objects.
// Each compiled annotation owns the exact inputs which produced its geometry.
const geometry = new WeakMap<
  ResolvedAnnotation,
  { context: AnnotationContext; authored: TextAnnotation }
>();
export function rememberAnnotationGeometry(
  annotation: ResolvedAnnotation,
  authored: TextAnnotation,
  context: AnnotationContext,
): void {
  geometry.set(annotation, { context, authored });
}

interface Entry {
  ref: Extract<ElementRef, { type: 'annotation' }>;
  resolved: ResolvedAnnotation;
  base: ResolvedAnnotation;
  connectorSeed?: NonNullable<ResolvedAnnotation['label']>['connector'];
  anchor: 'left' | 'right';
  context: AnnotationContext;
}
/** Opaque gesture snapshot. Create a new context after a committed edit or resize. */
export interface AnnotationEditContext {
  readonly kind: 'annotation-edit-context';
}

const snapshots = new WeakMap<AnnotationEditContext, readonly Entry[]>();

/** Snapshot a compiled layout without asking callers to reconstruct scales or obstacles. */
export function createAnnotationEditContext(
  layout: ChartLayout,
  spec: unknown,
): AnnotationEditContext {
  const source = annotationSource(spec);
  const entries: Entry[] = [];
  const panels = layout.facet
    ? layout.facet.panels.map((p) => ({ annotations: p.annotations, facet: p.key }))
    : [{ annotations: layout.annotations, facet: undefined }];
  for (const panel of panels) {
    for (const resolved of panel.annotations) {
      if (resolved.type !== 'text' || !resolved.label || !resolved.bounds) continue;
      const metadata = geometry.get(resolved);
      if (!metadata || !source) continue;
      const index = resolved.specIndex;
      if (index === undefined) continue;
      const authored = source.annotations[index] as TextAnnotation | undefined;
      if (!authored || authored.type !== 'text' || authored.id !== resolved.id) continue;
      const context = metadata.context;
      const anchor = resolved.label.style.textAnchor === 'end' ? 'left' : 'right';
      const base = resolveTextAnnotation(
        { ...metadata.authored, anchor, offset: undefined },
        context.scales,
        context.chartArea,
        context.isDark,
        context.measure,
        context.fontFamily,
      );
      if (!base) continue;
      entries.push({
        ref: {
          type: 'annotation',
          index,
          id: authored.id,
          path: `${source.path}/${index}`,
          ...(panel.facet !== undefined ? { facetInstance: panel.facet } : {}),
        },
        resolved: structuredClone(resolved),
        base,
        anchor,
        connectorSeed: textConnectorSeed(metadata.authored, context.scales, context.isDark),
        context: {
          ...context,
          chartArea: { ...context.chartArea },
          svg: { ...context.svg },
          obstacles: [],
        },
      });
    }
  }
  const snapshot: AnnotationEditContext = Object.freeze({ kind: 'annotation-edit-context' });
  snapshots.set(snapshot, entries);
  return snapshot;
}

function entryFor(ctx: AnnotationEditContext, ref: ElementRef): Entry {
  if (ref.type !== 'annotation') throw new Error('Expected an annotation reference');
  const matches = (snapshots.get(ctx) ?? []).filter(
    (entry) =>
      entry.ref.index === ref.index &&
      (ref.id === undefined || entry.ref.id === ref.id) &&
      (ref.path === undefined ||
        ref.path === entry.ref.path ||
        ref.path.startsWith(`${entry.ref.path}/`)) &&
      (ref.facetInstance === undefined || ref.facetInstance === entry.ref.facetInstance),
  );
  if (matches.length !== 1)
    throw new Error('Annotation reference is missing or ambiguous in this edit context');
  return matches[0];
}

/** Convert the rendered block box to an explicit placement, preserving its alignment. */
export function inverseLabelPlacement(
  ctx: AnnotationEditContext,
  ref: ElementRef,
  renderedBox: Rect,
): Pick<TextAnnotation, 'anchor' | 'offset' | 'responsive'> {
  const entry = entryFor(ctx, ref);
  const bounds = entry.base.bounds!;
  return {
    anchor: entry.anchor,
    offset: {
      dx: Math.round((renderedBox.x - bounds.x) * 1e10) / 1e10,
      dy: Math.round((renderedBox.y - bounds.y) * 1e10) / 1e10,
    },
    responsive: false,
  };
}

/** Move only the label block; keep its data anchor and the surrounding layout frozen. */
export function previewAnnotationMove(
  ctx: AnnotationEditContext,
  ref: ElementRef,
  delta: { dx: number; dy: number },
): ResolvedAnnotation {
  const entry = entryFor(ctx, ref);
  const annotation = structuredClone(entry.resolved);
  const context = entry.context;
  if (!annotation.label!.connector && entry.connectorSeed)
    annotation.label!.connector = structuredClone(entry.connectorSeed);
  moveAnnotationBy(annotation, annotation.label!, delta.dx, delta.dy, context.measure);
  clampAnnotationsToBounds(
    [annotation],
    context.svg.width,
    context.svg.height,
    context.measure,
    context.topBound,
  );
  return annotation;
}

/** Change a curve without moving its label, attachment, or marker. */
export function previewConnectorBend(
  ctx: AnnotationEditContext,
  ref: ElementRef,
  bend: number,
): ResolvedAnnotation {
  if (!Number.isFinite(bend) || bend < -1 || bend > 1)
    throw new RangeError('Connector bend must be between -1 and 1');
  const annotation = structuredClone(entryFor(ctx, ref).resolved);
  const connector = annotation.label?.connector;
  if (connector?.style === 'curve')
    annotation.label!.connector = refreshConnector(
      { ...connector, bend },
      annotation.bounds!,
      markerClearance(annotation.dot),
    );
  return annotation;
}

/** Preview a connector endpoint nudge without parsing rendered path geometry. */
export function previewConnectorOffset(
  ctx: AnnotationEditContext,
  ref: ElementRef,
  end: 'from' | 'to',
  delta: { dx: number; dy: number },
): ResolvedAnnotation {
  const entry = entryFor(ctx, ref);
  const annotation = structuredClone(entry.resolved);
  const connector = structuredClone(annotation.label?.connector ?? entry.connectorSeed);
  if (!connector?.endpoint) return annotation;
  if (end === 'from')
    connector.fromOffset = {
      dx: (connector.fromOffset?.dx ?? 0) + delta.dx,
      dy: (connector.fromOffset?.dy ?? 0) + delta.dy,
    };
  else {
    connector.endpoint.x += delta.dx;
    connector.endpoint.y += delta.dy;
    if (annotation.dot) {
      annotation.dot.x += delta.dx;
      annotation.dot.y += delta.dy;
    }
  }
  annotation.label!.connector = refreshConnector(
    connector,
    annotation.bounds!,
    markerClearance(annotation.dot),
  );
  return annotation;
}

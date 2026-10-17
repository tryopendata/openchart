import type {
  ChartLayout,
  ElementEdit,
  ElementRef,
  ResolvedAnnotation,
  TextAnnotation,
} from '@opendata-ai/openchart-core';
import { annotationSource } from '@opendata-ai/openchart-core';
import {
  createAnnotationEditContext,
  inverseLabelPlacement,
  previewAnnotationMove,
} from '@opendata-ai/openchart-engine';
import { updateAnnotationGeometry } from '../renderers/annotations';
import { findElementByRef } from './selection';

/** Batch keyboard repeats into one placement transaction; flush before other gestures. */
export function createAnnotationNudges(
  read: () => {
    layout: ChartLayout;
    spec: unknown;
    svg: SVGElement | null;
    selected: ElementRef | null;
  },
  emit: (edit: ElementEdit) => void,
) {
  let pending:
    | {
        ctx: ReturnType<typeof createAnnotationEditContext>;
        ref: ElementRef;
        authored: TextAnnotation;
        original: ResolvedAnnotation;
        dx: number;
        dy: number;
      }
    | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    const batch = pending;
    pending = undefined;
    if (!batch) return;
    const preview = previewAnnotationMove(batch.ctx, batch.ref, batch);
    const placement = inverseLabelPlacement(batch.ctx, batch.ref, preview.bounds!);
    const { svg, layout } = read();
    const target = svg && findElementByRef(svg, batch.ref);
    if (target)
      updateAnnotationGeometry(target, batch.original, layout.theme.colors.neutral.surface);
    emit({
      type: 'annotation',
      element: batch.ref,
      annotation: batch.authored,
      offset: placement.offset!,
      anchor: placement.anchor,
      responsive: false,
    });
  };
  const keydown = (event: KeyboardEvent): boolean => {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
      return false;
    const { layout, spec, svg, selected } = read();
    if (!svg || selected?.type !== 'annotation') return false;
    const authored = annotationSource(spec).annotations[selected.index];
    if (authored?.type !== 'text') return false;
    if (!pending) {
      const ctx = createAnnotationEditContext(layout, spec);
      try {
        previewAnnotationMove(ctx, selected, { dx: 0, dy: 0 });
      } catch {
        return false;
      }
      const annotations =
        selected.facetInstance !== undefined
          ? layout.facet?.panels.find((panel) => panel.key === selected.facetInstance)?.annotations
          : layout.annotations;
      const original = annotations?.find((annotation) => annotation.specIndex === selected.index);
      if (!original) return false;
      pending = { ctx, ref: selected, authored, original, dx: 0, dy: 0 };
    }
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    pending.dx += event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    pending.dy += event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const target = findElementByRef(svg, pending.ref);
    if (target)
      updateAnnotationGeometry(
        target,
        previewAnnotationMove(pending.ctx, pending.ref, pending),
        layout.theme.colors.neutral.surface,
      );
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, 120);
    return true;
  };
  return { keydown, flush };
}

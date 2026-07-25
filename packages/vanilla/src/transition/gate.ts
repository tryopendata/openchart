import type { ChartLayout } from '@opendata-ai/openchart-core';

import { keyAnnotations } from './keys';

// ---------------------------------------------------------------------------
// canTransition gate
// ---------------------------------------------------------------------------

/** Mark types that support data-update transitions. */
export const TRANSITIONABLE_MARKS = new Set(['bar', 'line', 'area', 'point']);

/**
 * Default cap on the mark count that still runs a tweened data-update
 * transition. Override per chart with `animation.update.maxMarks`.
 */
export const DEFAULT_UPDATE_MAX_MARKS = 500;

/**
 * Default cap when the destination layout renders its points on canvas.
 *
 * Two orders of magnitude above the SVG cap because the cost model is
 * different: a canvas frame writes into typed arrays and issues one batched
 * fill per color bucket, where the SVG path writes attributes on one DOM
 * element per mark. The cap that keeps low-end devices honest for DOM writes
 * would veto exactly the high-cardinality morphs canvas mode exists to serve.
 */
export const CANVAS_DEFAULT_UPDATE_MAX_MARKS = 20_000;

/**
 * Spec-shape half of the transition gate (mark type + encoding identity),
 * usable before either spec has been compiled. Exported so callers that
 * need to predict transition eligibility ahead of a compile (e.g. the
 * scrollytelling story layer deciding whether to arm its crossfade
 * fallback) can reuse the exact same rule the post-compile gate enforces,
 * rather than re-deriving it and risking drift.
 *
 * This is gate checks 3-4 of `canTransition` in isolation; it does NOT
 * check layout-derived conditions (dimensions, mark count, geometry delta,
 * sparkline display) since those require a compiled `ChartLayout`.
 */
export function canTransitionSpecShape(prevSpec: unknown, nextSpec: unknown): boolean {
  const prev = prevSpec as Record<string, unknown>;
  const next = nextSpec as Record<string, unknown>;
  if (!prev || !next || !('mark' in prev) || !('mark' in next)) return false;
  const prevMark =
    typeof prev.mark === 'string' ? prev.mark : (prev.mark as Record<string, unknown>)?.type;
  const nextMark =
    typeof next.mark === 'string' ? next.mark : (next.mark as Record<string, unknown>)?.type;
  if (prevMark !== nextMark) return false;
  if (!TRANSITIONABLE_MARKS.has(prevMark as string)) return false;

  const prevEnc = (prev as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  const nextEnc = (next as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  if (!prevEnc || !nextEnc) return false;
  return !(
    prevEnc.x?.field !== nextEnc.x?.field ||
    prevEnc.x?.type !== nextEnc.x?.type ||
    prevEnc.y?.field !== nextEnc.y?.field ||
    prevEnc.y?.type !== nextEnc.y?.type ||
    prevEnc.color?.field !== nextEnc.color?.field
  );
}

/**
 * Determine whether a data-update transition should run instead of
 * a full tear-down + re-render.
 *
 * Ten gate checks must all pass. If any fails, the caller should fall
 * through to the standard render path (instant swap).
 */
export function canTransition(args: {
  prevLayout: ChartLayout | null;
  nextLayout: ChartLayout;
  prevSpec: unknown;
  nextSpec: unknown;
  isFirstRender: boolean;
  entranceInFlight: boolean;
}): boolean {
  const { prevLayout, nextLayout, prevSpec, nextSpec, isFirstRender, entranceInFlight } = args;

  // 1. Previous layout + spec exist and not first render
  if (!prevLayout || !prevSpec || isFirstRender) return false;

  // 2. Resolved animation.update present on next layout
  if (!nextLayout.animation?.update) return false;

  // 3-4. Mark type + encoding identity unchanged (spec-shape half of the gate)
  if (!canTransitionSpecShape(prevSpec, nextSpec)) return false;

  // 5. Not sparkline
  if (nextLayout.display === 'sparkline') return false;

  // 6. Entrance animation not in flight
  if (entranceInFlight) return false;

  // 7. Layout dimensions unchanged
  if (
    prevLayout.dimensions.width !== nextLayout.dimensions.width ||
    prevLayout.dimensions.height !== nextLayout.dimensions.height
  ) {
    return false;
  }

  // 8. Mark count within the update cap. Per-frame SVG attribute writes on
  //    thousands of elements drop frames on low-end devices, so past the cap
  //    the caller falls through to an instant swap.
  //
  //    The cap comes from the DESTINATION mode, and so do exit ghosts -- they
  //    are rendered into the next layout's surface. That makes the count that
  //    matters `max(prev, next)`, not `next` alone: a 4,341-point canvas chart
  //    updating down to 400 SVG points looks cheap by `next`, but the update
  //    would mint ~3,941 SVG ghost circles, which is precisely the jank this
  //    cap exists to prevent. (svg -> canvas needs no such guard: the canvas
  //    cap applies and the exits paint on canvas.)
  const cap =
    nextLayout.animation.update.maxMarks ??
    (nextLayout.markRenderMode === 'canvas'
      ? CANVAS_DEFAULT_UPDATE_MAX_MARKS
      : DEFAULT_UPDATE_MAX_MARKS);
  if (Math.max(prevLayout.marks.length, nextLayout.marks.length) > cap) return false;

  // 9. Something visible actually changed (zero-delta check)
  if (!hasVisibleChange(prevLayout, nextLayout)) return false;

  // 10. prefers-reduced-motion not active
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    } catch {
      // happy-dom may not support matchMedia fully; treat as no preference
    }
  }

  return true;
}

/**
 * Check whether anything the transition can animate differs between layouts.
 *
 * Gate check 9. This is broader than geometry on purpose: a step that only
 * recolors (an `encoding.color.highlight` mute) or only adds an annotation
 * moves no mark by a single pixel. Testing geometry alone reported "nothing
 * changed" for those, vetoing the transition and leaving `render()`'s instant
 * swap as the only thing that happened -- so the highlight snapped and the
 * annotation popped in, even though the machinery to fade both already existed
 * further down this file.
 */
export function hasVisibleChange(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  return (
    hasGeometryChanged(prevLayout, nextLayout) ||
    hasColorChanged(prevLayout, nextLayout) ||
    hasAnnotationChanged(prevLayout, nextLayout)
  );
}

/** Check if any mark's fill or stroke differs (e.g. a highlight mute). */
export function hasColorChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prevMarks = prevLayout.marks;
  const nextMarks = nextLayout.marks;
  if (prevMarks.length !== nextMarks.length) return true;

  for (let i = 0; i < prevMarks.length; i++) {
    const p = prevMarks[i] as { fill?: string; stroke?: string };
    const n = nextMarks[i] as { fill?: string; stroke?: string };
    if (p.fill !== n.fill || p.stroke !== n.stroke) return true;
  }
  return false;
}

/** Check if annotations were added, removed, reordered, or moved. */
export function hasAnnotationChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prev = prevLayout.annotations ?? [];
  const next = nextLayout.annotations ?? [];
  if (prev.length !== next.length) return true;

  const prevKeys = keyAnnotations(prev);
  const nextKeys = keyAnnotations(next);

  for (let i = 0; i < prev.length; i++) {
    if (prevKeys[i] !== nextKeys[i]) return true;
    const p = prev[i];
    const n = next[i];
    if (p.label?.x !== n.label?.x || p.label?.y !== n.label?.y) return true;
    if (p.opacity !== n.opacity) return true;
  }
  return false;
}

/** Check if any mark geometry differs between prev and next layouts. */
export function hasGeometryChanged(prevLayout: ChartLayout, nextLayout: ChartLayout): boolean {
  const prevMarks = prevLayout.marks;
  const nextMarks = nextLayout.marks;

  if (prevMarks.length !== nextMarks.length) return true;

  for (let i = 0; i < prevMarks.length; i++) {
    const p = prevMarks[i];
    const n = nextMarks[i];
    if (p.type !== n.type || p.key !== n.key) return true;

    if (p.type === 'rect' && n.type === 'rect') {
      if (p.x !== n.x || p.y !== n.y || p.width !== n.width || p.height !== n.height) return true;
    } else if (p.type === 'line' && n.type === 'line') {
      if (p.path !== n.path || p.points.length !== n.points.length) return true;
      for (let j = 0; j < p.points.length; j++) {
        if (p.points[j].x !== n.points[j].x || p.points[j].y !== n.points[j].y) return true;
      }
    } else if (p.type === 'area' && n.type === 'area') {
      if (p.path !== n.path) return true;
    } else if (p.type === 'point' && n.type === 'point') {
      if (p.cx !== n.cx || p.cy !== n.cy || p.r !== n.r) return true;
    } else if (p.type === 'rule' && n.type === 'rule') {
      if (p.x1 !== n.x1 || p.y1 !== n.y1 || p.x2 !== n.x2 || p.y2 !== n.y2) return true;
    } else if (p.type === 'tick' && n.type === 'tick') {
      if (p.x !== n.x || p.y !== n.y) return true;
    } else if (p.type === 'textMark' && n.type === 'textMark') {
      if (p.x !== n.x || p.y !== n.y) return true;
    }
  }
  return false;
}

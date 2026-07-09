/**
 * Data-update transition driver for bar/column charts.
 *
 * Matches marks across layout snapshots by `key`, then animates geometry
 * changes (position, size) using a single rAF loop. Enter/exit/update
 * choreography runs in one timeline with cubic-out easing for a smooth
 * deceleration feel.
 *
 * Ghost elements handle exits: cloned into the marks container, they
 * collapse + fade out then get removed. No CSS animations are used here
 * because transitions tween computed geometry, not class-toggled states.
 */

import type { ChartLayout, RectMark, ResolvedAnimation } from '@opendata-ai/openchart-core';
import { rectPathWithCorners, renderSingleMark } from './renderers/marks';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TransitionHandle {
  cancel(): void;
  readonly running: boolean;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/** Cubic-out easing: objects decelerate naturally into place. */
function cubicOut(t: number): number {
  const f = 1 - t;
  return 1 - f * f * f;
}

// ---------------------------------------------------------------------------
// canTransition gate
// ---------------------------------------------------------------------------

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

  // 3. Both are chart specs (have `mark`), same mark type, type in ['bar','column']
  const prev = prevSpec as Record<string, unknown>;
  const next = nextSpec as Record<string, unknown>;
  if (!('mark' in prev) || !('mark' in next)) return false;
  const prevMark =
    typeof prev.mark === 'string' ? prev.mark : (prev.mark as Record<string, unknown>)?.type;
  const nextMark =
    typeof next.mark === 'string' ? next.mark : (next.mark as Record<string, unknown>)?.type;
  if (prevMark !== nextMark) return false;
  if (prevMark !== 'bar') return false; // bar/column both use mark:'bar'

  // 4. Encoding identity unchanged
  const prevEnc = (prev as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  const nextEnc = (next as { encoding?: Record<string, Record<string, unknown>> }).encoding;
  if (!prevEnc || !nextEnc) return false;
  if (
    prevEnc.x?.field !== nextEnc.x?.field ||
    prevEnc.x?.type !== nextEnc.x?.type ||
    prevEnc.y?.field !== nextEnc.y?.field ||
    prevEnc.y?.type !== nextEnc.y?.type ||
    prevEnc.color?.field !== nextEnc.color?.field
  ) {
    return false;
  }

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

  // 8. Mark count <= 500
  if (nextLayout.marks.length > 500) return false;

  // 9. Geometry actually changed (zero-delta check)
  const prevRects = prevLayout.marks.filter((m): m is RectMark => m.type === 'rect');
  const nextRects = nextLayout.marks.filter((m): m is RectMark => m.type === 'rect');
  if (prevRects.length === nextRects.length) {
    let identical = true;
    for (let i = 0; i < prevRects.length; i++) {
      const p = prevRects[i];
      const n = nextRects[i];
      if (
        p.x !== n.x ||
        p.y !== n.y ||
        p.width !== n.width ||
        p.height !== n.height ||
        p.key !== n.key
      ) {
        identical = false;
        break;
      }
    }
    if (identical) return false;
  }

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

// ---------------------------------------------------------------------------
// Internal types for tweens
// ---------------------------------------------------------------------------

interface RectGeom {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RectTween {
  kind: 'update' | 'enter' | 'exit';
  el: SVGElement;
  from: RectGeom;
  to: RectGeom;
  mark: RectMark;
  /** For exit ghosts: the ghost element to remove on complete. */
  ghost?: SVGElement;
  /** Interpolated opacity for exits (1 -> 0). */
  fromOpacity?: number;
  toOpacity?: number;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function geomFromMark(m: RectMark): RectGeom {
  return { x: m.x, y: m.y, width: m.width, height: m.height };
}

function applyGeomToElement(el: SVGElement, geom: RectGeom, mark: RectMark): void {
  const shapeEl = el.querySelector('rect, path') as SVGElement | null;
  if (!shapeEl) return;

  const sides = mark.cornerRadiusSides;
  const partialCorners =
    !!sides && (!sides.tl || !sides.tr || !sides.br || !sides.bl) && !!mark.cornerRadius;

  if (partialCorners && shapeEl.tagName === 'path') {
    // Re-generate path from interpolated geometry + original corner config
    const tempMark = { ...mark, ...geom };
    shapeEl.setAttribute('d', rectPathWithCorners(tempMark, sides));
  } else {
    shapeEl.setAttribute('x', String(geom.x));
    shapeEl.setAttribute('y', String(geom.y));
    shapeEl.setAttribute('width', String(geom.width));
    shapeEl.setAttribute('height', String(geom.height));
  }
}

function lerpGeom(from: RectGeom, to: RectGeom, t: number): RectGeom {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

// ---------------------------------------------------------------------------
// runTransition
// ---------------------------------------------------------------------------

export function runTransition(args: {
  svg: SVGSVGElement;
  prevLayout: ChartLayout;
  nextLayout: ChartLayout;
  animation: ResolvedAnimation;
  onComplete: () => void;
}): TransitionHandle {
  const { svg, prevLayout, nextLayout, animation, onComplete } = args;
  const update = animation.update!;
  const exit = animation.exit ?? {
    duration: 300,
    ease: 'smooth',
    staggerDelay: 0,
    staggerOrder: 'index' as const,
  };

  // Total timeline
  const totalMs = Math.max(update.duration, exit.duration);
  const enterDelay = 0.4 * update.duration; // enters start at 40% of update duration
  const enterDuration = update.duration - enterDelay; // remaining 60%

  // Collect rect marks from both layouts
  const prevRects = prevLayout.marks.filter((m): m is RectMark => m.type === 'rect');
  const nextRects = nextLayout.marks.filter((m): m is RectMark => m.type === 'rect');

  // Build key maps
  const prevByKey = new Map<string, RectMark>();
  for (const m of prevRects) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, RectMark>();
  for (const m of nextRects) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Classify: entered, updated, exited
  const entered: RectMark[] = [];
  const updated: Array<{ prev: RectMark; next: RectMark }> = [];
  const exited: RectMark[] = [];

  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (prev) {
      updated.push({ prev, next });
    } else {
      entered.push(next);
    }
  }
  for (const [key, prev] of prevByKey) {
    if (!nextByKey.has(key)) {
      exited.push(prev);
    }
  }

  // Find the marks container in the SVG
  const marksContainer = svg.querySelector('.oc-marks') as SVGElement | null;
  if (!marksContainer) {
    onComplete();
    return {
      cancel() {},
      get running() {
        return false;
      },
    };
  }

  // Build tweens
  const tweens: RectTween[] = [];
  const ghosts: SVGElement[] = [];

  // UPDATED marks: tween from old geometry to new geometry
  for (const { prev, next } of updated) {
    const el = marksContainer.querySelector(`[data-key="${next.key}"]`) as SVGElement | null;
    if (!el) continue;
    tweens.push({
      kind: 'update',
      el,
      from: geomFromMark(prev),
      to: geomFromMark(next),
      mark: next,
    });
  }

  // ENTERING marks: grow from value-axis baseline
  for (const next of entered) {
    const el = marksContainer.querySelector(`[data-key="${next.key}"]`) as SVGElement | null;
    if (!el) continue;

    let fromGeom: RectGeom;
    if (next.orient === 'horizontal') {
      // Horizontal bar: collapse width to 0, x at left edge (baseline)
      if (next.stackGroup && next.stackPos !== undefined && next.stackPos > 0) {
        // Stacked segment: collapse toward own left seam
        fromGeom = { x: next.x, y: next.y, width: 0, height: next.height };
      } else {
        fromGeom = { x: next.x, y: next.y, width: 0, height: next.height };
      }
    } else {
      // Vertical column: collapse height to 0, y at bottom (baseline)
      if (next.stackGroup && next.stackPos !== undefined && next.stackPos > 0) {
        // Stacked segment: collapse toward own bottom seam
        fromGeom = { x: next.x, y: next.y + next.height, width: next.width, height: 0 };
      } else {
        fromGeom = { x: next.x, y: next.y + next.height, width: next.width, height: 0 };
      }
    }

    tweens.push({
      kind: 'enter',
      el,
      from: fromGeom,
      to: geomFromMark(next),
      mark: next,
    });
  }

  // EXITING marks: create ghosts, collapse + fade
  for (const prev of exited) {
    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    let toGeom: RectGeom;
    if (prev.orient === 'horizontal') {
      toGeom = { x: prev.x, y: prev.y, width: 0, height: prev.height };
    } else {
      toGeom = { x: prev.x, y: prev.y + prev.height, width: prev.width, height: 0 };
    }

    tweens.push({
      kind: 'exit',
      el: ghost,
      from: geomFromMark(prev),
      to: toGeom,
      mark: prev,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }

  // Apply all from-states SYNCHRONOUSLY before scheduling the first rAF
  for (const tw of tweens) {
    applyGeomToElement(tw.el, tw.from, tw.mark);
    if (tw.fromOpacity !== undefined) {
      tw.el.style.opacity = String(tw.fromOpacity);
    }
  }

  // Animation loop state
  let rafId: number | null = null;
  let running = true;
  let startTime: number | null = null;

  function tick(now: number): void {
    if (!running) return;
    if (startTime === null) startTime = now;

    const elapsed = now - startTime;
    const tGlobal = Math.min(elapsed / totalMs, 1);

    for (const tw of tweens) {
      let tLocal: number;

      if (tw.kind === 'exit') {
        // Exits run 0 -> exit.duration
        tLocal = Math.min(elapsed / exit.duration, 1);
      } else if (tw.kind === 'enter') {
        // Enters delayed by enterDelay, run over enterDuration
        if (elapsed < enterDelay) {
          tLocal = 0;
        } else {
          tLocal = Math.min((elapsed - enterDelay) / enterDuration, 1);
        }
      } else {
        // Updates run 0 -> update.duration
        tLocal = Math.min(elapsed / update.duration, 1);
      }

      const eased = cubicOut(tLocal);
      const geom = lerpGeom(tw.from, tw.to, eased);
      applyGeomToElement(tw.el, geom, tw.mark);

      if (tw.fromOpacity !== undefined && tw.toOpacity !== undefined) {
        const opacity = tw.fromOpacity + (tw.toOpacity - tw.fromOpacity) * eased;
        tw.el.style.opacity = String(opacity);
      }
    }

    if (tGlobal >= 1) {
      finish();
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  function finish(): void {
    if (!running) return;
    running = false;
    rafId = null;

    // Snap all to final state
    snapToFinal();

    // Remove ghosts
    removeGhosts();

    onComplete();
  }

  function snapToFinal(): void {
    for (const tw of tweens) {
      applyGeomToElement(tw.el, tw.to, tw.mark);
      if (tw.toOpacity !== undefined) {
        tw.el.style.opacity = String(tw.toOpacity);
      }
    }
  }

  function removeGhosts(): void {
    for (const ghost of ghosts) {
      ghost.parentNode?.removeChild(ghost);
    }
  }

  // Start the animation
  rafId = requestAnimationFrame(tick);

  return {
    cancel(): void {
      if (!running) return;
      running = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Snap to final values
      snapToFinal();
      // Remove ghosts
      removeGhosts();
      // Do NOT call onComplete on cancel
    },
    get running() {
      return running;
    },
  };
}

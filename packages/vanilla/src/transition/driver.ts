/**
 * Data-update transition driver for bar/column, line, area, scatter/dot,
 * rule, tick, and text charts. Also transitions axis ticks, tick labels,
 * and gridlines so the whole chart adjusts as one system.
 *
 * Matches marks across layout snapshots by `key`, then animates geometry
 * changes (position, size, path) using a single rAF loop. Enter/exit/update
 * choreography runs in one timeline with cubic-out easing for a smooth
 * deceleration feel.
 *
 * For rect marks: tweens position/size directly.
 * For line/area marks: normalizes point arrays to equal length, interpolates
 * point positions per frame, and rebuilds SVG paths via d3 curve generators.
 * For point marks (scatter/dot/line overlay): tweens cx/cy/r.
 * For rule/tick marks: tweens line endpoints (x1/y1/x2/y2).
 * For text marks: tweens x/y position.
 * For axis ticks/gridlines: matches by value key and tweens positions.
 *
 * Ghost elements handle exits: cloned into the marks container, they
 * collapse + fade out then get removed. No CSS animations are used here
 * because transitions tween computed geometry, not class-toggled states.
 */

import type {
  AreaMark,
  ChartLayout,
  LineMark,
  ResolvedAnimation,
} from '@opendata-ai/openchart-core';
import { isGradientDef } from '@opendata-ai/openchart-core';
import { buildAreaPath, buildLinePath, EXIT_DEFAULTS } from '@opendata-ai/openchart-engine';
import { buildGradientDefs } from '../gradient-utils';
import { cubicOut } from '../motion/easing';

import { applyTweenState, getKeyForTween, lerpArcGeom, snapTweenToFinal } from './apply';
import { buildCanvasGridlinesTween, buildCanvasPointsTween } from './canvas-tweens';
import { buildAnnotationTweens, buildAxisTweens, buildColorTweens } from './chrome-tweens';
import { buildMarkDomIndex } from './dom-index';
import {
  applyFinalAreaPaths,
  applyFinalLinePath,
  interpolatePoints,
  lerpGeom,
} from './interpolate';
import {
  buildArcTweens,
  buildAreaTweens,
  buildLineTweens,
  buildPointTweens,
  buildRectTweens,
  buildRuleTweens,
  buildTextMarkTweens,
  buildTickTweens,
} from './svg-tweens';
import type {
  CanvasLayerLike,
  GeometrySnapshot,
  SnapshotGeometry,
  TransitionHandle,
  Tween,
} from './types';

// ---------------------------------------------------------------------------
// runTransition
// ---------------------------------------------------------------------------

/** Set on the SVG root while the rAF driver owns per-frame inline opacity. */
const TRANSITIONING_CLASS = 'oc-transitioning';

export function runTransition(args: {
  svg: SVGSVGElement;
  prevLayout: ChartLayout;
  nextLayout: ChartLayout;
  animation: ResolvedAnimation;
  onComplete: () => void;
  /** Snapshot from a cancelled in-flight transition for retargeting. */
  fromSnapshot?: GeometrySnapshot;
  /**
   * Suppress the internal rAF loop; the caller drives the transition via
   * `handle.step(elapsedMs)`. Used by headless frame capture. `onComplete` is
   * NOT called automatically in manual mode — the caller finalizes by stepping
   * to `totalMs` (which snaps to final) or calling `cancel()`.
   */
  manual?: boolean;
  /**
   * The canvas mark layer, when the NEXT layout renders points on canvas. Point
   * geometry is then tweened into `canvas.state` instead of onto SVG circles,
   * and this one rAF loop paints it — the layer's own scheduler stays idle for
   * the duration (entrance blocks transitions; hover is suspended).
   */
  canvas?: CanvasLayerLike;
}): TransitionHandle {
  const { svg, prevLayout, nextLayout, animation, onComplete, fromSnapshot, manual, canvas } = args;
  const update = animation.update!;
  const exit = animation.exit ?? { ...EXIT_DEFAULTS };

  // Total timeline
  const totalMs = Math.max(update.duration, exit.duration);
  const enterDelay = 0.4 * update.duration; // enters start at 40% of update duration
  const enterDuration = update.duration - enterDelay; // remaining 60%

  // Find the marks container in the SVG
  const marksContainer = svg.querySelector('.oc-marks') as SVGElement | null;
  if (!marksContainer) {
    onComplete();
    return {
      cancel() {},
      get running() {
        return false;
      },
      snapshot() {
        return new Map();
      },
      step() {
        return false;
      },
      totalMs: 0,
    };
  }

  // Marks the window in which the rAF loop owns every mark's inline
  // `style.opacity`. The hover CSS reads it to switch its own opacity
  // transition off, so a hover mid-update cannot smear the tween.
  svg.classList.add(TRANSITIONING_CLASS);

  // One DOM pass for every keyed mark element; valid for the whole transition
  // (the transition owns the DOM until onComplete, and ghosts carry no data-key).
  const dom = buildMarkDomIndex(marksContainer);

  // Build all tweens
  const tweens: Tween[] = [];
  const ghosts: SVGElement[] = [];

  // Fix gradient ghosts: ensure exiting marks with gradient fills have valid
  // gradient defs in the new SVG. Build any missing gradients into <defs>.
  const defs = svg.querySelector('defs') as SVGElement | null;
  let ghostGradientMap = new Map<string, string>();
  if (defs) {
    // Collect gradient fills from exiting marks (marks in prev but not next)
    const nextKeySet = new Set(nextLayout.marks.filter((m) => m.key).map((m) => m.key));
    const exitingMarks = prevLayout.marks.filter(
      (m) => m.key && !nextKeySet.has(m.key) && 'fill' in m,
    );
    const gradientMarks = exitingMarks.filter(
      (m) => 'fill' in m && isGradientDef((m as { fill: unknown }).fill),
    );
    if (gradientMarks.length > 0) {
      ghostGradientMap = buildGradientDefs(gradientMarks as Array<{ fill?: unknown }>, defs);
    }
  }

  // Determine what mark types we're dealing with
  const hasRects =
    prevLayout.marks.some((m) => m.type === 'rect') ||
    nextLayout.marks.some((m) => m.type === 'rect');
  const hasLines =
    prevLayout.marks.some((m) => m.type === 'line') ||
    nextLayout.marks.some((m) => m.type === 'line');
  const hasAreas =
    prevLayout.marks.some((m) => m.type === 'area') ||
    nextLayout.marks.some((m) => m.type === 'area');
  const hasArcs =
    prevLayout.marks.some((m) => m.type === 'arc') ||
    nextLayout.marks.some((m) => m.type === 'arc');
  const hasPoints =
    prevLayout.marks.some((m) => m.type === 'point') ||
    nextLayout.marks.some((m) => m.type === 'point');
  const hasRules =
    prevLayout.marks.some((m) => m.type === 'rule') ||
    nextLayout.marks.some((m) => m.type === 'rule');
  const hasTicks =
    prevLayout.marks.some((m) => m.type === 'tick') ||
    nextLayout.marks.some((m) => m.type === 'tick');
  const hasTextMarks =
    prevLayout.marks.some((m) => m.type === 'textMark') ||
    nextLayout.marks.some((m) => m.type === 'textMark');

  if (hasRects) {
    buildRectTweens(
      prevLayout,
      nextLayout,
      marksContainer,
      dom,
      tweens,
      ghosts,
      ghostGradientMap,
      fromSnapshot,
    );
  }
  if (hasLines) {
    buildLineTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasAreas) {
    buildAreaTweens(
      prevLayout,
      nextLayout,
      marksContainer,
      dom,
      tweens,
      ghosts,
      ghostGradientMap,
      fromSnapshot,
    );
  }
  if (hasArcs) {
    buildArcTweens(
      prevLayout,
      nextLayout,
      marksContainer,
      dom,
      tweens,
      ghosts,
      ghostGradientMap,
      fromSnapshot,
    );
  }
  if (hasPoints) {
    // Either/or, never both: in canvas mode the SVG carries no point circles
    // for the DOM builder to find, and every point (including exit ghosts)
    // lives on the layer.
    if (canvas) {
      buildCanvasPointsTween(prevLayout, nextLayout, canvas, tweens, fromSnapshot);
    } else {
      buildPointTweens(
        prevLayout,
        nextLayout,
        marksContainer,
        dom,
        tweens,
        ghosts,
        ghostGradientMap,
        fromSnapshot,
      );
    }
  }
  if (hasRules) {
    buildRuleTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasTicks) {
    buildTickTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }
  if (hasTextMarks) {
    buildTextMarkTweens(prevLayout, nextLayout, marksContainer, dom, tweens, ghosts, fromSnapshot);
  }

  // Axis tick/gridline transitions. In canvas mode the SVG axes carry tick
  // labels but no gridlines (the layer paints those), so both run: the SVG pass
  // finds zero `.oc-gridline` elements and only tweens labels.
  buildAxisTweens(svg, prevLayout, nextLayout, tweens, ghosts);
  if (canvas) {
    buildCanvasGridlinesTween(prevLayout, nextLayout, canvas, tweens);
  }

  // Mark fill/stroke (a highlight mute recolors marks that never move)
  buildColorTweens(prevLayout, nextLayout, dom, tweens);

  // Annotations: keyed diff, so only NEW annotations fade in and surviving
  // ones hold steady instead of blinking.
  buildAnnotationTweens(svg, prevLayout, nextLayout, tweens);

  // Secondary element crossfade: endpoint labels and mark labels still use the
  // blanket fade (annotations were promoted to the keyed path above).
  const secondaryEls = collectSecondaryElements(svg);
  // Store original opacities so we can restore them on completion
  const secondaryOriginalOpacity = secondaryEls.map((el) => el.style.opacity ?? '');

  // Apply all from-states SYNCHRONOUSLY before scheduling the first rAF
  for (const tw of tweens) {
    applyTweenState(tw, 0, update, exit, enterDelay, enterDuration);
  }
  // ...and paint them. The state writes above only rewind the layer's data; the
  // bitmap still shows the final state until something repaints. Relying on
  // rAF-runs-before-paint is an accident of ordering, and manual mode has no
  // paint at all between beginManualUpdate() and the first step().
  canvas?.repaint();
  // Hit-testing is off while marks are in motion: the spatial index still
  // describes the destination layout, and rebuilding it per frame at 4k points
  // is exactly the cost the canvas layer exists to avoid.
  canvas?.setInteractionSuspended(true);
  // Set secondary elements to invisible at start
  for (const el of secondaryEls) {
    el.style.opacity = '0';
  }

  // Animation loop state
  let rafId: number | null = null;
  let running = true;
  /** The dot this transition pulsed, so cancel() can clear its pending strip. */
  let pulsedDot: SVGElement | null = null;
  let startTime: number | null = null;
  let lastElapsed = 0;

  // Track line/area marks that need final path snapping
  const nextLineMarks = nextLayout.marks.filter((m): m is LineMark => m.type === 'line');
  const nextAreaMarks = nextLayout.marks.filter((m): m is AreaMark => m.type === 'area');

  function tick(now: number): void {
    if (!running) return;
    if (startTime === null) startTime = now;

    const elapsed = now - startTime;
    lastElapsed = elapsed;
    const tGlobal = Math.min(elapsed / totalMs, 1);

    for (const tw of tweens) {
      applyTweenState(tw, elapsed, update, exit, enterDelay, enterDuration);
    }

    // Crossfade secondary elements: delayed 40%, over 60% of update duration
    applySecondaryOpacity(secondaryEls, elapsed, enterDelay, enterDuration);

    // One paint per frame, after every tween has written its state.
    canvas?.repaint();

    if (tGlobal >= 1) {
      finish();
    } else {
      rafId = requestAnimationFrame(tick);
    }
  }

  /** Settle the canvas layer: repaint the final state, re-index, re-arm hover. */
  function settleCanvas(): void {
    if (!canvas) return;
    canvas.repaint();
    canvas.rebuildIndex();
    canvas.setInteractionSuspended(false);
  }

  function finish(): void {
    if (!running) return;
    running = false;
    rafId = null;
    svg.classList.remove(TRANSITIONING_CLASS);

    snapToFinal();
    removeGhosts();
    settleCanvas();
    pulsedDot = pulseSparklineTerminator(svg, marksContainer);
    // Restore secondary element opacities to their rendered values
    for (let i = 0; i < secondaryEls.length; i++) {
      secondaryEls[i].style.opacity = secondaryOriginalOpacity[i];
    }
    onComplete();
  }

  function snapToFinal(): void {
    for (const tw of tweens) {
      snapTweenToFinal(tw);
    }
    // Snap line/area paths to exact final mark paths (not interpolated)
    // to ensure round-trip invariant
    for (const mark of nextLineMarks) {
      if (!mark.key) continue;
      const el = dom.any(mark.key);
      if (el) applyFinalLinePath(el, mark);
    }
    for (const mark of nextAreaMarks) {
      if (!mark.key) continue;
      const el = dom.any(mark.key);
      if (el) applyFinalAreaPaths(el, mark);
    }
  }

  function removeGhosts(): void {
    for (const ghost of ghosts) {
      ghost.parentNode?.removeChild(ghost);
    }
  }

  /** Capture the current interpolated geometry of all in-flight tweens. */
  function captureSnapshot(): GeometrySnapshot {
    const snap: GeometrySnapshot = new Map();
    const tUpdate = Math.min(lastElapsed / update.duration, 1);
    const easedUpdate = cubicOut(tUpdate);

    for (const tw of tweens) {
      if (tw.kind !== 'update') continue;

      // Canvas points snapshot per-point from the packed arrays. The emitted
      // entries are plain `{type:'point'}` -- identical to what the SVG path
      // emits -- so an interrupted transition retargets correctly even across
      // an svg <-> canvas mode flip.
      if (tw.tweenType === 'canvasPoints') {
        for (let s = 0; s < tw.soaIndex.length; s++) {
          snap.set(tw.soaKeys[s], {
            type: 'point',
            cx: tw.fromCx[s] + (tw.toCx[s] - tw.fromCx[s]) * easedUpdate,
            cy: tw.fromCy[s] + (tw.toCy[s] - tw.fromCy[s]) * easedUpdate,
            r: tw.fromR[s] + (tw.toR[s] - tw.fromR[s]) * easedUpdate,
          });
        }
        continue;
      }

      const key = getKeyForTween(tw);
      if (!key) continue;

      switch (tw.tweenType) {
        case 'rect': {
          const g = lerpGeom(tw.from, tw.to, easedUpdate);
          snap.set(key, { type: 'rect', ...g });
          break;
        }
        case 'point': {
          const cx = tw.fromCx + (tw.toCx - tw.fromCx) * easedUpdate;
          const cy = tw.fromCy + (tw.toCy - tw.fromCy) * easedUpdate;
          const entry: SnapshotGeometry = { type: 'point', cx, cy };
          if (tw.fromR !== undefined && tw.toR !== undefined) {
            entry.r = tw.fromR + (tw.toR - tw.fromR) * easedUpdate;
          }
          snap.set(key, entry);
          break;
        }
        case 'rule':
        case 'tick': {
          snap.set(key, {
            type: tw.tweenType,
            x1: tw.fromX1 + (tw.toX1 - tw.fromX1) * easedUpdate,
            y1: tw.fromY1 + (tw.toY1 - tw.fromY1) * easedUpdate,
            x2: tw.fromX2 + (tw.toX2 - tw.fromX2) * easedUpdate,
            y2: tw.fromY2 + (tw.toY2 - tw.fromY2) * easedUpdate,
          });
          break;
        }
        case 'textMark': {
          snap.set(key, {
            type: 'textMark',
            x: tw.fromX + (tw.toX - tw.fromX) * easedUpdate,
            y: tw.fromY + (tw.toY - tw.fromY) * easedUpdate,
          });
          break;
        }
        case 'line': {
          // Freeze the current interpolated path string
          const pts = interpolatePoints(tw.fromPts, tw.toPts, easedUpdate);
          const d = buildLinePath(pts, tw.interpolate);
          snap.set(key, { type: 'line', d });
          break;
        }
        case 'area': {
          const top = interpolatePoints(tw.fromTop, tw.toTop, easedUpdate);
          const bottom = interpolatePoints(tw.fromBottom, tw.toBottom, easedUpdate);
          const d = buildAreaPath(top, bottom, tw.interpolate);
          let topD: string | undefined;
          if (tw.hasStroke) {
            topD = buildLinePath(top, tw.interpolate);
          }
          snap.set(key, { type: 'area', d, topD });
          break;
        }
        case 'arc': {
          snap.set(key, {
            type: 'arc',
            ...lerpArcGeom(tw.from, tw.to, easedUpdate),
            cx: tw.fromCenter.x + (tw.toCenter.x - tw.fromCenter.x) * easedUpdate,
            cy: tw.fromCenter.y + (tw.toCenter.y - tw.fromCenter.y) * easedUpdate,
          });
          break;
        }
      }
    }
    return snap;
  }

  // In manual mode the caller drives the transition via `step()`; skip the rAF
  // clock entirely. Otherwise start the normal real-time animation.
  if (!manual) {
    rafId = requestAnimationFrame(tick);
  }

  return {
    cancel(): void {
      // Before the running check: the pulse is scheduled by finish(), so a
      // teardown after a completed transition still owes this cleanup.
      clearPulseTimer(pulsedDot);
      pulsedDot?.classList.remove(PULSE_CLASS);
      pulsedDot = null;
      if (!running) return;
      running = false;
      svg.classList.remove(TRANSITIONING_CLASS);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      snapToFinal();
      removeGhosts();
      settleCanvas();
      // Restore secondary element opacities on cancel
      for (let i = 0; i < secondaryEls.length; i++) {
        secondaryEls[i].style.opacity = secondaryOriginalOpacity[i];
      }
    },
    get running() {
      return running;
    },
    snapshot(): GeometrySnapshot {
      return captureSnapshot();
    },
    step(elapsedMs: number): boolean {
      // Apply the same per-tween state the rAF `tick` computes, at an explicit
      // time. No requestAnimationFrame — the caller (headless capture) rasterizes
      // between steps. Mirrors tick()'s body minus the rAF scheduling.
      lastElapsed = elapsedMs;
      for (const tw of tweens) {
        applyTweenState(tw, elapsedMs, update, exit, enterDelay, enterDuration);
      }
      applySecondaryOpacity(secondaryEls, elapsedMs, enterDelay, enterDuration);
      if (elapsedMs >= totalMs) {
        // Snap to exact final geometry (paths, ghosts removed) so the last frame
        // is pixel-correct, but do NOT flip `running` — the caller decides when
        // to finalize the manual run via `cancel()`.
        snapToFinal();
        removeGhosts();
        settleCanvas();
        return false;
      }
      // Manual mode rasterizes between steps with no rAF in between, so the
      // paint has to happen here or the captured frame is a stale bitmap.
      canvas?.repaint();
      return true;
    },
    totalMs,
  };
}

// ---------------------------------------------------------------------------
// Secondary element helpers
// ---------------------------------------------------------------------------

/**
 * Collect endpoint-label and mark-label groups for the blanket crossfade.
 *
 * Annotations used to be in here, which is why an annotation that was already
 * on screen blinked out and back in on every update: the blanket fade drives
 * every element it collects from opacity 0, with no notion of which ones are
 * actually new. They now go through `buildAnnotationTweens` instead, which
 * diffs them by key. Do not re-add them here -- the blanket fade runs after the
 * tweens and would clobber the keyed opacity.
 */
/**
 * Flash the sparkline's terminator dot when fresh data has finished landing.
 *
 * Real-time tiles are the one place where "something changed" is the message,
 * and on a 36px spark the geometry change is often a pixel. Only sparklines
 * pulse, only the last point dot, and only for the length of the keyframe --
 * the class is stripped afterwards so a paused feed leaves nothing animating.
 */
const PULSE_CLASS = 'oc-pulse';
const PULSE_DURATION_MS = 600;

/**
 * Pending strip-the-class timers, keyed by the dot they belong to. A tile that
 * ticks faster than the pulse would otherwise leave the previous timer running,
 * and it would strip the class out from under the pulse that replaced it.
 */
const pulseTimers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

/** Cancel a pending pulse strip, if this dot has one. */
function clearPulseTimer(dot: Element | null | undefined): void {
  if (!dot) return;
  const pending = pulseTimers.get(dot);
  if (pending !== undefined) {
    clearTimeout(pending);
    pulseTimers.delete(dot);
  }
}

function pulseSparklineTerminator(
  svg: SVGSVGElement,
  marksContainer: SVGElement | null,
): SVGElement | null {
  if (!marksContainer || svg.getAttribute('data-display') !== 'sparkline') return null;
  const dots = marksContainer.querySelectorAll('circle.oc-mark-point');
  const dot = dots[dots.length - 1] as SVGElement | undefined;
  if (!dot) return null;
  const r = dot.getAttribute('r');
  if (r) dot.style.setProperty('--oc-pulse-r', `${r}px`);
  // Restart the keyframe on a tile that ticks faster than the pulse.
  clearPulseTimer(dot);
  dot.classList.remove(PULSE_CLASS);
  void (dot as unknown as { getBoundingClientRect?: () => unknown }).getBoundingClientRect?.();
  dot.classList.add(PULSE_CLASS);
  pulseTimers.set(
    dot,
    setTimeout(() => {
      pulseTimers.delete(dot);
      dot.classList.remove(PULSE_CLASS);
    }, PULSE_DURATION_MS),
  );
  return dot;
}

export function collectSecondaryElements(svg: SVGSVGElement): SVGElement[] {
  const els: SVGElement[] = [];
  const epLabels = svg.querySelector('.oc-endpoint-labels') as SVGElement | null;
  if (epLabels) els.push(epLabels);
  const markLabels = svg.querySelector('.oc-mark-labels') as SVGElement | null;
  if (markLabels) els.push(markLabels);
  return els;
}

/** Apply delayed fade-in to secondary elements during transition. */
export function applySecondaryOpacity(
  els: SVGElement[],
  elapsed: number,
  enterDelay: number,
  enterDuration: number,
): void {
  if (els.length === 0) return;
  let t: number;
  if (elapsed < enterDelay) {
    t = 0;
  } else {
    t = Math.min((elapsed - enterDelay) / enterDuration, 1);
  }
  const opacity = String(cubicOut(t));
  for (const el of els) {
    el.style.opacity = opacity;
  }
}

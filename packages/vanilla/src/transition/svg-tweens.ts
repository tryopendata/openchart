import type {
  AreaMark,
  ChartLayout,
  GradientDef,
  LineMark,
  PointMark,
  RectMark,
  RuleMarkLayout,
  TextMarkLayout,
  TickMarkLayout,
} from '@opendata-ai/openchart-core';
import { resolveMarkFill } from '../gradient-utils';
import { renderSingleMark } from '../renderers/marks';

import type { MarkDomIndex } from './dom-index';
import { geomFromMark, normalizePointArrays } from './interpolate';
import type { GeometrySnapshot, RectGeom, Tween } from './types';

// ---------------------------------------------------------------------------
// Gradient ghost helper
// ---------------------------------------------------------------------------

/**
 * For marks with gradient fills, resolve the gradient to a url(#id) reference
 * using the ghost gradient map. This ensures ghosts reference valid gradient
 * IDs in the new SVG's <defs>.
 */
export function resolveGhostGradientFill<T extends { fill?: string | GradientDef }>(
  mark: T,
  ghostGradientMap: Map<string, string>,
): T {
  if (!mark.fill || typeof mark.fill === 'string' || ghostGradientMap.size === 0) return mark;
  const resolved = resolveMarkFill(mark.fill, ghostGradientMap);
  return { ...mark, fill: resolved };
}

// ---------------------------------------------------------------------------
// Rect tween building (extracted from original runTransition)
// ---------------------------------------------------------------------------

export function buildRectTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevRects = prevLayout.marks.filter((m): m is RectMark => m.type === 'rect');
  const nextRects = nextLayout.marks.filter((m): m is RectMark => m.type === 'rect');

  const prevByKey = new Map<string, RectMark>();
  for (const m of prevRects) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, RectMark>();
  for (const m of nextRects) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.any(key);
    if (!el) continue;

    // Retarget: use snapshot geometry if available (interrupted transition)
    let fromGeom = geomFromMark(prev);
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'rect') {
      fromGeom = { x: snap.x, y: snap.y, width: snap.width, height: snap.height };
    }

    tweens.push({
      tweenType: 'rect',
      kind: 'update',
      el,
      from: fromGeom,
      to: geomFromMark(next),
      mark: next,
    });
  }

  // Entered
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.any(key);
    if (!el) continue;

    let fromGeom: RectGeom;
    if (next.orient === 'horizontal') {
      fromGeom = { x: next.x, y: next.y, width: 0, height: next.height };
    } else {
      fromGeom = { x: next.x, y: next.y + next.height, width: next.width, height: 0 };
    }

    tweens.push({
      tweenType: 'rect',
      kind: 'enter',
      el,
      from: fromGeom,
      to: geomFromMark(next),
      mark: next,
    });
  }

  // Exited
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;
    // Resolve gradient fill for ghost if needed
    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
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
      tweenType: 'rect',
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
}

// ---------------------------------------------------------------------------
// Line tween building
// ---------------------------------------------------------------------------

export function buildLineTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevLines = prevLayout.marks.filter((m): m is LineMark => m.type === 'line');
  const nextLines = nextLayout.marks.filter((m): m is LineMark => m.type === 'line');

  const prevByKey = new Map<string, LineMark>();
  for (const m of prevLines) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, LineMark>();
  for (const m of nextLines) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated series
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.any(key);
    if (!el) continue;

    // If interrupted mid-morph, freeze the current path and crossfade
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'line') {
      // Create ghost carrying the frozen mid-morph path
      const ghost = el.cloneNode(true) as SVGElement;
      ghost.classList.add('oc-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('pointer-events', 'none');
      ghost.removeAttribute('data-key');
      const ghostPath = ghost.querySelector('path');
      if (ghostPath) ghostPath.setAttribute('d', snap.d);
      marksContainer.appendChild(ghost);
      ghosts.push(ghost);

      tweens.push({
        tweenType: 'line',
        kind: 'exit',
        el: ghost,
        fromPts: next.points, // placeholder, not used for path
        toPts: next.points,
        finalPoints: next.points,
        interpolate: next.interpolate,
        ghost,
        fromOpacity: 1,
        toOpacity: 0,
      });

      // Fade in the new final path
      tweens.push({
        tweenType: 'line',
        kind: 'enter',
        el,
        fromPts: next.points,
        toPts: next.points,
        finalPoints: next.points,
        interpolate: next.interpolate,
        fromOpacity: 0,
        toOpacity: 1,
      });
      continue;
    }

    const prevPKs = prev.pointKeys ?? prev.points.map((_, i) => `${i}`);
    const nextPKs = next.pointKeys ?? next.points.map((_, i) => `${i}`);

    // Check if zero survivors (fully replaced dataset)
    const prevKeySet = new Set(prevPKs);
    const hasSurvivors = nextPKs.some((k) => prevKeySet.has(k));

    if (!hasSurvivors) {
      // Crossfade: fade out old (ghost), fade in new
      const ghost = renderSingleMark(prev, 0);
      if (ghost) {
        ghost.classList.add('oc-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('pointer-events', 'none');
        ghost.removeAttribute('data-key');
        marksContainer.appendChild(ghost);
        ghosts.push(ghost);

        tweens.push({
          tweenType: 'line',
          kind: 'exit',
          el: ghost,
          fromPts: prev.points,
          toPts: prev.points,
          finalPoints: prev.points,
          interpolate: prev.interpolate,
          ghost,
          fromOpacity: 1,
          toOpacity: 0,
        });
      }

      // Fade in the new one
      tweens.push({
        tweenType: 'line',
        kind: 'enter',
        el,
        fromPts: next.points,
        toPts: next.points,
        finalPoints: next.points,
        interpolate: next.interpolate,
        fromOpacity: 0,
        toOpacity: 1,
      });
    } else {
      // Normal morph with point matching
      const [fromPts, toPts] = normalizePointArrays(prev.points, next.points, prevPKs, nextPKs);

      tweens.push({
        tweenType: 'line',
        kind: 'update',
        el,
        fromPts,
        toPts,
        finalPoints: next.points,
        interpolate: next.interpolate,
      });
    }
  }

  // Entering series (only in next)
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.any(key);
    if (!el) continue;

    tweens.push({
      tweenType: 'line',
      kind: 'enter',
      el,
      fromPts: next.points,
      toPts: next.points,
      finalPoints: next.points,
      interpolate: next.interpolate,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting series (only in prev)
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'line',
      kind: 'exit',
      el: ghost,
      fromPts: prev.points,
      toPts: prev.points,
      finalPoints: prev.points,
      interpolate: prev.interpolate,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Area tween building
// ---------------------------------------------------------------------------

export function buildAreaTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevAreas = prevLayout.marks.filter((m): m is AreaMark => m.type === 'area');
  const nextAreas = nextLayout.marks.filter((m): m is AreaMark => m.type === 'area');

  const prevByKey = new Map<string, AreaMark>();
  for (const m of prevAreas) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, AreaMark>();
  for (const m of nextAreas) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated series
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.any(key);
    if (!el) continue;

    // If interrupted mid-morph, freeze and crossfade
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'area') {
      const ghost = el.cloneNode(true) as SVGElement;
      ghost.classList.add('oc-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.setAttribute('pointer-events', 'none');
      ghost.removeAttribute('data-key');
      const ghostPaths = ghost.querySelectorAll('path');
      if (ghostPaths[0]) ghostPaths[0].setAttribute('d', snap.d);
      if (ghostPaths[1] && snap.topD) ghostPaths[1].setAttribute('d', snap.topD);
      marksContainer.appendChild(ghost);
      ghosts.push(ghost);

      tweens.push({
        tweenType: 'area',
        kind: 'exit',
        el: ghost,
        fromTop: next.topPoints,
        toTop: next.topPoints,
        fromBottom: next.bottomPoints,
        toBottom: next.bottomPoints,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
        ghost,
        fromOpacity: 1,
        toOpacity: 0,
      });

      tweens.push({
        tweenType: 'area',
        kind: 'enter',
        el,
        fromTop: next.topPoints,
        toTop: next.topPoints,
        fromBottom: next.bottomPoints,
        toBottom: next.bottomPoints,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
        fromOpacity: 0,
        toOpacity: 1,
      });
      continue;
    }

    const prevPKs = prev.pointKeys ?? prev.topPoints.map((_, i) => `${i}`);
    const nextPKs = next.pointKeys ?? next.topPoints.map((_, i) => `${i}`);

    const prevKeySet = new Set(prevPKs);
    const hasSurvivors = nextPKs.some((k) => prevKeySet.has(k));

    if (!hasSurvivors) {
      // Crossfade
      const ghost = renderSingleMark(prev, 0);
      if (ghost) {
        ghost.classList.add('oc-ghost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.setAttribute('pointer-events', 'none');
        ghost.removeAttribute('data-key');
        marksContainer.appendChild(ghost);
        ghosts.push(ghost);

        tweens.push({
          tweenType: 'area',
          kind: 'exit',
          el: ghost,
          fromTop: prev.topPoints,
          toTop: prev.topPoints,
          fromBottom: prev.bottomPoints,
          toBottom: prev.bottomPoints,
          finalTopPoints: prev.topPoints,
          finalBottomPoints: prev.bottomPoints,
          interpolate: prev.interpolate,
          hasStroke: !!prev.stroke && !!prev.topPath,
          ghost,
          fromOpacity: 1,
          toOpacity: 0,
        });
      }

      tweens.push({
        tweenType: 'area',
        kind: 'enter',
        el,
        fromTop: next.topPoints,
        toTop: next.topPoints,
        fromBottom: next.bottomPoints,
        toBottom: next.bottomPoints,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
        fromOpacity: 0,
        toOpacity: 1,
      });
    } else {
      // Morph
      const [fromTop, toTop] = normalizePointArrays(
        prev.topPoints,
        next.topPoints,
        prevPKs,
        nextPKs,
      );
      const [fromBottom, toBottom] = normalizePointArrays(
        prev.bottomPoints,
        next.bottomPoints,
        prevPKs,
        nextPKs,
      );

      tweens.push({
        tweenType: 'area',
        kind: 'update',
        el,
        fromTop,
        toTop,
        fromBottom,
        toBottom,
        finalTopPoints: next.topPoints,
        finalBottomPoints: next.bottomPoints,
        interpolate: next.interpolate,
        hasStroke: !!next.stroke && !!next.topPath,
      });
    }
  }

  // Entering series
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.any(key);
    if (!el) continue;

    tweens.push({
      tweenType: 'area',
      kind: 'enter',
      el,
      fromTop: next.topPoints,
      toTop: next.topPoints,
      fromBottom: next.bottomPoints,
      toBottom: next.bottomPoints,
      finalTopPoints: next.topPoints,
      finalBottomPoints: next.bottomPoints,
      interpolate: next.interpolate,
      hasStroke: !!next.stroke && !!next.topPath,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting series
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'area',
      kind: 'exit',
      el: ghost,
      fromTop: prev.topPoints,
      toTop: prev.topPoints,
      fromBottom: prev.bottomPoints,
      toBottom: prev.bottomPoints,
      finalTopPoints: prev.topPoints,
      finalBottomPoints: prev.bottomPoints,
      interpolate: prev.interpolate,
      hasStroke: !!prev.stroke && !!prev.topPath,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Point tween building (scatter/dot/line overlay circle marks)
// ---------------------------------------------------------------------------

export function buildPointTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  ghostGradientMap: Map<string, string>,
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevPoints = prevLayout.marks.filter((m): m is PointMark => m.type === 'point');
  const nextPoints = nextLayout.marks.filter((m): m is PointMark => m.type === 'point');

  const prevByKey = new Map<string, PointMark>();
  for (const m of prevPoints) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, PointMark>();
  for (const m of nextPoints) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated points: tween cx/cy/r
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.point(key);
    if (!el) continue;

    // Read the element's current opacity attribute (NOT style.opacity)
    // to detect suppressed points (opacity="0" set by renderer for endpoint markers)
    const renderedOpacity = el.getAttribute('opacity');
    const isSuppressed = renderedOpacity === '0';

    // Retarget from snapshot if interrupted
    let fromCx = prev.cx;
    let fromCy = prev.cy;
    let fromR = prev.r !== next.r ? prev.r : undefined;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'point') {
      fromCx = snap.cx;
      fromCy = snap.cy;
      if (snap.r !== undefined && snap.r !== next.r) {
        fromR = snap.r;
      }
    }

    tweens.push({
      tweenType: 'point',
      kind: 'update',
      el,
      fromCx,
      fromCy,
      toCx: next.cx,
      toCy: next.cy,
      fromR: fromR,
      toR: fromR !== undefined ? next.r : undefined,
      // Do NOT tween opacity for updated points - preserve renderer state
      suppressedOpacity: isSuppressed ? '0' : undefined,
    });
  }

  // Entering points: fade in
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.point(key);
    if (!el) continue;

    // Read rendered opacity for the final value
    const renderedOpacity = el.getAttribute('opacity');
    const targetOpacity = renderedOpacity != null ? Number(renderedOpacity) : 1;

    tweens.push({
      tweenType: 'point',
      kind: 'enter',
      el,
      fromCx: next.cx,
      fromCy: next.cy,
      toCx: next.cx,
      toCy: next.cy,
      fromOpacity: 0,
      toOpacity: targetOpacity,
      suppressedOpacity: renderedOpacity === '0' ? '0' : undefined,
    });
  }

  // Exiting points: ghost fade out
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;

    const ghostMark = resolveGhostGradientFill(prev, ghostGradientMap);
    const ghost = renderSingleMark(ghostMark, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);

    tweens.push({
      tweenType: 'point',
      kind: 'exit',
      el: ghost,
      fromCx: prev.cx,
      fromCy: prev.cy,
      toCx: prev.cx,
      toCy: prev.cy,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Rule tween building
// ---------------------------------------------------------------------------

export function buildRuleTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevRules = prevLayout.marks.filter((m): m is RuleMarkLayout => m.type === 'rule');
  const nextRules = nextLayout.marks.filter((m): m is RuleMarkLayout => m.type === 'rule');

  const prevByKey = new Map<string, RuleMarkLayout>();
  for (const m of prevRules) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, RuleMarkLayout>();
  for (const m of nextRules) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.rule(key);
    if (!el) continue;

    let fromX1 = prev.x1;
    let fromY1 = prev.y1;
    let fromX2 = prev.x2;
    let fromY2 = prev.y2;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'rule') {
      fromX1 = snap.x1;
      fromY1 = snap.y1;
      fromX2 = snap.x2;
      fromY2 = snap.y2;
    }

    tweens.push({
      tweenType: 'rule',
      kind: 'update',
      el,
      fromX1,
      fromY1,
      fromX2,
      fromY2,
      toX1: next.x1,
      toY1: next.y1,
      toX2: next.x2,
      toY2: next.y2,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.rule(key);
    if (!el) continue;
    tweens.push({
      tweenType: 'rule',
      kind: 'enter',
      el,
      fromX1: next.x1,
      fromY1: next.y1,
      fromX2: next.x2,
      fromY2: next.y2,
      toX1: next.x1,
      toY1: next.y1,
      toX2: next.x2,
      toY2: next.y2,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;
    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);
    tweens.push({
      tweenType: 'rule',
      kind: 'exit',
      el: ghost,
      fromX1: prev.x1,
      fromY1: prev.y1,
      fromX2: prev.x2,
      fromY2: prev.y2,
      toX1: prev.x1,
      toY1: prev.y1,
      toX2: prev.x2,
      toY2: prev.y2,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Tick tween building
// ---------------------------------------------------------------------------

export function buildTickTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevTicks = prevLayout.marks.filter((m): m is TickMarkLayout => m.type === 'tick');
  const nextTicks = nextLayout.marks.filter((m): m is TickMarkLayout => m.type === 'tick');

  const prevByKey = new Map<string, TickMarkLayout>();
  for (const m of prevTicks) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, TickMarkLayout>();
  for (const m of nextTicks) {
    if (m.key) nextByKey.set(m.key, m);
  }

  function tickEndpoints(t: TickMarkLayout) {
    const half = t.length / 2;
    if (t.orient === 'vertical') {
      return { x1: t.x, y1: t.y - half, x2: t.x, y2: t.y + half };
    }
    return { x1: t.x - half, y1: t.y, x2: t.x + half, y2: t.y };
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.tick(key);
    if (!el) continue;
    let pEnd = tickEndpoints(prev);
    const nEnd = tickEndpoints(next);
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'tick') {
      pEnd = { x1: snap.x1, y1: snap.y1, x2: snap.x2, y2: snap.y2 };
    }
    tweens.push({
      tweenType: 'tick',
      kind: 'update',
      el,
      fromX1: pEnd.x1,
      fromY1: pEnd.y1,
      fromX2: pEnd.x2,
      fromY2: pEnd.y2,
      toX1: nEnd.x1,
      toY1: nEnd.y1,
      toX2: nEnd.x2,
      toY2: nEnd.y2,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.tick(key);
    if (!el) continue;
    const nEnd = tickEndpoints(next);
    tweens.push({
      tweenType: 'tick',
      kind: 'enter',
      el,
      fromX1: nEnd.x1,
      fromY1: nEnd.y1,
      fromX2: nEnd.x2,
      fromY2: nEnd.y2,
      toX1: nEnd.x1,
      toY1: nEnd.y1,
      toX2: nEnd.x2,
      toY2: nEnd.y2,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;
    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);
    const pEnd = tickEndpoints(prev);
    tweens.push({
      tweenType: 'tick',
      kind: 'exit',
      el: ghost,
      fromX1: pEnd.x1,
      fromY1: pEnd.y1,
      fromX2: pEnd.x2,
      fromY2: pEnd.y2,
      toX1: pEnd.x1,
      toY1: pEnd.y1,
      toX2: pEnd.x2,
      toY2: pEnd.y2,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

// ---------------------------------------------------------------------------
// Text mark tween building
// ---------------------------------------------------------------------------

export function buildTextMarkTweens(
  prevLayout: ChartLayout,
  nextLayout: ChartLayout,
  marksContainer: SVGElement,
  dom: MarkDomIndex,
  tweens: Tween[],
  ghosts: SVGElement[],
  fromSnapshot?: GeometrySnapshot,
): void {
  const prevTexts = prevLayout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');
  const nextTexts = nextLayout.marks.filter((m): m is TextMarkLayout => m.type === 'textMark');

  const prevByKey = new Map<string, TextMarkLayout>();
  for (const m of prevTexts) {
    if (m.key) prevByKey.set(m.key, m);
  }
  const nextByKey = new Map<string, TextMarkLayout>();
  for (const m of nextTexts) {
    if (m.key) nextByKey.set(m.key, m);
  }

  // Updated
  for (const [key, next] of nextByKey) {
    const prev = prevByKey.get(key);
    if (!prev) continue;
    const el = dom.text(key);
    if (!el) continue;

    let fromX = prev.x;
    let fromY = prev.y;
    const snap = fromSnapshot?.get(key);
    if (snap && snap.type === 'textMark') {
      fromX = snap.x;
      fromY = snap.y;
    }

    tweens.push({
      tweenType: 'textMark',
      kind: 'update',
      el,
      fromX,
      fromY,
      toX: next.x,
      toY: next.y,
    });
  }

  // Entering
  for (const [key, next] of nextByKey) {
    if (prevByKey.has(key)) continue;
    const el = dom.text(key);
    if (!el) continue;
    tweens.push({
      tweenType: 'textMark',
      kind: 'enter',
      el,
      fromX: next.x,
      fromY: next.y,
      toX: next.x,
      toY: next.y,
      fromOpacity: 0,
      toOpacity: 1,
    });
  }

  // Exiting
  for (const [key, prev] of prevByKey) {
    if (nextByKey.has(key)) continue;
    const ghost = renderSingleMark(prev, 0);
    if (!ghost) continue;
    ghost.classList.add('oc-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('pointer-events', 'none');
    ghost.removeAttribute('data-key');
    marksContainer.appendChild(ghost);
    ghosts.push(ghost);
    tweens.push({
      tweenType: 'textMark',
      kind: 'exit',
      el: ghost,
      fromX: prev.x,
      fromY: prev.y,
      toX: prev.x,
      toY: prev.y,
      ghost,
      fromOpacity: 1,
      toOpacity: 0,
    });
  }
}

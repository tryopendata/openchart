import { interpolateRgb } from 'd3-interpolate';
import { cubicOut } from '../motion/easing';

import {
  applyCanvasGridlinesState,
  applyCanvasPointsState,
  snapCanvasGridlinesToFinal,
  snapCanvasPointsToFinal,
} from './canvas-tweens';
import {
  applyAreaPaths,
  applyGeomToElement,
  applyLinePath,
  interpolatePoints,
  lerpGeom,
} from './interpolate';
import type { Tween } from './types';

/** Get the data-key for a tween's element (used for snapshot keying). */
export function getKeyForTween(tw: Tween): string | null {
  // Canvas points are keyed per-point inside the record, not per-element.
  if (tw.tweenType === 'canvasPoints' || tw.tweenType === 'canvasGridlines') return null;
  if ('ghost' in tw && tw.ghost) return null; // ghosts don't carry keys
  return tw.el.getAttribute('data-key');
}

// ---------------------------------------------------------------------------
// Tween state application (shared across all tween types)
// ---------------------------------------------------------------------------

export function resolveLineElement(el: SVGElement): SVGElement {
  return el.tagName === 'line' ? el : ((el.querySelector('line') as SVGElement) ?? el);
}

export function applyTweenState(
  tw: Tween,
  elapsed: number,
  update: { duration: number },
  exit: { duration: number },
  enterDelay: number,
  enterDuration: number,
): void {
  // Canvas points carry all three phases in one record and have no element for
  // the shared geometry/opacity steps below to write to, so they short-circuit.
  if (tw.tweenType === 'canvasPoints') {
    applyCanvasPointsState(tw, elapsed, update, exit, enterDelay, enterDuration);
    return;
  }
  if (tw.tweenType === 'canvasGridlines') {
    applyCanvasGridlinesState(tw, elapsed, update, enterDelay, enterDuration);
    return;
  }

  let tLocal: number;

  if (tw.kind === 'exit') {
    tLocal = Math.min(elapsed / exit.duration, 1);
  } else if (tw.kind === 'enter') {
    if (elapsed < enterDelay) {
      tLocal = 0;
    } else {
      tLocal = Math.min((elapsed - enterDelay) / enterDuration, 1);
    }
  } else {
    tLocal = Math.min(elapsed / update.duration, 1);
  }

  const eased = cubicOut(tLocal);

  switch (tw.tweenType) {
    case 'rect': {
      const geom = lerpGeom(tw.from, tw.to, eased);
      applyGeomToElement(tw.el, geom, tw.mark);
      break;
    }
    case 'line': {
      const pts = interpolatePoints(tw.fromPts, tw.toPts, eased);
      applyLinePath(tw.el, pts, tw.interpolate);
      break;
    }
    case 'area': {
      const top = interpolatePoints(tw.fromTop, tw.toTop, eased);
      const bottom = interpolatePoints(tw.fromBottom, tw.toBottom, eased);
      applyAreaPaths(tw.el, top, bottom, tw.interpolate, tw.hasStroke);
      break;
    }
    case 'point': {
      const cx = tw.fromCx + (tw.toCx - tw.fromCx) * eased;
      const cy = tw.fromCy + (tw.toCy - tw.fromCy) * eased;
      tw.el.setAttribute('cx', String(cx));
      tw.el.setAttribute('cy', String(cy));
      if (tw.fromR !== undefined && tw.toR !== undefined) {
        const r = tw.fromR + (tw.toR - tw.fromR) * eased;
        tw.el.setAttribute('r', String(r));
      }
      break;
    }
    case 'rule':
    case 'tick': {
      const lineEl = resolveLineElement(tw.el);
      lineEl.setAttribute('x1', String(tw.fromX1 + (tw.toX1 - tw.fromX1) * eased));
      lineEl.setAttribute('y1', String(tw.fromY1 + (tw.toY1 - tw.fromY1) * eased));
      lineEl.setAttribute('x2', String(tw.fromX2 + (tw.toX2 - tw.fromX2) * eased));
      lineEl.setAttribute('y2', String(tw.fromY2 + (tw.toY2 - tw.fromY2) * eased));
      break;
    }
    case 'textMark': {
      const x = tw.fromX + (tw.toX - tw.fromX) * eased;
      const y = tw.fromY + (tw.toY - tw.fromY) * eased;
      tw.el.setAttribute('x', String(x));
      tw.el.setAttribute('y', String(y));
      break;
    }
    case 'axisTick': {
      if (tw.crossfade) {
        // Crossfade: only tween opacity, don't move
        break;
      }
      const pos = tw.fromPos + (tw.toPos - tw.fromPos) * eased;
      if (tw.posAttr === 'x') {
        tw.el.setAttribute('x', String(pos));
      } else {
        tw.el.setAttribute('y', String(pos));
      }
      break;
    }
    case 'gridline': {
      const pos = tw.fromPos + (tw.toPos - tw.fromPos) * eased;
      if (tw.orientation === 'y') {
        // Horizontal gridline: y1 and y2 share the same position
        tw.el.setAttribute('y1', String(pos));
        tw.el.setAttribute('y2', String(pos));
      } else {
        // Vertical gridline: x1 and x2 share the same position
        tw.el.setAttribute('x1', String(pos));
        tw.el.setAttribute('x2', String(pos));
      }
      break;
    }
    case 'color': {
      tw.el.setAttribute(tw.attr, interpolateRgb(tw.from, tw.to)(eased));
      break;
    }
    case 'annotation': {
      // Ease the offset back to zero: the group is already rendered at its
      // final position, so (0,0) is the destination. SVG transform attribute,
      // not CSS -- CSS transform would replace any SVG transform attribute
      // (see .claude/rules/svg-animation.md), and this composes cleanly since
      // the annotations renderer sets none.
      const dx = tw.fromDx * (1 - eased);
      const dy = tw.fromDy * (1 - eased);
      if (dx !== 0 || dy !== 0) {
        tw.el.setAttribute('transform', `translate(${dx} ${dy})`);
      }
      break;
    }
  }

  // Apply opacity interpolation if defined
  if (tw.fromOpacity !== undefined && tw.toOpacity !== undefined) {
    const opacity = tw.fromOpacity + (tw.toOpacity - tw.fromOpacity) * eased;
    tw.el.style.opacity = String(opacity);
  }
}

export function snapTweenToFinal(tw: Tween): void {
  // No element; the shared opacity/suppressed-point steps below would throw.
  if (tw.tweenType === 'canvasPoints') {
    snapCanvasPointsToFinal(tw);
    return;
  }
  if (tw.tweenType === 'canvasGridlines') {
    snapCanvasGridlinesToFinal(tw);
    return;
  }

  switch (tw.tweenType) {
    case 'rect':
      applyGeomToElement(tw.el, tw.to, tw.mark);
      break;
    case 'line':
      applyLinePath(tw.el, tw.toPts, tw.interpolate);
      break;
    case 'area':
      applyAreaPaths(tw.el, tw.toTop, tw.toBottom, tw.interpolate, tw.hasStroke);
      break;
    case 'point':
      tw.el.setAttribute('cx', String(tw.toCx));
      tw.el.setAttribute('cy', String(tw.toCy));
      if (tw.toR !== undefined) {
        tw.el.setAttribute('r', String(tw.toR));
      }
      break;
    case 'rule':
    case 'tick': {
      const lineEl = resolveLineElement(tw.el);
      lineEl.setAttribute('x1', String(tw.toX1));
      lineEl.setAttribute('y1', String(tw.toY1));
      lineEl.setAttribute('x2', String(tw.toX2));
      lineEl.setAttribute('y2', String(tw.toY2));
      break;
    }
    case 'textMark':
      tw.el.setAttribute('x', String(tw.toX));
      tw.el.setAttribute('y', String(tw.toY));
      break;
    case 'axisTick':
      if (!tw.crossfade) {
        if (tw.posAttr === 'x') {
          tw.el.setAttribute('x', String(tw.toPos));
        } else {
          tw.el.setAttribute('y', String(tw.toPos));
        }
      }
      break;
    case 'gridline':
      if (tw.orientation === 'y') {
        tw.el.setAttribute('y1', String(tw.toPos));
        tw.el.setAttribute('y2', String(tw.toPos));
      } else {
        tw.el.setAttribute('x1', String(tw.toPos));
        tw.el.setAttribute('x2', String(tw.toPos));
      }
      break;
    case 'color':
      tw.el.setAttribute(tw.attr, tw.to);
      break;
    case 'annotation':
      // The group is rendered at its final position; drop the offset entirely
      // rather than writing translate(0 0), so the DOM returns to the exact
      // shape render() produced.
      tw.el.removeAttribute('transform');
      break;
  }

  if (tw.toOpacity !== undefined) {
    tw.el.style.opacity = String(tw.toOpacity);
  }

  // Restore suppressed-point opacity
  if (tw.tweenType === 'point' && tw.suppressedOpacity !== undefined) {
    tw.el.setAttribute('opacity', tw.suppressedOpacity);
  }
}

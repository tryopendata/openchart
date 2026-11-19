/**
 * Map update transition: the geo map's adapter onto the shared keyed element
 * tween (`motion/element-tween.ts`).
 *
 * Captures current fill colors (and, for the point layer, radius, center and
 * the point element itself) before a re-render, then hands the from/to pairs to
 * `runElementTweens`, which owns timing (`update.ease`/spring and the exit
 * phase), the synchronous from-state, ghosts and cancellation.
 *
 * Features tween fill only: their geometry is a projected path, and morphing
 * one path `d` string into another is the intractable case the chart driver
 * handles with freeze-and-crossfade. Points are bare circles, so `r`/`cx`/`cy`
 * are three numbers that interpolate directly. Entering points fade in;
 * removed points leave a fading ghost.
 */

import { findGeoViewScene } from './map-view-renderer';
import {
  type ElementTween,
  type ElementTweenHandle,
  type ElementTweenOptions,
  makeGhost,
  numAttr,
  runElementTweens,
} from './motion/element-tween';

/** Per-point geometry captured alongside fill so it can be tweened. */
export interface MapPointSnapshot {
  fill?: string;
  r?: number;
  cx?: number;
  cy?: number;
  /** Opacity attribute as drawn (an in-flight enter fade writes it). */
  opacity?: string | null;
  /**
   * The live point. The re-render detaches the old SVG intact, so this stays
   * the exit ghost's source without a clone per point per update; `makeGhost`
   * clones it only when the point is actually removed.
   */
  el?: Element;
  /** The geo view the point was drawn in (`data-geo-view-id`), null outside views. */
  viewId?: string | null;
}

export interface MapTransitionSnapshot {
  /** Feature fills, keyed by `data-key`. */
  fills: Map<string, string>;
  /** Point fill + geometry, keyed by `data-point-key`. */
  points: Map<string, MapPointSnapshot>;
}

const POINT_GEOMETRY = ['r', 'cx', 'cy'] as const;

/**
 * Snapshot the current paint/geometry of a rendered map.
 *
 * Point keys are stored in their own map rather than being namespaced into the
 * feature map, so a point and a feature that happen to share an id can't
 * collide.
 */
export function captureMapSnapshot(svg: SVGElement | null): MapTransitionSnapshot {
  const fills = new Map<string, string>();
  const points = new Map<string, MapPointSnapshot>();
  if (!svg) return { fills, points };

  const paths = svg.querySelectorAll('.oc-map-feature[data-key]');
  for (const p of paths) {
    const key = p.getAttribute('data-key');
    const fill = p.getAttribute('fill');
    if (key && fill) fills.set(key, fill);
  }

  const pts = svg.querySelectorAll('.oc-map-point[data-point-key]');
  for (const p of pts) {
    const key = p.getAttribute('data-point-key');
    if (key === null) continue;
    points.set(key, {
      fill: p.getAttribute('fill') ?? undefined,
      r: numAttr(p, 'r'),
      cx: numAttr(p, 'cx'),
      cy: numAttr(p, 'cy'),
      opacity: p.getAttribute('opacity'),
      el: p,
      viewId: p.closest('[data-geo-view-id]')?.getAttribute('data-geo-view-id') ?? null,
    });
  }

  return { fills, points };
}

function restoreDrawn(ghost: Element, drawn: MapPointSnapshot): void {
  // A url() paint never tweens (so it is already as drawn), and makeGhost has
  // re-homed it onto the new SVG's defs: leave it.
  if (drawn.fill !== undefined && !drawn.fill.includes('url(')) {
    ghost.setAttribute('fill', drawn.fill);
  }
  for (const attr of POINT_GEOMETRY) {
    const value = drawn[attr];
    if (value !== undefined) ghost.setAttribute(attr, String(value));
  }
  if (drawn.opacity === null) ghost.removeAttribute('opacity');
  else if (drawn.opacity !== undefined) ghost.setAttribute('opacity', drawn.opacity);
}

/** Where a removed point's ghost goes: its view's camera, beside the live points. */
function ghostParent(svg: SVGElement, viewId: string | null | undefined): Element | null {
  const scope = viewId ? findGeoViewScene(svg, viewId) : svg;
  const camera = scope?.querySelector('[data-oc-map-camera]');
  if (!camera) return null;
  for (const child of camera.children) {
    if (child.classList.contains('oc-map-points')) return child;
  }
  return camera;
}

/**
 * Tween a re-rendered map from a previous snapshot to its current state.
 *
 * The SVG is already rendered in its final state when this is called; the
 * element tween writes every from-value back synchronously before the first
 * frame, so the first painted frame never shows the final state.
 */
export function runMapFillTransition(
  svg: SVGElement,
  snapshot: MapTransitionSnapshot,
  opts: ElementTweenOptions,
): ElementTweenHandle {
  const tweens: ElementTween[] = [];

  const features = svg.querySelectorAll('.oc-map-feature[data-key]');
  for (const p of features) {
    const key = p.getAttribute('data-key');
    const to = p.getAttribute('fill');
    const from = key ? snapshot.fills.get(key) : undefined;
    // A url() paint on either side snaps inside the element tween.
    if (from && to && from !== to) tweens.push({ kind: 'color', el: p, attr: 'fill', from, to });
  }

  const kept = new Set<string>();
  const points = svg.querySelectorAll('.oc-map-point[data-point-key]');
  for (const p of points) {
    const key = p.getAttribute('data-point-key');
    if (key === null) continue;
    const before = snapshot.points.get(key);
    if (!before) {
      tweens.push({ kind: 'enter', el: p });
      continue;
    }
    kept.add(key);

    const toFill = p.getAttribute('fill');
    if (before.fill && toFill && before.fill !== toFill) {
      tweens.push({ kind: 'color', el: p, attr: 'fill', from: before.fill, to: toFill });
    }

    // Radius and center: a step that re-encodes the size channel, or one that
    // shifts the projection, moves these. Without tweening them the dots snap
    // to their new size/place while the color eases, which reads as a reset
    // rather than a transition.
    for (const attr of POINT_GEOMETRY) {
      const from = before[attr];
      const to = numAttr(p, attr);
      if (from === undefined || to === undefined || from === to) continue;
      tweens.push({ kind: 'number', el: p, attr, from, to });
    }
  }

  for (const [key, before] of snapshot.points) {
    if (kept.has(key) || !before.el) continue;
    const parent = ghostParent(svg, before.viewId);
    if (!parent) continue;
    const ghost = makeGhost(before.el, parent);
    // Keyed lookups (the next snapshot, hover) must never find the ghost.
    ghost.removeAttribute('data-point-key');
    // Cancelling an interrupted tween snapped the old point to its final
    // state; the ghost leaves from where it was drawn at capture.
    restoreDrawn(ghost, before);
    tweens.push({ kind: 'exit', ghost });
  }

  return runElementTweens(tweens, opts);
}

/**
 * Map update transition: tweens feature fills and point geometry between
 * layout snapshots.
 *
 * Captures current fill colors (and, for the point layer, radius and center)
 * before a re-render, then interpolates from previous to new values using a
 * rAF loop. Same approach as the main chart transition driver, scoped to
 * map-specific concerns.
 *
 * Features tween fill only: their geometry is a projected path, and morphing
 * one path `d` string into another is the intractable case the chart driver
 * handles with freeze-and-crossfade. Points are bare circles, so `r`/`cx`/`cy`
 * are three numbers that interpolate directly.
 */

import { interpolateRgb } from 'd3-interpolate';
import { easingFns } from './story/tween';

/** Per-point geometry captured alongside fill so it can be tweened. */
export interface MapPointSnapshot {
  fill?: string;
  r?: number;
  cx?: number;
  cy?: number;
}

export interface MapTransitionSnapshot {
  /** Feature fills, keyed by `data-key`. */
  fills: Map<string, string>;
  /** Point fill + geometry, keyed by `data-point-key`. */
  points: Map<string, MapPointSnapshot>;
}

function numAttr(el: Element, name: string): number | undefined {
  const raw = el.getAttribute(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

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
    });
  }

  return { fills, points };
}

/**
 * Back-compat shim for callers that only need feature fills.
 *
 * @deprecated Use {@link captureMapSnapshot}, which also carries point geometry.
 */
export function captureFeatureFills(svg: SVGElement | null): Map<string, string> {
  const { fills, points } = captureMapSnapshot(svg);
  const merged = new Map(fills);
  for (const [key, snap] of points) {
    if (snap.fill !== undefined) merged.set(`pt:${key}`, snap.fill);
  }
  return merged;
}

/** A single attribute being interpolated over the transition. */
type Tween =
  | { kind: 'fill'; el: Element; to: string; interp: (t: number) => string }
  | { kind: 'num'; el: Element; attr: 'r' | 'cx' | 'cy'; from: number; to: number };

function applyTween(tw: Tween, eased: number): void {
  if (tw.kind === 'fill') {
    tw.el.setAttribute('fill', tw.interp(eased));
  } else {
    tw.el.setAttribute(tw.attr, String(tw.from + (tw.to - tw.from) * eased));
  }
}

function snapTween(tw: Tween): void {
  if (tw.kind === 'fill') {
    tw.el.setAttribute('fill', tw.to);
  } else {
    tw.el.setAttribute(tw.attr, String(tw.to));
  }
}

/**
 * Tween a re-rendered map from a previous snapshot to its current state.
 *
 * The SVG is already rendered in its final state when this is called, so every
 * from-value is written back synchronously before the first frame. Without that
 * the first painted frame would show the final state and the transition would
 * read as a snap (the same synchronous from-state rule the chart driver uses).
 */
export function runMapFillTransition(
  svg: SVGElement,
  prev: MapTransitionSnapshot | Map<string, string>,
  opts: { duration: number },
): { cancel: () => void } {
  // Accept the legacy flat fill map so external callers keep working.
  const snapshot: MapTransitionSnapshot =
    prev instanceof Map
      ? {
          fills: prev,
          points: new Map(
            Array.from(prev)
              .filter(([k]) => k.startsWith('pt:'))
              .map(([k, fill]) => [k.slice(3), { fill }]),
          ),
        }
      : prev;

  const tweens: Tween[] = [];

  const features = svg.querySelectorAll('.oc-map-feature[data-key]');
  for (const p of features) {
    const key = p.getAttribute('data-key');
    const to = p.getAttribute('fill');
    const from = key ? snapshot.fills.get(key) : undefined;
    if (from && to && from !== to) {
      tweens.push({ kind: 'fill', el: p, to, interp: interpolateRgb(from, to) });
      p.setAttribute('fill', from);
    }
  }

  const points = svg.querySelectorAll('.oc-map-point[data-point-key]');
  for (const p of points) {
    const key = p.getAttribute('data-point-key');
    const before = key === null ? undefined : snapshot.points.get(key);
    if (!before) continue;

    const toFill = p.getAttribute('fill');
    if (before.fill && toFill && before.fill !== toFill) {
      tweens.push({
        kind: 'fill',
        el: p,
        to: toFill,
        interp: interpolateRgb(before.fill, toFill),
      });
      p.setAttribute('fill', before.fill);
    }

    // Radius and center: a step that re-encodes the size channel, or one that
    // shifts the projection, moves these. Without tweening them the dots snap
    // to their new size/place while the color eases, which reads as a reset
    // rather than a transition.
    for (const attr of ['r', 'cx', 'cy'] as const) {
      const from = before[attr];
      const to = numAttr(p, attr);
      if (from === undefined || to === undefined || from === to) continue;
      tweens.push({ kind: 'num', el: p, attr, from, to });
      p.setAttribute(attr, String(from));
    }
  }

  if (tweens.length === 0 || opts.duration <= 0) {
    for (const tw of tweens) snapTween(tw);
    return { cancel: () => {} };
  }

  const duration = opts.duration;
  let startTime: number | null = null;
  let rafId = 0;
  let cancelled = false;

  function tick(now: number) {
    if (cancelled) return;
    if (startTime === null) startTime = now;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const eased = easingFns.easeInOutCubic(t);

    for (const tw of tweens) {
      applyTween(tw, eased);
    }

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    }
  }

  rafId = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      cancelAnimationFrame(rafId);
      // Snap to final state
      for (const tw of tweens) {
        snapTween(tw);
      }
    },
  };
}

/**
 * Map fill transition: tweens feature fills between layout snapshots.
 *
 * Captures current fill colors before a re-render, then interpolates
 * from previous to new fills using a rAF loop. Same approach as the
 * main chart transition driver, but scoped to map-specific concerns
 * (no geometry tweening, just color).
 */

import { interpolateRgb } from 'd3-interpolate';
import { easingFns } from './story/tween';

export function captureFeatureFills(svg: SVGElement | null): Map<string, string> {
  const fills = new Map<string, string>();
  if (!svg) return fills;
  const paths = svg.querySelectorAll('.oc-map-feature[data-key]');
  for (const p of paths) {
    const key = p.getAttribute('data-key');
    const fill = p.getAttribute('fill');
    if (key && fill) fills.set(key, fill);
  }
  return fills;
}

export function runMapFillTransition(
  svg: SVGElement,
  prevFills: Map<string, string>,
  opts: { duration: number },
): { cancel: () => void } {
  const paths = svg.querySelectorAll('.oc-map-feature[data-key]');
  const tweens: Array<{ el: Element; from: string; to: string; interp: (t: number) => string }> =
    [];

  for (const p of paths) {
    const key = p.getAttribute('data-key');
    const to = p.getAttribute('fill');
    const from = key ? prevFills.get(key) : null;
    if (from && to && from !== to) {
      tweens.push({ el: p, from, to, interp: interpolateRgb(from, to) });
      // Synchronous from-state: set previous fill before first rAF
      p.setAttribute('fill', from);
    }
  }

  if (tweens.length === 0 || opts.duration <= 0) {
    for (const tw of tweens) tw.el.setAttribute('fill', tw.to);
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
      tw.el.setAttribute('fill', tw.interp(eased));
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
        tw.el.setAttribute('fill', tw.to);
      }
    },
  };
}

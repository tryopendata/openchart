/**
 * Whole-chart crossfade fallback for story steps whose spec diff falls
 * outside the data-update-transitions morph gate (`canTransition` in
 * `../transition.ts`): re-encodes, type changes, and anything else that
 * would otherwise instant-snap. No step in a story may visibly snap, so
 * this ghosts the current rendered SVG over the container, lets
 * `ChartInstance.update()` perform its normal instant swap underneath,
 * then fades the ghost out to reveal the new state.
 *
 * This is deliberately NOT the mark-morphing transition driver: it never
 * interpolates geometry, only opacity. See the animation-clock ownership
 * note in the scrollytelling plan -- the transitions driver owns mark
 * morphing, this owns the pixel-level fallback when that driver declines.
 */

import { storyMotion } from './tween';

export interface CrossfadeOptions {
  /** Fade duration in ms. Default `storyMotion.crossfade`. */
  duration?: number;
  /** Skip the fade and swap instantly (reduced motion). */
  reducedMotion?: boolean;
}

/**
 * Ghost the container's current SVG, run `applyUpdate` (which mutates the
 * container to its next state), then fade the ghost out.
 */
export function crossfadeUpdate(
  container: HTMLElement,
  applyUpdate: () => void,
  options: CrossfadeOptions = {},
): void {
  const duration = options.duration ?? storyMotion.crossfade;
  const svg = container.querySelector('svg');

  if (options.reducedMotion || !svg || duration <= 0) {
    applyUpdate();
    return;
  }

  const ghost = svg.cloneNode(true) as SVGElement;
  ghost.setAttribute('aria-hidden', 'true');
  ghost.style.position = 'absolute';
  ghost.style.inset = '0';
  ghost.style.width = '100%';
  ghost.style.height = '100%';
  ghost.style.pointerEvents = 'none';
  ghost.style.transition = `opacity ${duration}ms ease-out`;
  ghost.style.opacity = '1';

  const priorPosition = container.style.position;
  container.style.position = priorPosition || 'relative';
  container.appendChild(ghost);

  applyUpdate();

  // Force layout so the transition starts from opacity: 1 before dropping.
  void ghost.getBoundingClientRect();
  ghost.style.opacity = '0';

  const cleanup = () => {
    ghost.remove();
    if (!priorPosition) container.style.position = '';
  };
  ghost.addEventListener('transitionend', cleanup, { once: true });
  // Safety net in case transitionend never fires (e.g. element removed by
  // an intervening render before the transition completes).
  setTimeout(cleanup, duration + 100);
}

/**
 * Animation runtime for entrance animations.
 *
 * All animations are CSS-driven (keyframes + clip-path + transforms + opacity).
 * This module handles lifecycle: cleanup after completion, cancellation on update.
 * No WAAPI needed since clip-path handles line/area drawing.
 */

/**
 * Cancel entrance animations and clean up.
 * Called when update() is invoked during animation, or on destroy.
 */
export function cancelAnimations(svg: SVGElement | null): void {
  if (svg) {
    svg.classList.remove('oc-animate');
  }
}

/**
 * Compute the total entrance-animation time for a rendered SVG, in ms.
 *
 * Reads the timing from the CSS custom properties the renderer stamps
 * (`--oc-animation-duration`, `--oc-animation-stagger`, `--oc-annotation-delay`)
 * and counts animated elements to derive the last element's stagger delay.
 * Formula: `totalStagger + duration + annotationDelay + 500ms buffer`.
 *
 * Shared by `setupAnimationCleanup` (to time the oc-animate removal) and by GIF
 * export (to size the capture window), so the two never drift.
 */
export function computeAnimationDuration(svg: SVGElement): number {
  const style = svg.style;
  const duration = parseFloat(style.getPropertyValue('--oc-animation-duration')) || 600;
  const stagger = parseFloat(style.getPropertyValue('--oc-animation-stagger')) || 0;
  const annotationDelay = parseFloat(style.getPropertyValue('--oc-annotation-delay')) || 200;

  const animatedElements = svg.querySelectorAll('[data-animation-index]').length;
  const totalStagger = stagger * Math.max(0, animatedElements - 1);

  return totalStagger + duration + annotationDelay + 500;
}

/**
 * Set up animation cleanup that removes oc-animate after all animations complete.
 *
 * Uses the computed total animation time (duration + stagger * elementCount + annotation delay)
 * rather than animationend events, because animationend fires per-element and the first
 * element to finish would prematurely kill staggered animations still in progress.
 */
export function setupAnimationCleanup(
  svg: SVGElement,
  onComplete?: () => void,
  totalMs?: number,
): () => void {
  // `totalMs` overrides the DOM-derived estimate. Canvas mark mode needs it:
  // computeAnimationDuration counts [data-animation-index] ELEMENTS, and canvas
  // mode emits no point elements at all, so the estimate collapses to roughly
  // one element's worth of time. The timer would then fire mid-entrance,
  // nulling cleanupAnimations, replaying a deferred resize into a teardown, and
  // letting update() past the entrance-in-flight gate while the canvas tween is
  // still writing alpha.
  const totalTime = totalMs ?? computeAnimationDuration(svg);

  const timer = setTimeout(() => {
    svg.classList.remove('oc-animate');
    onComplete?.();
  }, totalTime);

  return () => {
    clearTimeout(timer);
    cancelAnimations(svg);
  };
}

/**
 * Set up animation cleanup for table entrance animations.
 *
 * Same timeout-based approach as chart animations: compute total time from
 * CSS custom properties and row count, then remove oc-animate after completion.
 */
export function setupTableAnimationCleanup(wrapper: HTMLElement): () => void {
  const style = wrapper.style;
  const duration = parseFloat(style.getPropertyValue('--oc-animation-duration')) || 500;
  const stagger = parseFloat(style.getPropertyValue('--oc-animation-stagger')) || 0;

  const rows = wrapper.querySelectorAll('tbody tr').length;
  const totalStagger = stagger * Math.max(0, rows - 1);

  // Total: last row stagger + duration + buffer
  const totalTime = totalStagger + duration + 300;

  const timer = setTimeout(() => {
    wrapper.classList.remove('oc-animate');
  }, totalTime);

  return () => {
    clearTimeout(timer);
    wrapper.classList.remove('oc-animate');
  };
}

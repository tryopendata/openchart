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
 * Set up animation cleanup that removes oc-animate after all animations complete.
 *
 * Uses the computed total animation time (duration + stagger * elementCount + annotation delay)
 * rather than animationend events, because animationend fires per-element and the first
 * element to finish would prematurely kill staggered animations still in progress.
 */
export function setupAnimationCleanup(svg: SVGElement): () => void {
  // Read the animation timing from the CSS custom properties set by the renderer
  const style = svg.style;
  const duration = parseFloat(style.getPropertyValue('--oc-animation-duration')) || 600;
  const stagger = parseFloat(style.getPropertyValue('--oc-animation-stagger')) || 0;
  const annotationDelay = parseFloat(style.getPropertyValue('--oc-annotation-delay')) || 200;

  // Count animated elements to compute total stagger span
  const animatedElements = svg.querySelectorAll('[data-animation-index]').length;
  const totalStagger = stagger * Math.max(0, animatedElements - 1);

  // Total time: last element's stagger delay + its duration + annotation delay + buffer
  const totalTime = totalStagger + duration + annotationDelay + 500;

  const timer = setTimeout(() => {
    svg.classList.remove('oc-animate');
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

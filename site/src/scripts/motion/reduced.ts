/**
 * Whether the reader has asked for reduced motion. `withMotion` checks it before
 * loading GSAP at all, and islands check it before starting anything that moves
 * on its own. Without `matchMedia` (server rendering) motion counts as reduced,
 * so nothing is ever scheduled where it cannot run.
 */

/** The media query under which the landing page runs its timelines. */
export const MOTION_OK_QUERY = "(prefers-reduced-motion: no-preference)";

/** True when the reader prefers reduced motion, or when there is no window to ask. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return !window.matchMedia(MOTION_OK_QUERY).matches;
}

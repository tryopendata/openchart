/**
 * Shared animation CSS custom-property stamping for vanilla renderers.
 *
 * Every renderer (svg, table, tilemap, sankey, map, barlist) sets the same
 * family of `--oc-animation-*` custom properties before the element enters
 * the DOM. This centralizes that stamping so each renderer only computes
 * its own timing values and delegates the DOM writes here.
 */

/** CSS easing preset map for inline style custom properties. */
export const EASE_VAR_MAP: Record<string, string> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
};

export interface AnimationVars {
  /** Entrance animation duration, in ms. */
  duration: number;
  /** Per-item stagger delay, in ms. May be fractional (map renderer) — do NOT round. */
  stagger: number;
  /** Delay before annotations begin animating, in ms. */
  annotationDelay?: number;
  /** Easing preset name, mapped through EASE_VAR_MAP (defaults to smooth). */
  ease?: string;
  /** Per-segment duration for stacked bar sequencing, in ms (svg-renderer only). */
  stackSegmentDuration?: number;
}

/** Stamp animation CSS custom properties onto an element's inline style. */
export function stampAnimationVars(el: ElementCSSInlineStyle, v: AnimationVars): void {
  el.style.setProperty('--oc-animation-duration', `${v.duration}ms`);
  el.style.setProperty('--oc-animation-stagger', `${v.stagger}ms`);
  if (v.annotationDelay !== undefined) {
    el.style.setProperty('--oc-annotation-delay', `${v.annotationDelay}ms`);
  }
  if (v.ease !== undefined) {
    el.style.setProperty('--oc-animation-ease', EASE_VAR_MAP[v.ease] || EASE_VAR_MAP.smooth);
  }
  if (v.stackSegmentDuration !== undefined) {
    el.style.setProperty('--oc-stack-segment-duration', `${v.stackSegmentDuration}ms`);
  }
}

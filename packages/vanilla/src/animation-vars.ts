import {
  type AnimationEase,
  entranceAnchorVars,
  motionCSS,
  type SpringConfig,
} from '@opendata-ai/openchart-core';

/**
 * Shared animation CSS custom-property stamping for vanilla renderers.
 *
 * Every renderer (svg, table, tilemap, sankey, map, barlist) sets the same
 * family of `--oc-animation-*` custom properties before the element enters
 * the DOM. This centralizes that stamping so each renderer only computes
 * its own timing values and delegates the DOM writes here.
 */

/** CSS easing preset map for inline style custom properties. */
export const EASE_VAR_MAP: Readonly<Record<AnimationEase, string>> = {
  smooth: 'var(--oc-ease-smooth)',
  snappy: 'var(--oc-ease-snappy)',
  gentle: 'var(--oc-ease-gentle)',
};

export interface AnimationVars {
  spring?: SpringConfig;
  /** Entrance animation duration, in ms. */
  duration: number;
  /** Per-item stagger delay, in ms. May be fractional (map renderer) — do NOT round. */
  stagger: number;
  /** Delay before annotations begin animating, in ms. */
  annotationDelay?: number;
  /** Easing preset name, mapped through EASE_VAR_MAP (defaults to smooth). */
  ease?: AnimationEase;
  /** Stagger index of the last mark, so annotations wait for it. Default 0. */
  lastMarkIndex?: number;
  /** Which stylesheet's anchored roles to resolve. Default 'chart'. */
  scope?: 'chart' | 'table';
}

/**
 * Stamp animation CSS custom properties onto an element's inline style,
 * including the progress-point offsets (`--oc-<role>-after`) resolved through
 * this phase's curve, which the CSS can't compute itself.
 */
export function stampAnimationVars(el: ElementCSSInlineStyle, v: AnimationVars): void {
  el.style.setProperty('--oc-animation-duration', `${v.duration}ms`);
  el.style.setProperty('--oc-animation-stagger', `${v.stagger}ms`);
  if (v.annotationDelay !== undefined) {
    el.style.setProperty('--oc-annotation-delay', `${v.annotationDelay}ms`);
  }
  if (v.spring) {
    el.style.setProperty(
      '--oc-animation-ease',
      motionCSS({ duration: v.duration, spring: v.spring }),
    );
  } else if (v.ease !== undefined) {
    el.style.setProperty('--oc-animation-ease', EASE_VAR_MAP[v.ease] || EASE_VAR_MAP.smooth);
  }
  const anchors = entranceAnchorVars(
    { duration: v.duration, spring: v.spring, ease: v.ease },
    { staggerMs: v.stagger, annotationDelayMs: v.annotationDelay, lastMarkIndex: v.lastMarkIndex },
    v.scope,
  );
  for (const [name, value] of Object.entries(anchors)) el.style.setProperty(name, value);
}

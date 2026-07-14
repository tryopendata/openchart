/** Shared small DOM helpers used across vanilla renderers. */

/**
 * Inline sr-only styles — mirrors .oc-sr-only in base.css but works without
 * the stylesheet (CDN / esm.sh usage).
 */
export function applySrOnlyStyles(el: HTMLElement): void {
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.padding = '0';
  el.style.margin = '-1px';
  el.style.overflow = 'hidden';
  el.style.clipPath = 'inset(50%)';
  el.style.whiteSpace = 'nowrap';
  el.style.borderWidth = '0';
}

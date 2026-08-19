/** Shared small DOM helpers used across vanilla renderers. */

/**
 * Inline sr-only styles — mirrors .oc-sr-only in base.css but works without
 * the stylesheet (CDN / esm.sh usage).
 *
 * `overflow: clip` rather than `hidden`: a 1x1 box wrapping taller content is a
 * scrollable scroll container under `hidden`, and Chrome makes a scroller with
 * no focusable descendants an implicit tab stop — an invisible keyboard trap.
 * `clip` never scrolls, and still keeps the descendant out of an ancestor's
 * scrollable overflow.
 */
export function applySrOnlyStyles(el: HTMLElement): void {
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.padding = '0';
  el.style.margin = '-1px';
  el.style.overflow = 'clip';
  el.style.clipPath = 'inset(50%)';
  el.style.whiteSpace = 'nowrap';
  el.style.borderWidth = '0';
}

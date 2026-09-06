/**
 * Shared SVG DOM helpers used across the per-concern renderers.
 *
 * Pure, stateless utilities. No layout/theme knowledge.
 */

import type { TextStyle } from '@opendata-ai/openchart-core';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

export function createSVGElement(tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag);
}

export function setAttrs(el: SVGElement, attrs: Record<string, string | number>): void {
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
}

/**
 * Cut a knockout halo behind text so it stays legible where it crosses
 * gridlines, marks, or a neighbouring series: a surface-colored stroke painted
 * under the glyphs.
 *
 * Presentation attributes, not inline styles, so a stylesheet can still
 * override the halo. The width scales with the font size -- a fixed width rings
 * small glyphs and disappears behind large ones.
 */
export function applyKnockoutHalo(el: SVGElement, color: string, fontSize: number): void {
  setAttrs(el, {
    stroke: color,
    'stroke-width': Math.max(1, Math.round(fontSize * 0.3)),
    'stroke-linejoin': 'round',
    'paint-order': 'stroke',
  });
}

export function applyTextStyle(el: SVGElement, style: TextStyle): void {
  // Use inline styles so engine-computed values take priority over CSS class
  // defaults (e.g. .oc-title { font-size: var(--oc-title-size) } would otherwise
  // override the responsive scaling applied by the chrome layout).
  const inline = (el as SVGElement & ElementCSSInlineStyle).style;
  inline.setProperty('fill', style.fill);
  inline.setProperty('font-size', `${style.fontSize}px`);
  inline.setProperty('font-weight', String(style.fontWeight));
  inline.setProperty('font-family', style.fontFamily);
  if (style.textAnchor) {
    el.setAttribute('text-anchor', style.textAnchor);
  }
  if (style.dominantBaseline) {
    el.setAttribute('dominant-baseline', style.dominantBaseline);
  }
  if (style.fontVariant) {
    el.setAttribute('font-variant', style.fontVariant);
  }
}

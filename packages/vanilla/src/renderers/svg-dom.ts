/**
 * Shared SVG DOM helpers used across the per-concern renderers.
 *
 * Pure, stateless utilities. No layout/theme knowledge.
 */

import type { ResolvedTheme, TextStyle } from '@opendata-ai/openchart-core';
import { cssTokenDefault } from '@opendata-ai/openchart-core';

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const XLINK_NS = 'http://www.w3.org/1999/xlink';

export interface ElementFactory {
  svg(tag: string): SVGElement;
  html(tag: string): HTMLElement;
  text(data: string): Text;
}
export const defaultElementFactory: ElementFactory = {
  svg: (tag) => document.createElementNS(SVG_NS, tag),
  html: (tag) => document.createElement(tag),
  text: (data) => document.createTextNode(data),
};
export function createSVGElement(
  tag: string,
  factory: ElementFactory = defaultElementFactory,
): SVGElement {
  return factory.svg(tag);
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
    'stroke-width': Math.round(fontSize * 0.3),
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

type RoleStyles = Record<string, Record<string, string | number>>;
function roleStyles(theme: ResolvedTheme): RoleStyles {
  const { colors, fonts, chrome } = theme;
  const muted = colors.axis;
  const accent = colors.categorical[0] ?? cssTokenDefault('--oc-accent', 'light');
  const roles: Record<string, Record<string, string | number>> = {
    'oc-chrome': { 'font-family': fonts.family },
    'oc-eyebrow': {
      'font-size': chrome.eyebrow.fontSize,
      'font-weight': chrome.eyebrow.fontWeight,
      'letter-spacing': cssTokenDefault('--oc-eyebrow-tracking', 'light'),
      fill: accent,
      'text-transform': 'uppercase',
    },
    'oc-title': {
      'font-size': chrome.title.fontSize,
      'font-weight': chrome.title.fontWeight,
      'letter-spacing': cssTokenDefault('--oc-title-tracking', 'light'),
      fill: colors.text,
    },
    'oc-subtitle': {
      'font-size': chrome.subtitle.fontSize,
      'font-weight': chrome.subtitle.fontWeight,
      fill: muted,
    },
    'oc-source': {
      'font-size': chrome.source.fontSize,
      'font-weight': chrome.source.fontWeight,
      fill: muted,
    },
    'oc-brand': {
      'font-size': 11,
      'font-weight': 500,
      'letter-spacing': '0.02em',
      fill: colors.neutral.faint,
    },
    'oc-eyebrow-dot': { fill: accent },
    'oc-metrics': { 'font-family': fonts.family },
    'oc-metric-label': {
      'font-size': 11,
      'font-weight': 500,
      'letter-spacing': '0.06em',
      'text-transform': 'uppercase',
      fill: muted,
    },
    'oc-metric-value': {
      'font-size': 22,
      'font-weight': 600,
      'letter-spacing': '-0.02em',
      fill: colors.text,
      'font-variant-numeric': 'tabular-nums',
    },
    'oc-metric-delta-up': { fill: colors.positive, 'font-size': 12, 'font-weight': 500 },
    'oc-metric-delta-down': { fill: colors.negative, 'font-size': 12, 'font-weight': 500 },
    'oc-metric-secondary': { fill: muted, 'font-size': 12, 'font-weight': 400 },
    'oc-axis-tick-inline': { 'font-size': 11, 'font-weight': 400, fill: muted },
    'oc-endpoint-labels': { 'font-family': fonts.family },
    'oc-endpoint-label': { fill: colors.text },
    'oc-endpoint-value': { fill: muted },
    'oc-endpoint-leader': { stroke: colors.text },
    'oc-annotation-subtitle': { fill: muted },
    'oc-legend': { 'font-family': fonts.family, 'font-size': fonts.sizes.body },
    'oc-legend-text': {
      fill: cssTokenDefault('--oc-legend-text', theme.isDark ? 'dark' : 'light'),
    },
  };
  roles['oc-byline'] = roles['oc-source'];
  roles['oc-footer'] = roles['oc-source'];
  return roles;
}
/** Resolve class defaults while keeping engine-authored attributes and inline styles. */
export function applyRoleStyle(
  ctx: { theme: ResolvedTheme; roleStyles?: RoleStyles },
  el: SVGElement,
  role: string,
): void {
  ctx.roleStyles ??= roleStyles(ctx.theme);
  for (const [name, value] of Object.entries(ctx.roleStyles[role] ?? {})) {
    if (name === 'text-transform' || name === 'font-variant-numeric') {
      if (!el.style.getPropertyValue(name)) el.style.setProperty(name, String(value));
    } else if (!el.hasAttribute(name)) el.setAttribute(name, String(value));
  }
}

/**
 * Theme `<style>` block for self-contained SVG export.
 *
 * Charts render most fills as inline SVG attributes, but a handful of chrome
 * elements (metric cells, the brand watermark dot, legend text, endpoint labels)
 * take their fill from CSS classes in `chrome.css` via `--oc-*` variables. That
 * works on-screen because the live SVG inherits the page stylesheet — but a
 * serialized/rasterized export (PNG/JPG/GIF) is detached from the page, so those
 * class-based fills vanish. This module builds a `<style>` block that resolves
 * every such rule against a concrete `ResolvedTheme`, so injecting it into an
 * export clone makes the SVG fully self-contained.
 *
 * Both the headless renderer (`static.ts`) and the browser export path use this,
 * so class-based styling round-trips identically no matter which path produced
 * the SVG. Browser-safe (no Node imports) so the browser exporters can import it.
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptForLightLineStroke, cssTokenDefault } from '@opendata-ai/openchart-core';
import { SVG_NS } from './renderers/svg-dom';

/**
 * Build the theme `<style>` block CSS text for a resolved theme. Sets the
 * `--oc-*` custom properties on `svg.oc-chart` and defines every class-based
 * chrome rule against them.
 */
export function buildThemeStyleBlock(theme: ResolvedTheme): string {
  const accent = theme.colors.categorical[0] ?? cssTokenDefault('--oc-accent', 'light');
  const bg =
    theme.colors.background === 'transparent'
      ? theme.isDark
        ? cssTokenDefault('--oc-bg', 'dark')
        : cssTokenDefault('--oc-bg', 'light')
      : theme.colors.background;

  const props = [
    `--oc-font-family: ${theme.fonts.family}`,
    `--oc-font-mono: ${theme.fonts.mono}`,
    `--oc-title-size: ${theme.chrome.title.fontSize}px`,
    `--oc-title-weight: ${theme.chrome.title.fontWeight}`,
    `--oc-title-tracking: ${cssTokenDefault('--oc-title-tracking', 'light')}`,
    `--oc-subtitle-size: ${theme.chrome.subtitle.fontSize}px`,
    `--oc-subtitle-weight: ${theme.chrome.subtitle.fontWeight}`,
    `--oc-source-size: ${theme.chrome.source.fontSize}px`,
    `--oc-source-weight: ${theme.chrome.source.fontWeight}`,
    `--oc-body-size: ${theme.fonts.sizes.body}px`,
    `--oc-eyebrow-size: ${theme.chrome.eyebrow.fontSize}px`,
    `--oc-eyebrow-weight: ${theme.chrome.eyebrow.fontWeight}`,
    `--oc-eyebrow-tracking: ${cssTokenDefault('--oc-eyebrow-tracking', 'light')}`,
    `--oc-bg: ${bg}`,
    `--oc-text: ${theme.colors.text}`,
    `--oc-text-muted: ${theme.colors.axis}`,
    `--oc-text-secondary: ${theme.colors.neutral.secondary}`,
    `--oc-text-faint: ${theme.colors.neutral.faint}`,
    `--oc-border: ${theme.colors.neutral.border}`,
    `--oc-gridline: ${theme.colors.gridline}`,
    // Hairline, not the tick-label ink.
    `--oc-axis: ${theme.colors.hairline}`,
    `--oc-border-radius: ${theme.borderRadius}px`,
    `--oc-accent: ${accent}`,
    `--oc-accent-strong: ${adaptForLightLineStroke(accent)}`,
    `--oc-positive: ${theme.colors.positive}`,
    `--oc-negative: ${theme.colors.negative}`,
    `--oc-legend-text: ${theme.isDark ? cssTokenDefault('--oc-legend-text', 'dark') : cssTokenDefault('--oc-legend-text', 'light')}`,
    `--oc-space-2: ${theme.spacing.chromeGap * 2}px`,
    `--oc-space-4: ${theme.spacing.padding}px`,
  ];

  const rules = [
    // Tabular figures everywhere in the chart's own text: axis ticks, value
    // labels and legend entries all line up column-wise.
    `svg.oc-chart { ${props.join('; ')}; font-variant-numeric: tabular-nums; }`,
    `.oc-chrome { font-family: var(--oc-font-family); }`,
    `.oc-eyebrow { font-size: var(--oc-eyebrow-size); font-weight: var(--oc-eyebrow-weight); letter-spacing: var(--oc-eyebrow-tracking); text-transform: uppercase; fill: var(--oc-accent); }`,
    `.oc-title { font-size: var(--oc-title-size); font-weight: var(--oc-title-weight); letter-spacing: var(--oc-title-tracking); fill: var(--oc-text); }`,
    `.oc-subtitle { font-size: var(--oc-subtitle-size); font-weight: var(--oc-subtitle-weight); fill: var(--oc-text-muted); }`,
    `.oc-source, .oc-byline, .oc-footer { font-size: var(--oc-source-size); font-weight: var(--oc-source-weight); fill: var(--oc-text-muted); }`,
    `.oc-brand { font-size: 11px; font-weight: 500; letter-spacing: 0.02em; fill: var(--oc-text-faint); }`,
    `.oc-brand-dot { fill: var(--oc-accent); }`,
    `.oc-eyebrow-dot { fill: var(--oc-accent); }`,
    `.oc-metrics { font-family: var(--oc-font-family); }`,
    `.oc-metric-label { font-size: 10px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; fill: var(--oc-text-muted); }`,
    `.oc-metric-value { font-size: 22px; font-weight: 500; letter-spacing: -0.01em; fill: var(--oc-text); font-variant-numeric: tabular-nums; }`,
    `.oc-metric-delta-up { fill: var(--oc-positive); font-size: 12px; font-weight: 500; }`,
    `.oc-metric-delta-down { fill: var(--oc-negative); font-size: 12px; font-weight: 500; }`,
    `.oc-axis-tick-inline { font-size: 11px; font-weight: 400; fill: var(--oc-text-muted); }`,
    `.oc-endpoint-labels { font-family: var(--oc-font-family); }`,
    `.oc-endpoint-label { fill: var(--oc-endpoint-label-color, var(--oc-text)); }`,
    `.oc-endpoint-value { fill: var(--oc-endpoint-value-color, var(--oc-text-muted)); }`,
    `.oc-endpoint-leader { stroke: var(--oc-endpoint-leader-color, currentColor); }`,
    `.oc-annotation-subtitle { fill: var(--oc-annotation-subtitle-color, var(--oc-text-muted)); }`,
    `.oc-metric-secondary { fill: var(--oc-positive); font-size: 12px; font-weight: 400; }`,
    `.oc-legend { font-family: var(--oc-font-family); font-size: var(--oc-body-size); }`,
    `.oc-legend-entry { cursor: default; }`,
    `.oc-legend text { fill: var(--oc-legend-text); }`,
  ];

  return rules.join('\n');
}

/**
 * Inject the theme style block into an SVG clone's `<defs>` so class-based fills
 * survive serialization. Idempotent-ish: adds one `<style data-oc-theme>` at the
 * front of `<defs>`; call once per clone before serializing. No-op if `theme` is
 * undefined (nothing to resolve against).
 */
export function injectThemeStyleBlock(svg: SVGElement, theme: ResolvedTheme | undefined): void {
  if (!theme) return;
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS(SVG_NS, 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  const style = document.createElementNS(SVG_NS, 'style');
  style.setAttribute('data-oc-theme', '');
  style.textContent = buildThemeStyleBlock(theme);
  defs.insertBefore(style, defs.firstChild);
}

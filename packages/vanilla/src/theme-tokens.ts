/**
 * Generate CSS custom properties from a resolved JS theme.
 *
 * Stamped on the .oc-root container at mount time so CSS consumers
 * read from the same source of truth as the JS engine. The static
 * values in tokens.css / dark.css serve as fallback defaults for
 * contexts where JS hasn't mounted (SSR, static HTML).
 */

import type { ResolvedTheme } from '@opendata-ai/openchart-core';
import { adaptForLightLineStroke, cssTokenDefault } from '@opendata-ai/openchart-core';

/**
 * The opaque surface a theme paints on. A transparent theme background has no
 * color of its own, so it resolves to the static `--oc-bg` token for the mode --
 * the same value the engine's knockout strokes are cut in.
 */
export function resolvedSurface(theme: ResolvedTheme): string {
  return theme.colors.background === 'transparent'
    ? cssTokenDefault('--oc-bg', theme.isDark ? 'dark' : 'light')
    : theme.colors.background;
}

export function stampThemeProperties(el: HTMLElement, theme: ResolvedTheme): void {
  const accent = theme.colors.categorical[0] ?? cssTokenDefault('--oc-accent', 'light');
  const bg = resolvedSurface(theme);

  const n = theme.colors.neutral;

  const props: [string, string][] = [
    ['--oc-font-family', theme.fonts.family],
    ['--oc-font-mono', theme.fonts.mono],
    ['--oc-title-size', `${theme.chrome.title.fontSize}px`],
    ['--oc-title-weight', `${theme.chrome.title.fontWeight}`],
    ['--oc-subtitle-size', `${theme.chrome.subtitle.fontSize}px`],
    ['--oc-subtitle-weight', `${theme.chrome.subtitle.fontWeight}`],
    ['--oc-source-size', `${theme.chrome.source.fontSize}px`],
    ['--oc-source-weight', `${theme.chrome.source.fontWeight}`],
    ['--oc-body-size', `${theme.fonts.sizes.body}px`],
    ['--oc-eyebrow-size', `${theme.chrome.eyebrow.fontSize}px`],
    ['--oc-eyebrow-weight', `${theme.chrome.eyebrow.fontWeight}`],
    ['--oc-bg', bg],
    ['--oc-text', theme.colors.text],
    ['--oc-text-muted', theme.colors.axis],
    // Secondary grays are derived from the theme's own text/background pair
    // (ResolvedTheme.colors.neutral), so a warm or cool theme gets warm or
    // cool grays instead of zinc. One direction only: theme -> CSS.
    ['--oc-text-secondary', n.secondary],
    ['--oc-text-faint', n.faint],
    ['--oc-border', n.border],
    ['--oc-gray-100', n[100]],
    ['--oc-gray-200', n[200]],
    ['--oc-gray-300', n[300]],
    ['--oc-gray-400', n[400]],
    ['--oc-gray-600', n[600]],
    ['--oc-gray-800', n[800]],
    ['--oc-gridline', theme.colors.gridline],
    // --oc-axis is the hairline the axis line is drawn with, not the ink its
    // tick labels take (that is --oc-text-muted, above).
    ['--oc-axis', theme.colors.hairline],
    ['--oc-border-radius', `${theme.borderRadius}px`],
    ['--oc-accent', accent],
    ['--oc-accent-strong', adaptForLightLineStroke(accent)],
    ['--oc-positive', theme.colors.positive],
    ['--oc-negative', theme.colors.negative],
    ['--oc-space-2', `${theme.spacing.chromeGap * 2}px`],
    ['--oc-space-4', `${theme.spacing.padding}px`],
  ];

  for (const [name, value] of props) {
    el.style.setProperty(name, value);
  }
}

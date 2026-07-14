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

export function stampThemeProperties(el: HTMLElement, theme: ResolvedTheme): void {
  const accent = theme.colors.categorical[0] ?? cssTokenDefault('--oc-accent', 'light');
  const bg =
    theme.colors.background === 'transparent'
      ? theme.isDark
        ? cssTokenDefault('--oc-bg', 'dark')
        : cssTokenDefault('--oc-bg', 'light')
      : theme.colors.background;

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
    ['--oc-gridline', theme.colors.gridline],
    ['--oc-axis', theme.colors.axis],
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

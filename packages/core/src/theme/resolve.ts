/**
 * Theme resolver: deep-merges user overrides onto default theme.
 *
 * Produces a ResolvedTheme where every property is guaranteed to have
 * a value. The engine uses ResolvedTheme internally so it never needs
 * null checks on theme properties.
 *
 * Auto-detects dark backgrounds and adapts chrome text colors so
 * custom themes with dark canvases are readable without explicitly
 * enabling darkMode.
 */

import type { ThemeConfig } from '../types/spec';
import type { ResolvedTheme, Theme } from '../types/theme';
import { DEFAULT_THEME } from './defaults';

/**
 * Deep merge source into target, creating a new object.
 * Only merges plain objects; arrays and primitives replace directly.
 */
// biome-ignore lint/suspicious/noExplicitAny: recursive object merge requires dynamic typing
function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal !== undefined &&
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      typeof targetVal === 'object' &&
      targetVal !== null &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Convert a user-facing ThemeConfig (partial) into the full Theme shape
 * that deepMerge can work with.
 */
function themeConfigToPartial(config: ThemeConfig): Partial<Theme> {
  const partial: Partial<Theme> = {};

  if (config.colors) {
    const colors: Partial<Theme['colors']> = {};
    // Shorthand: flat string[] is treated as categorical palette
    if (Array.isArray(config.colors)) {
      colors.categorical = config.colors;
    } else {
      if (config.colors.categorical) colors.categorical = config.colors.categorical;
      if (config.colors.sequential) colors.sequential = config.colors.sequential;
      if (config.colors.diverging) colors.diverging = config.colors.diverging;
      if (config.colors.background) colors.background = config.colors.background;
      if (config.colors.text) colors.text = config.colors.text;
      if (config.colors.gridline) colors.gridline = config.colors.gridline;
      if (config.colors.axis) colors.axis = config.colors.axis;
    }
    partial.colors = colors as Theme['colors'];
  }

  if (config.fonts) {
    const fonts: Partial<Theme['fonts']> = {};
    if (config.fonts.family) fonts.family = config.fonts.family;
    if (config.fonts.mono) fonts.mono = config.fonts.mono;
    partial.fonts = fonts as Theme['fonts'];
  }

  if (config.spacing) {
    const spacing: Partial<Theme['spacing']> = {};
    if (config.spacing.padding !== undefined) spacing.padding = config.spacing.padding;
    if (config.spacing.chromeGap !== undefined) spacing.chromeGap = config.spacing.chromeGap;
    partial.spacing = spacing as Theme['spacing'];
  }

  if (config.borderRadius !== undefined) {
    partial.borderRadius = config.borderRadius;
  }

  return partial;
}

/**
 * Parse a hex color to sRGB relative luminance (WCAG 2.1).
 * Returns 0 for invalid/unparseable colors.
 */
function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Returns true if the hex color is perceptually dark (luminance < 0.2). */
function isDarkBackground(hex: string): boolean {
  return relativeLuminance(hex) < 0.2;
}

/**
 * Adapt chrome text colors for a dark background.
 * Only overrides values that still match the light-mode defaults,
 * so explicit user overrides are preserved.
 */
function adaptChromeForDarkBg(theme: Theme, textColor: string): Theme {
  const light = DEFAULT_THEME.chrome;
  return {
    ...theme,
    chrome: {
      // Eyebrow keeps its accent tint regardless of surface mode.
      eyebrow: theme.chrome.eyebrow,
      title: {
        ...theme.chrome.title,
        color:
          theme.chrome.title.color === light.title.color ? textColor : theme.chrome.title.color,
      },
      subtitle: {
        ...theme.chrome.subtitle,
        color:
          theme.chrome.subtitle.color === light.subtitle.color
            ? adjustOpacity(textColor, 0.7)
            : theme.chrome.subtitle.color,
      },
      source: {
        ...theme.chrome.source,
        color:
          theme.chrome.source.color === light.source.color
            ? adjustOpacity(textColor, 0.5)
            : theme.chrome.source.color,
      },
      byline: {
        ...theme.chrome.byline,
        color:
          theme.chrome.byline.color === light.byline.color
            ? adjustOpacity(textColor, 0.5)
            : theme.chrome.byline.color,
      },
      footer: {
        ...theme.chrome.footer,
        color:
          theme.chrome.footer.color === light.footer.color
            ? adjustOpacity(textColor, 0.5)
            : theme.chrome.footer.color,
      },
    },
  };
}

/** Blend a hex color toward white/black by a factor to simulate opacity. */
function adjustOpacity(hex: string, opacity: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  // Blend toward mid-gray for muted secondary text
  const mix = (c: number) => Math.round(c * opacity + 128 * (1 - opacity));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * Resolve a theme by deep-merging user overrides onto a base theme.
 *
 * Auto-detects dark backgrounds: if the resolved background color is
 * perceptually dark and chrome text colors are still the light-mode
 * defaults, they're adapted for readability.
 *
 * @param userTheme - Optional partial theme overrides from the spec.
 * @param base - Base theme to merge onto. Defaults to DEFAULT_THEME.
 * @returns A ResolvedTheme with all properties guaranteed.
 */
export function resolveTheme(userTheme?: ThemeConfig, base: Theme = DEFAULT_THEME): ResolvedTheme {
  let merged: Theme = userTheme ? deepMerge(base, themeConfigToPartial(userTheme)) : { ...base };

  // Auto-adapt chrome for dark backgrounds
  const dark = isDarkBackground(merged.colors.background);
  if (dark) {
    merged = adaptChromeForDarkBg(merged, merged.colors.text);
  }

  return {
    ...merged,
    isDark: dark,
  } as ResolvedTheme;
}

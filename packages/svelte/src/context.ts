/**
 * Theme context: provides a theme and dark mode preference to all
 * descendant Chart, DataTable, and Graph components without prop drilling.
 *
 * Context values are getter functions so reads from children stay reactive
 * when the parent's props change.
 */

import type { DarkMode, ThemeConfig } from '@openchart/core';
import { getContext, setContext } from 'svelte';

/** @internal Context key for theme (exported for test use). */
export const THEME_KEY = Symbol('viz-theme');
/** @internal Context key for dark mode (exported for test use). */
export const DARK_MODE_KEY = Symbol('viz-dark-mode');

/** Set the theme context for descendant components. */
export function setVizTheme(theme: () => ThemeConfig | undefined): void {
  setContext(THEME_KEY, theme);
}

/** Read the current theme from the nearest VizThemeProvider. */
export function getVizTheme(): (() => ThemeConfig | undefined) | undefined {
  return getContext<(() => ThemeConfig | undefined) | undefined>(THEME_KEY);
}

/** Set the dark mode context for descendant components. */
export function setVizDarkMode(darkMode: () => DarkMode | undefined): void {
  setContext(DARK_MODE_KEY, darkMode);
}

/** Read the current dark mode preference from the nearest VizThemeProvider. */
export function getVizDarkMode(): (() => DarkMode | undefined) | undefined {
  return getContext<(() => DarkMode | undefined) | undefined>(DARK_MODE_KEY);
}

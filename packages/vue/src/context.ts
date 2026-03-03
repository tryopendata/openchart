/**
 * Theme injection context for Vue.
 *
 * Provides typed injection keys and composables for accessing theme
 * and dark mode from any descendant component within a VizThemeProvider.
 */

import type { DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import { type ComputedRef, computed, type InjectionKey, inject, type Ref } from 'vue';

/** Injection key for the theme config ref. */
export const VizThemeKey: InjectionKey<Ref<ThemeConfig | undefined>> = Symbol('VizTheme');

/** Injection key for the dark mode ref. */
export const VizDarkModeKey: InjectionKey<Ref<DarkMode | undefined>> = Symbol('VizDarkMode');

/**
 * Read the current theme from the nearest VizThemeProvider.
 * Returns a computed ref that stays reactive to provider changes.
 */
export function useVizTheme(): ComputedRef<ThemeConfig | undefined> {
  const theme = inject(VizThemeKey, undefined);
  return computed(() => theme?.value);
}

/**
 * Read the current dark mode preference from the nearest VizThemeProvider.
 * Returns a computed ref that stays reactive to provider changes.
 */
export function useVizDarkMode(): ComputedRef<DarkMode | undefined> {
  const darkMode = inject(VizDarkModeKey, undefined);
  return computed(() => darkMode?.value);
}

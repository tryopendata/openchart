/**
 * VizThemeProvider: provides a theme and dark mode preference to all
 * descendant Chart, DataTable, and Graph components without prop drilling.
 *
 * Components deep-merge the provider theme with their theme prop.
 * An explicit `darkMode` prop wins over the provider preference.
 */

import type { DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import { computed, defineComponent, type PropType, provide } from 'vue';
import { VizDarkModeKey, VizThemeKey } from './context';

export interface VizThemeProviderProps {
  theme: ThemeConfig | undefined;
  darkMode?: DarkMode;
}

export const VizThemeProvider = defineComponent({
  name: 'VizThemeProvider',
  props: {
    theme: {
      type: Object as PropType<ThemeConfig | undefined>,
      default: undefined,
    },
    darkMode: {
      type: String as PropType<DarkMode>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    // Wrap in computed() so changes to props propagate reactively
    // through the injection system.
    const themeRef = computed(() => props.theme);
    const darkModeRef = computed(() => props.darkMode);

    provide(VizThemeKey, themeRef);
    provide(VizDarkModeKey, darkModeRef);

    return () => slots.default?.();
  },
});

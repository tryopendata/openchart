/**
 * Theme context: provides a theme and dark mode preference to all
 * descendant Chart, DataTable, and Graph components without prop drilling.
 *
 * Components use the context values as fallbacks when no explicit
 * `theme` or `darkMode` prop is passed.
 */

import type { DarkMode, ThemeConfig } from '@openchart/core';
import { createContext, type ReactNode, useContext } from 'react';

const VizThemeContext = createContext<ThemeConfig | undefined>(undefined);
const VizDarkModeContext = createContext<DarkMode | undefined>(undefined);

/** Read the current theme from the nearest VizThemeProvider. */
export function useVizTheme(): ThemeConfig | undefined {
  return useContext(VizThemeContext);
}

/** Read the current dark mode preference from the nearest VizThemeProvider. */
export function useVizDarkMode(): DarkMode | undefined {
  return useContext(VizDarkModeContext);
}

export interface VizThemeProviderProps {
  /** Theme config to provide to descendant viz components. */
  theme: ThemeConfig | undefined;
  /** Dark mode preference to provide to descendant viz components. */
  darkMode?: DarkMode;
  children: ReactNode;
}

/** Provides a theme and dark mode preference to all nested Chart, DataTable, and Graph components. */
export function VizThemeProvider({ theme, darkMode, children }: VizThemeProviderProps) {
  return (
    <VizThemeContext.Provider value={theme}>
      <VizDarkModeContext.Provider value={darkMode}>{children}</VizDarkModeContext.Provider>
    </VizThemeContext.Provider>
  );
}

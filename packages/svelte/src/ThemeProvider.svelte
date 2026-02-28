<!--
  VizThemeProvider: provides a theme and dark mode preference to all
  descendant Chart, DataTable, and Graph components.

  Components use the context values as fallbacks when no explicit
  `theme` or `darkMode` prop is passed.
-->
<script lang="ts">
import type { DarkMode, ThemeConfig } from '@openchart/core';
import type { Snippet } from 'svelte';
import { setVizDarkMode, setVizTheme } from './context.js';

let {
  theme,
  darkMode,
  children,
}: {
  theme: ThemeConfig | undefined;
  darkMode?: DarkMode;
  children: Snippet;
} = $props();

setVizTheme(() => theme);
setVizDarkMode(() => darkMode);
</script>

{@render children()}

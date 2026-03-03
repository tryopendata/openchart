<!--
  DataTable component: Svelte 5 wrapper around the vanilla table adapter.

  Mounts a table instance on render, updates when spec changes,
  and cleans up on unmount. Supports both controlled and uncontrolled modes
  for sort, search, and pagination state.
-->
<script lang="ts">
import type { DarkMode, SortState, TableSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createTable,
  type TableInstance,
  type TableMountOptions,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onrowclick,
  onsortchange,
  onsearchchange,
  onpagechange,
  sort,
  search,
  page,
  class: className,
  style,
}: {
  spec: TableSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onrowclick?: (row: Record<string, unknown>) => void;
  onsortchange?: (sort: SortState | null) => void;
  onsearchchange?: (query: string) => void;
  onpagechange?: (page: number) => void;
  sort?: SortState | null;
  search?: string;
  page?: number;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: TableInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

const isControlled = $derived(sort !== undefined || search !== undefined || page !== undefined);

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

// Main effect: tracks spec, theme, darkMode, and controlled state.
// Callback props use untrack() so they don't trigger recreation.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = spec;
  const currentIsControlled = isControlled;
  const currentSort = sort;
  const currentSearch = search;
  const currentPage = page;

  instance?.destroy();

  const mountOptions: TableMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onRowClick: (row: Record<string, unknown>) => untrack(() => onrowclick)?.(row),
    responsive: true,
    onStateChange: (state) => {
      if (state.sort !== undefined) untrack(() => onsortchange)?.(state.sort);
      if (state.search !== undefined) untrack(() => onsearchchange)?.(state.search);
      if (state.page !== undefined) untrack(() => onpagechange)?.(state.page);
    },
  };

  if (currentIsControlled) {
    mountOptions.externalState = {
      sort: currentSort ?? null,
      search: currentSearch ?? '',
      page: currentPage ?? 0,
    };
  }

  instance = createTable(containerEl, currentSpec, mountOptions);
});
</script>

<div
  bind:this={containerEl}
  class={className ? `viz-table-root ${className}` : 'viz-table-root'}
  {style}
></div>

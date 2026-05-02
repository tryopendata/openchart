<!--
  BarList component: Svelte 5 wrapper around the vanilla adapter.
-->
<script lang="ts">
import type { BarListSpec, DarkMode, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  type BarListInstance,
  type BarListMountOptions,
  createBarList,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onrowclick,
  onrowhover,
  class: className,
  style,
}: {
  spec: BarListSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onrowclick?: (row: { label: string; value: number; data: Record<string, unknown> }) => void;
  onrowhover?: (
    row: {
      label: string;
      value: number;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: BarListInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';

$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const options: BarListMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onRowClick: (row: { label: string; value: number; data: Record<string, unknown> }) =>
      untrack(() => onrowclick)?.(row),
    onRowHover: (
      row: {
        label: string;
        value: number;
        data: Record<string, unknown>;
      } | null,
    ) => untrack(() => onrowhover)?.(row),
    responsive: true,
  };

  instance = createBarList(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

$effect(() => {
  const currentSpec = spec;
  if (!instance) return;

  const specString = JSON.stringify(currentSpec);
  if (specString !== prevSpec) {
    prevSpec = specString;
    instance.update(currentSpec);
  }
});
</script>

<div
  bind:this={containerEl}
  class={className ? `oc-barlist-root ${className}` : 'oc-barlist-root'}
  {style}
></div>

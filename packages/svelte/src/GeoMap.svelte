<!--
  Map component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a map instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createMap() function.
-->
<script lang="ts">
import type { DarkMode, MapSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createMap,
  type MapInstance,
  type MapMarkEvent,
  type MapMountOptions,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onmarkclick,
  onmarkhover,
  class: className,
  style,
}: {
  spec: MapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onmarkclick?: (event: MapMarkEvent) => void;
  onmarkhover?: (event: MapMarkEvent | null) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: MapInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';

// Effect 1: Mount/recreate map on theme/darkMode changes.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const options: MapMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onMarkClick: (feature) => untrack(() => onmarkclick)?.(feature),
    onMarkHover: (feature) => untrack(() => onmarkhover)?.(feature),
    responsive: true,
  };

  instance = createMap(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

// Effect 2: Update map when spec changes (no destroy/recreate).
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
  class={className ? `oc-map-root ${className}` : 'oc-map-root'}
  {style}
></div>

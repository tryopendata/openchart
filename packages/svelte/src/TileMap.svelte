<!--
  TileMap component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a tilemap instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createTileMap() function.
-->
<script lang="ts">
import type { DarkMode, ThemeConfig, TileMapSpec } from '@opendata-ai/openchart-core';
import {
  createTileMap,
  type TileMapInstance,
  type TileMapMountOptions,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  ontileclick,
  ontilehover,
  class: className,
  style,
}: {
  spec: TileMapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  ontileclick?: (tile: {
    stateCode: string;
    stateName: string;
    value: number | null;
    data: Record<string, unknown>;
  }) => void;
  ontilehover?: (
    tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    } | null,
  ) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: TileMapInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';

// Effect 1: Mount/recreate tilemap on theme/darkMode changes.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const options: TileMapMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onTileClick: (tile: {
      stateCode: string;
      stateName: string;
      value: number | null;
      data: Record<string, unknown>;
    }) => untrack(() => ontileclick)?.(tile),
    onTileHover: (
      tile: {
        stateCode: string;
        stateName: string;
        value: number | null;
        data: Record<string, unknown>;
      } | null,
    ) => untrack(() => ontilehover)?.(tile),
    responsive: true,
  };

  instance = createTileMap(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

// Effect 2: Update tilemap when spec changes (no destroy/recreate).
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
  class={className ? `oc-tilemap-root ${className}` : 'oc-tilemap-root'}
  {style}
></div>

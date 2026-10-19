<!--
  Map component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a map instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createGeoMap() function.
-->
<script lang="ts">
import type {
  DarkMode,
  GeoMapSpec,
  GeoReaderSelection,
  ReaderChangeMeta,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  type Camera,
  createGeoMap,
  createGeoReaderBinding,
  type GeoMapCameraChangeMeta,
  type GeoMapInstance,
  type GeoMapMarkEvent,
  type GeoMapMountOptions,
  type GeoReaderOptions,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  reader,
  readerSelection,
  onreaderchange,
  theme,
  darkMode,
  labelInventory,
  onmarkclick,
  onmarkhover,
  oncamerachange,
  class: className,
  style,
}: {
  reader?: false | GeoReaderOptions;
  readerSelection?: GeoReaderSelection;
  onreaderchange?: (selection: GeoReaderSelection, meta: ReaderChangeMeta) => void;
  spec: GeoMapSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  labelInventory?: GeoMapMountOptions['labelInventory'];
  onmarkclick?: (event: GeoMapMarkEvent) => void;
  onmarkhover?: (event: GeoMapMarkEvent | null) => void;
  oncamerachange?: (camera: Camera, meta?: GeoMapCameraChangeMeta) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: GeoMapInstance | null = null;
/** Imperative camera/export access through bind:this, matching the other wrappers. */
export function getInstance(): GeoMapInstance | null {
  return instance;
}
const readerBinding = createGeoReaderBinding();
function syncReader() {
  if (instance && containerEl)
    readerBinding.sync(containerEl, instance, spec, reader, readerSelection, (state, meta) =>
      untrack(() => onreaderchange)?.(state, meta),
    );
}

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    readerBinding.detach();
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';
let mountedConfig = '';

// Effect 1: Mount/recreate map on theme/darkMode changes.
$effect(() => {
  const resolvedTheme = mergeThemeConfig(ctxTheme?.(), theme);
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = untrack(() => spec);
  const config = JSON.stringify([resolvedTheme, resolvedDarkMode]);
  if (instance && config === mountedConfig) return;
  mountedConfig = config;

  readerBinding.detach();
  instance?.destroy();

  const options: GeoMapMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onMarkClick: (feature) => untrack(() => onmarkclick)?.(feature),
    onMarkHover: (feature) => untrack(() => onmarkhover)?.(feature),
    onCameraChange: (camera, meta) =>
      meta
        ? untrack(() => oncamerachange)?.(camera, meta)
        : untrack(() => oncamerachange)?.(camera),
    autoResize: true,
    labelInventory: untrack(() =>
      labelInventory ? { container: labelInventory.container } : labelInventory,
    ),
  };

  instance = untrack(() => createGeoMap(containerEl, currentSpec, options));
  untrack(() => syncReader());
  prevSpec = untrack(() => JSON.stringify(currentSpec));
});

$effect(() => {
  instance?.setLabelInventory(labelInventory);
});

$effect(() => {
  reader;
  readerSelection;
  onreaderchange;
  untrack(() => syncReader());
});

// Effect 2: Update map when spec changes (no destroy/recreate).
$effect(() => {
  const currentSpec = spec;
  if (!instance) return;

  const specString = JSON.stringify(currentSpec);
  if (specString !== prevSpec) {
    prevSpec = specString;
    instance.update(currentSpec);
    untrack(() => syncReader());
  }
});
</script>

<div
  bind:this={containerEl}
  class={className ? `oc-map-root ${className}` : 'oc-map-root'}
  {style}
></div>

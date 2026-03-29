<!--
  Sankey component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a sankey instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createSankey() function.
-->
<script lang="ts">
import type { DarkMode, SankeySpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createSankey,
  type SankeyInstance,
  type SankeyMountOptions,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onnodeclick,
  onlinkclick,
  onnodehover,
  onlinkhover,
  class: className,
  style,
}: {
  spec: SankeySpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onnodeclick?: (node: Record<string, unknown>) => void;
  onlinkclick?: (link: Record<string, unknown>) => void;
  onnodehover?: (node: Record<string, unknown> | null) => void;
  onlinkhover?: (link: Record<string, unknown> | null) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: SankeyInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';

// Effect 1: Mount/recreate sankey on theme/darkMode changes.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const options: SankeyMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onNodeClick: (node: Record<string, unknown>) => untrack(() => onnodeclick)?.(node),
    onLinkClick: (link: Record<string, unknown>) => untrack(() => onlinkclick)?.(link),
    onNodeHover: (node: Record<string, unknown> | null) => untrack(() => onnodehover)?.(node),
    onLinkHover: (link: Record<string, unknown> | null) => untrack(() => onlinkhover)?.(link),
    responsive: true,
  };

  instance = createSankey(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

// Effect 2: Update sankey when spec changes (no destroy/recreate).
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
  class={className ? `oc-sankey-root ${className}` : 'oc-sankey-root'}
  {style}
></div>

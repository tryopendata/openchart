<!--
  Graph component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a graph instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createGraph() function.

  Exposes imperative methods via component exports for programmatic
  control (search, zoom, select).
-->
<script lang="ts">
import type { DarkMode, GraphSpec, ThemeConfig } from '@opendata-ai/core';
import { createGraph, type GraphInstance, type GraphMountOptions } from '@opendata-ai/vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onnodeclick,
  onnodedoubleclick,
  onselectionchange,
  class: className,
  style,
}: {
  spec: GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onnodeclick?: (node: Record<string, unknown>) => void;
  onnodedoubleclick?: (node: Record<string, unknown>) => void;
  onselectionchange?: (nodeIds: string[]) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: GraphInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

// Main effect: only tracks spec, theme, and darkMode.
// Callback props use untrack() so they don't trigger recreation.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = spec;

  instance?.destroy();

  const options: GraphMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    onNodeClick: (node: Record<string, unknown>) => untrack(() => onnodeclick)?.(node),
    onNodeDoubleClick: (node: Record<string, unknown>) => untrack(() => onnodedoubleclick)?.(node),
    onSelectionChange: (nodeIds: string[]) => untrack(() => onselectionchange)?.(nodeIds),
    responsive: true,
  };

  instance = createGraph(containerEl, currentSpec, options);
});

// Imperative methods exposed via component exports
export function search(query: string): void {
  instance?.search(query);
}

export function clearSearch(): void {
  instance?.clearSearch();
}

export function zoomToFit(): void {
  instance?.zoomToFit();
}

export function zoomToNode(nodeId: string): void {
  instance?.zoomToNode(nodeId);
}

export function selectNode(nodeId: string): void {
  instance?.selectNode(nodeId);
}

export function getSelectedNodes(): string[] {
  return instance?.getSelectedNodes() ?? [];
}
</script>

<div
  bind:this={containerEl}
  class={className ? `viz-graph-root ${className}` : 'viz-graph-root'}
  {style}
></div>

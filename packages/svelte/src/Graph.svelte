<!--
  Graph component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a graph instance on render, updates when spec changes,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createGraph() function.

  Exposes imperative methods via component exports for programmatic
  control (search, zoom, select, fly, highlight).
-->
<script lang="ts">
import type { DarkMode, GraphSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  type CameraFlightOptions,
  createGraph,
  type GraphHighlightTarget,
  type GraphInstance,
  type GraphLegendData,
  type GraphMountOptions,
  type GraphTooltipFormatter,
} from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

/** Tooltip prop: `false` off, `true` default, or an object with a formatter. */
type GraphTooltipProp = boolean | { formatter?: GraphTooltipFormatter };
/** Legend prop: `false` off, `true` default, or an object toggling interactivity/counts. */
type GraphLegendProp = boolean | { interactive?: boolean; counts?: boolean };

let {
  spec,
  theme,
  darkMode,
  tooltip,
  legend,
  fitOnLoad,
  onnodeclick,
  onnodedoubleclick,
  onnodehover,
  onedgehover,
  onselectionchange,
  onlegendhover,
  onlegendtoggle,
  onhighlightchange,
  oncamerachange,
  class: className,
  style,
}: {
  spec: GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  tooltip?: GraphTooltipProp;
  legend?: GraphLegendProp;
  fitOnLoad?: boolean;
  onnodeclick?: (node: Record<string, unknown>) => void;
  onnodedoubleclick?: (node: Record<string, unknown>) => void;
  onnodehover?: (node: Record<string, unknown> | null) => void;
  onedgehover?: (edge: Record<string, unknown> | null) => void;
  onselectionchange?: (nodeIds: string[]) => void;
  onlegendhover?: (entry: { field: string; value: string } | null) => void;
  onlegendtoggle?: (activeValues: string[]) => void;
  onhighlightchange?: (nodeIds: string[] | null) => void;
  oncamerachange?: (camera: { x: number; y: number; k: number }) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: GraphInstance | null = null;
// First mount plays the entrance; theme/darkMode-only recreations suppress it.
let mountedOnce = false;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

// Only the on/off decision gates recreation; the formatter (a function) rides
// the trampoline below so swapping it never remounts the graph.
const tooltipOn = $derived(tooltip !== false);
// Serialize the structural legend shape so a { interactive, counts } change
// recreates, but reference identity churn doesn't.
const legendKey = $derived(
  legend === false
    ? 'false'
    : legend === true || legend === undefined
      ? 'true'
      : JSON.stringify({ interactive: legend.interactive, counts: legend.counts }),
);

// Stable tooltip formatter wrapper: always reads the LATEST formatter off the
// (untracked) prop, so a formatter can be added or swapped per-render without
// recreation and without going stale.
const stableTooltipFormatter: GraphTooltipFormatter = (item, defaults) => {
  const t = untrack(() => tooltip);
  const fn = t && typeof t === 'object' ? t.formatter : undefined;
  return fn ? fn(item, defaults) : defaults;
};

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

let prevSpec = '';

// Effect 1: Mount/recreate graph on theme/darkMode/structural option changes.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  // Read the structural tooltip/legend keys + fitOnLoad so a change to any of
  // them recreates the graph; the tooltip formatter is deliberately NOT tracked
  // (it rides the trampoline). Referencing `legendKey` here registers the
  // reactive dependency — the actual `legend` object is read untracked below.
  const on = tooltipOn;
  void legendKey;
  const fit = fitOnLoad;
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const tooltipOption: GraphMountOptions['tooltip'] = on
    ? { formatter: stableTooltipFormatter }
    : false;

  const options: GraphMountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    tooltip: tooltipOption,
    legend: untrack(() => legend),
    fitOnLoad: fit,
    onNodeClick: (node) => untrack(() => onnodeclick)?.(node),
    onNodeDoubleClick: (node) => untrack(() => onnodedoubleclick)?.(node),
    onNodeHover: (node) => untrack(() => onnodehover)?.(node),
    onEdgeHover: (edge) => untrack(() => onedgehover)?.(edge),
    onSelectionChange: (nodeIds) => untrack(() => onselectionchange)?.(nodeIds),
    onLegendHover: (entry) => untrack(() => onlegendhover)?.(entry),
    onLegendToggle: (activeValues) => untrack(() => onlegendtoggle)?.(activeValues),
    onHighlightChange: (nodeIds) => untrack(() => onhighlightchange)?.(nodeIds),
    onCameraChange: (camera) => untrack(() => oncamerachange)?.(camera),
    responsive: true,
    // untrack so reading the flag doesn't add a dependency; the value is set
    // after the first mount and reset only on component teardown.
    suppressEntrance: untrack(() => mountedOnce),
  };

  instance = createGraph(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
  mountedOnce = true;
});

// Effect 2: Update graph when spec changes (no destroy/recreate).
$effect(() => {
  const currentSpec = spec;
  if (!instance) return;

  const specString = JSON.stringify(currentSpec);
  if (specString !== prevSpec) {
    prevSpec = specString;
    instance.update(currentSpec);
  }
});

// Imperative methods exposed via component exports. Each forwards opts to the
// underlying instance so consumers get the full vanilla API surface.
export function search(query: string): void {
  instance?.search(query);
}

export function clearSearch(): void {
  instance?.clearSearch();
}

export function getSearchMatches(): string[] {
  return instance?.getSearchMatches() ?? [];
}

export function zoomToFit(opts?: CameraFlightOptions & { padding?: number }): void {
  instance?.zoomToFit(opts);
}

export function zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }): void {
  instance?.zoomToNode(nodeId, opts);
}

export function flyTo(
  target: { x: number; y: number; k?: number },
  opts?: CameraFlightOptions,
): void {
  instance?.flyTo(target, opts);
}

export function centerAt(x: number, y: number, opts?: CameraFlightOptions): void {
  instance?.centerAt(x, y, opts);
}

export function getCamera(): { x: number; y: number; k: number } {
  return instance?.getCamera() ?? { x: 0, y: 0, k: 1 };
}

export function selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions): void {
  instance?.selectNode(nodeId, opts);
}

export function getSelectedNodes(): string[] {
  return instance?.getSelectedNodes() ?? [];
}

export function highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }): void {
  instance?.highlight(target, opts);
}

export function clearHighlight(): void {
  instance?.clearHighlight();
}

export function getHighlight(): string[] | null {
  return instance?.getHighlight() ?? null;
}

export function getLegend(): GraphLegendData | null {
  return instance?.getLegend() ?? null;
}

export function updateVisuals(nextSpec: GraphSpec): void {
  instance?.updateVisuals(nextSpec);
}
</script>

<div
  bind:this={containerEl}
  class={className ? `oc-graph-root ${className}` : 'oc-graph-root'}
  {style}
></div>

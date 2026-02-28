<!--
  Chart component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a chart instance on render, updates when spec/options change,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createChart() function.
-->
<script lang="ts">
import type {
  Annotation,
  AnnotationOffset,
  DarkMode,
  MarkEvent,
  TextAnnotation,
  ThemeConfig,
  VizSpec,
} from '@openchart/core';
import { type ChartInstance, createChart, type MountOptions } from '@openchart/vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  onmarkclick,
  onmarkhover,
  onmarkleave,
  onlegendtoggle,
  onannotationclick,
  onannotationedit,
  ondatapointclick,
  class: className,
  style,
}: {
  spec: VizSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onmarkclick?: (event: MarkEvent) => void;
  onmarkhover?: (event: MarkEvent) => void;
  onmarkleave?: () => void;
  onlegendtoggle?: (series: string, visible: boolean) => void;
  onannotationclick?: (annotation: Annotation, event: MouseEvent) => void;
  onannotationedit?: (annotation: TextAnnotation, offset: AnnotationOffset) => void;
  ondatapointclick?: (data: Record<string, unknown>) => void;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: ChartInstance | null = null;

const ctxTheme = getVizTheme();
const ctxDarkMode = getVizDarkMode();

onMount(() => {
  return () => {
    instance?.destroy();
    instance = null;
  };
});

// Stable callback wrappers that read current handler props without
// creating reactive dependencies. This prevents callback prop changes
// from triggering a full chart destroy/recreate cycle.
const stableHandlers: MountOptions = {
  onMarkClick: (event: MarkEvent) => untrack(() => onmarkclick)?.(event),
  onMarkHover: (event: MarkEvent) => untrack(() => onmarkhover)?.(event),
  onMarkLeave: () => untrack(() => onmarkleave)?.(),
  onLegendToggle: (series: string, visible: boolean) =>
    untrack(() => onlegendtoggle)?.(series, visible),
  onAnnotationClick: (annotation: Annotation, event: MouseEvent) =>
    untrack(() => onannotationclick)?.(annotation, event),
  onAnnotationEdit: (annotation: TextAnnotation, offset: AnnotationOffset) =>
    untrack(() => onannotationedit)?.(annotation, offset),
  onDataPointClick: (data: Record<string, unknown>) => untrack(() => ondatapointclick)?.(data),
};

// Main effect: only tracks spec, theme, and darkMode.
// Callback prop changes don't trigger recreation.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const currentSpec = spec;

  instance?.destroy();

  const options: MountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    responsive: true,
    ...stableHandlers,
  };

  instance = createChart(containerEl, currentSpec, options);
});
</script>

<div
  bind:this={containerEl}
  class={className ? `viz-chart-root ${className}` : 'viz-chart-root'}
  {style}
></div>

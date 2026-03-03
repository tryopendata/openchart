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
  ChartSpec,
  DarkMode,
  ElementEdit,
  GraphSpec,
  MarkEvent,
  TextAnnotation,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
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
  onedit,
  ondatapointclick,
  class: className,
  style,
}: {
  spec: ChartSpec | GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  onmarkclick?: (event: MarkEvent) => void;
  onmarkhover?: (event: MarkEvent) => void;
  onmarkleave?: () => void;
  onlegendtoggle?: (series: string, visible: boolean) => void;
  onannotationclick?: (annotation: Annotation, event: MouseEvent) => void;
  onannotationedit?: (annotation: TextAnnotation, offset: AnnotationOffset) => void;
  onedit?: (edit: ElementEdit) => void;
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
  onDataPointClick: (data: Record<string, unknown>) => untrack(() => ondatapointclick)?.(data),
};

// Editing callbacks - only defined as stable wrappers, but only
// included in options when the consumer provides the prop.
const stableOnAnnotationEdit = (annotation: TextAnnotation, offset: AnnotationOffset) =>
  untrack(() => onannotationedit)?.(annotation, offset);
const stableOnEdit = (edit: ElementEdit) => untrack(() => onedit)?.(edit);

let prevSpec = '';

// Effect 1: Mount/recreate chart on theme/darkMode changes.
// Reads spec via untrack() so spec changes don't trigger full recreate.
$effect(() => {
  const resolvedTheme = theme ?? ctxTheme?.();
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  // Read spec without tracking - spec changes handled in Effect 2
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const hasAnnotationEdit = untrack(() => onannotationedit) !== undefined;
  const hasEdit = untrack(() => onedit) !== undefined;

  const options: MountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    responsive: true,
    ...stableHandlers,
    ...(hasAnnotationEdit ? { onAnnotationEdit: stableOnAnnotationEdit } : {}),
    ...(hasEdit ? { onEdit: stableOnEdit } : {}),
  };

  instance = createChart(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

// Effect 2: Update chart when spec changes (no destroy/recreate).
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
  class={className ? `viz-chart-root ${className}` : 'viz-chart-root'}
  {style}
></div>

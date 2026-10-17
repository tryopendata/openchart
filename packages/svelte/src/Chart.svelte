<!--
  Chart component: Svelte 5 wrapper around the vanilla adapter.

  Mounts a chart instance on render, updates when spec/options change,
  and cleans up on unmount. All heavy lifting is done by the vanilla
  createChart() function.
-->
<script lang="ts">
import type {
  Annotation,
  ChartSpec,
  DarkMode,
  EditTransaction,
  ElementRef,
  GraphSpec,
  LayerSpec,
  MarkEvent,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import { onMount, untrack } from 'svelte';
import { getVizDarkMode, getVizTheme } from './context.js';

let {
  spec,
  theme,
  darkMode,
  renderer,
  autoResize,
  revision,
  onedit,
  onmarkclick,
  onmarkhover,
  onmarkleave,
  onlegendtoggle,
  onannotationclick,
  onselect,
  ondeselect,
  editable,
  selectedElement: selectedElementProp,
  highlight,
  class: className,
  style,
}: {
  spec: ChartSpec | LayerSpec | GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  renderer?: 'auto' | 'svg' | 'canvas';
  autoResize?: boolean;
  revision?: string | number;
  onedit?: (tx: EditTransaction) => void;
  onmarkclick?: (event: MarkEvent) => void;
  onmarkhover?: (event: MarkEvent) => void;
  onmarkleave?: () => void;
  onlegendtoggle?: (series: string, visible: boolean) => void;
  onannotationclick?: (annotation: Annotation, event: MouseEvent, element: ElementRef) => void;
  onselect?: (element: ElementRef) => void;
  ondeselect?: (element: ElementRef) => void;
  editable?: boolean;
  selectedElement?: ElementRef;
  highlight?: string[] | null;
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
  onAnnotationClick: (annotation: Annotation, event: MouseEvent, element: ElementRef) =>
    untrack(() => onannotationclick)?.(annotation, event, element),
};

// Editing callbacks - only defined as stable wrappers, but only
// included in options when the consumer provides the prop.
const stableOnSelect = (element: ElementRef) => untrack(() => onselect)?.(element);
const stableOnDeselect = (element: ElementRef) => untrack(() => ondeselect)?.(element);

const hasEditListener = $derived(Boolean(onedit));
const stableOnEdit = (tx: EditTransaction) => untrack(() => onedit)?.(tx);

let prevSpec = '';
let prevRevision: string | number | undefined;

// Effect 1: Mount/recreate chart on theme/darkMode changes.
// Reads spec via untrack() so spec changes don't trigger full recreate.
$effect(() => {
  const resolvedTheme = mergeThemeConfig(ctxTheme?.(), theme);
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const resolvedRenderer = renderer;
  const resolvedEditable = editable;
  // Read spec without tracking - spec changes handled in Effect 2
  const currentSpec = untrack(() => spec);

  instance?.destroy();

  const hasSelect = untrack(() => onselect) !== undefined;
  const hasDeselect = untrack(() => ondeselect) !== undefined;
  const currentSelectedElement = untrack(() => selectedElementProp);

  const options: MountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    renderer: resolvedRenderer,
    autoResize,
    revision: untrack(() => revision),
    ...(hasEditListener ? { onEdit: stableOnEdit } : {}),
    ...stableHandlers,
    ...(resolvedEditable != null ? { editable: resolvedEditable } : {}),
    ...(hasSelect ? { onSelect: stableOnSelect } : {}),
    ...(hasDeselect ? { onDeselect: stableOnDeselect } : {}),
    ...(currentSelectedElement ? { selectedElement: currentSelectedElement } : {}),
  };

  instance = createChart(containerEl, currentSpec, options);
  prevSpec = JSON.stringify(currentSpec);
});

// Effect 2: Update chart when spec changes (no destroy/recreate).
$effect(() => {
  const currentSpec = spec;
  const currentRevision = revision;
  if (!instance) return;

  const specString = JSON.stringify(currentSpec);
  if (specString !== prevSpec || currentRevision !== prevRevision) {
    prevSpec = specString;
    prevRevision = currentRevision;
    instance.update(currentSpec, {
      selectedElement: untrack(() => selectedElementProp),
      revision: currentRevision,
    });
  }
});

// Effect 3: Watch selectedElement prop changes.
$effect(() => {
  const sel = selectedElementProp;
  // Read instance without tracking to avoid coupling to Effect 1
  const inst = untrack(() => instance);
  if (!inst) return;

  if (sel) {
    inst.select(sel);
  } else {
    inst.deselect();
  }
});

// Effect 4: Watch highlight prop changes.
$effect(() => {
  const h = highlight;
  if (h === undefined) return;
  const inst = untrack(() => instance);
  if (!inst) return;
  inst.setHighlight(h ?? null);
});

// Imperative methods exposed via component exports
export function getSelectedElement(): ElementRef | null {
  return instance?.getSelectedElement() ?? null;
}

export function select(ref: ElementRef): void {
  instance?.select(ref);
}

export function deselect(): void {
  instance?.deselect();
}
</script>

<div
  bind:this={containerEl}
  class={className ? `oc-chart-root ${className}` : 'oc-chart-root'}
  {style}
></div>

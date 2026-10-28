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
  LayerSpec,
  MarkEvent,
  MarkFocusEvent,
  ReaderChangeMeta,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import {
  type ChartInstance,
  type ChartReaderSelection,
  createChart,
  createChartReaderBinding,
  type InteractionMode,
  type MountOptions,
  type ReaderPresentationOptions,
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
  renderer,
  rowHover,
  autoResize,
  revision,
  onedit,
  onmarkclick,
  onmarkhover,
  onmarkfocus,
  onmarkleave,
  onlegendtoggle,
  onannotationclick,
  onhighlightchange,
  onreveal,
  onselect,
  ondeselect,
  interaction,
  selectedElement: selectedElementProp,
  highlight,
  class: className,
  style,
}: {
  reader?: false | ReaderPresentationOptions;
  readerSelection?: ChartReaderSelection;
  onreaderchange?: (selection: ChartReaderSelection, meta: ReaderChangeMeta) => void;
  spec: ChartSpec | LayerSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  renderer?: 'auto' | 'svg' | 'canvas';
  /** Quiet row inspection for simple horizontal bars. */
  rowHover?: boolean;
  autoResize?: boolean;
  revision?: string | number;
  onedit?: (tx: EditTransaction) => void;
  onmarkclick?: (event: MarkEvent) => void;
  onmarkhover?: (event: MarkEvent) => void;
  onmarkfocus?: (event: MarkFocusEvent) => void;
  onmarkleave?: () => void;
  onlegendtoggle?: (series: string, visible: boolean) => void;
  onannotationclick?: (annotation: Annotation, event: MouseEvent, element: ElementRef) => void;
  onhighlightchange?: (values: string[]) => void;
  onreveal?: (guess: Array<{ x: string | number; y: number }>) => void;
  onselect?: (element: ElementRef) => void;
  ondeselect?: (element: ElementRef) => void;
  interaction?: InteractionMode;
  selectedElement?: ElementRef;
  highlight?: string[] | null;
  class?: string;
  style?: string;
} = $props();

let containerEl: HTMLDivElement;
let instance: ChartInstance | null = null;
const readerBinding = createChartReaderBinding();
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

// Stable callback wrappers that read current handler props without
// creating reactive dependencies. This prevents callback prop changes
// from triggering a full chart destroy/recreate cycle.
const stableHandlers: MountOptions = {
  onMarkClick: (event: MarkEvent) => untrack(() => onmarkclick)?.(event),
  onMarkHover: (event: MarkEvent) => untrack(() => onmarkhover)?.(event),
  onMarkFocus: (event: MarkFocusEvent) => untrack(() => onmarkfocus)?.(event),
  onMarkLeave: () => untrack(() => onmarkleave)?.(),
  onLegendToggle: (series: string, visible: boolean) =>
    untrack(() => onlegendtoggle)?.(series, visible),
  onAnnotationClick: (annotation: Annotation, event: MouseEvent, element: ElementRef) =>
    untrack(() => onannotationclick)?.(annotation, event, element),
  onHighlightChange: (values: string[]) => untrack(() => onhighlightchange)?.(values),
  onReveal: (guess: Array<{ x: string | number; y: number }>) => untrack(() => onreveal)?.(guess),
};

// Selection/edit callbacks - stable wrappers, included in options only when
// the consumer provides the prop. Their presence infers the interaction mode
// when `interaction` is omitted, so presence (not identity) recreates the chart.
const stableOnSelect = (element: ElementRef) => untrack(() => onselect)?.(element);
const stableOnDeselect = (element: ElementRef) => untrack(() => ondeselect)?.(element);

const hasEditListener = $derived(Boolean(onedit));
const hasSelectListener = $derived(Boolean(onselect));
const hasDeselectListener = $derived(Boolean(ondeselect));
const stableOnEdit = (tx: EditTransaction) => untrack(() => onedit)?.(tx);

let prevSpec = '';
let mountedConfig = '';
let prevRevision: string | number | undefined;

// Effect 1: Mount/recreate chart on theme/darkMode/renderer/interaction changes.
// Reads spec via untrack() so spec changes don't trigger full recreate.
$effect(() => {
  const resolvedTheme = mergeThemeConfig(ctxTheme?.(), theme);
  const resolvedDarkMode = darkMode ?? ctxDarkMode?.();
  const resolvedRenderer = renderer;
  const resolvedInteraction = interaction;
  // Read spec without tracking - spec changes handled in Effect 2
  const currentSpec = untrack(() => spec);

  const config = JSON.stringify([
    resolvedTheme,
    resolvedDarkMode,
    resolvedRenderer,
    resolvedInteraction,
    rowHover,
    autoResize,
    hasEditListener,
    hasSelectListener,
    hasDeselectListener,
  ]);
  if (instance && config === mountedConfig) return;
  mountedConfig = config;
  readerBinding.detach();
  instance?.destroy();

  const currentSelectedElement = untrack(() => selectedElementProp);

  const options: MountOptions = {
    theme: resolvedTheme,
    darkMode: resolvedDarkMode,
    renderer: resolvedRenderer,
    rowHover,
    autoResize,
    revision: untrack(() => revision),
    ...(hasEditListener ? { onEdit: stableOnEdit } : {}),
    ...stableHandlers,
    ...(resolvedInteraction != null ? { interaction: resolvedInteraction } : {}),
    ...(hasSelectListener ? { onSelect: stableOnSelect } : {}),
    ...(hasDeselectListener ? { onDeselect: stableOnDeselect } : {}),
    ...(currentSelectedElement ? { selectedElement: currentSelectedElement } : {}),
  };

  instance = untrack(() => createChart(containerEl, currentSpec, options));
  untrack(() => syncReader());
  prevSpec = JSON.stringify(currentSpec);
  prevRevision = options.revision;
});

$effect(() => {
  reader;
  readerSelection;
  onreaderchange;
  untrack(() => syncReader());
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
    untrack(() => syncReader());
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

/** The underlying vanilla chart instance (null until mounted). */
export function getInstance(): ChartInstance | null {
  return instance;
}
</script>

<div
  bind:this={containerEl}
  class={className ? `oc-chart-root ${className}` : 'oc-chart-root'}
  {style}
></div>

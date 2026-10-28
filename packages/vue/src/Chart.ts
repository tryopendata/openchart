/**
 * Vue Chart component: thin wrapper around the vanilla adapter.
 *
 * Mounts a chart instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createChart() function.
 */

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
import {
  type CSSProperties,
  defineComponent,
  h,
  inject,
  onMounted,
  onUnmounted,
  type PropType,
  ref,
  watch,
} from 'vue';
import { VizDarkModeKey, VizThemeKey } from './context';

export interface ChartProps {
  reader?: false | ReaderPresentationOptions;
  readerSelection?: ChartReaderSelection;
  /** The chart spec. Graph specs render through `<Graph />` or `<Visualization />`. */
  spec: ChartSpec | LayerSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  /** Rendering backend for point marks; see the vanilla `MountOptions.renderer`. */
  renderer?: 'auto' | 'svg' | 'canvas';
  /** Quiet row inspection for simple horizontal bars. */
  rowHover?: boolean;
  autoResize?: boolean;
  revision?: string | number;
  /** Interaction mode; inferred from the edit/select listeners when omitted. */
  interaction?: InteractionMode;
  onEdit?: (tx: EditTransaction) => void;
  onSelect?: (element: ElementRef) => void;
  onDeselect?: (element: ElementRef) => void;
  class?: string;
  style?: string | CSSProperties;
}

export const Chart = defineComponent({
  name: 'Chart',
  props: {
    reader: {
      type: [Boolean, Object] as PropType<false | ReaderPresentationOptions>,
      default: undefined,
    },
    readerSelection: { type: Object as PropType<ChartReaderSelection>, default: undefined },
    spec: {
      type: Object as PropType<ChartSpec | LayerSpec>,
      required: true,
    },
    theme: {
      type: Object as PropType<ThemeConfig>,
      default: undefined,
    },
    darkMode: {
      type: String as PropType<DarkMode>,
      default: undefined,
    },
    renderer: {
      type: String as PropType<'auto' | 'svg' | 'canvas'>,
      default: undefined,
    },
    // Declared listener props make presence reactive. Vue excludes declared
    // emits listeners from update checks, which would leave the inferred
    // interaction mode stale when a parent adds or removes a listener.
    // `@edit`, `@select`, and `@deselect` bind to these props.
    onEdit: {
      type: Function as PropType<(tx: EditTransaction) => void>,
      default: undefined,
    },
    onSelect: {
      type: Function as PropType<(element: ElementRef) => void>,
      default: undefined,
    },
    onDeselect: {
      type: Function as PropType<(element: ElementRef) => void>,
      default: undefined,
    },
    rowHover: { type: Boolean, default: undefined },
    autoResize: { type: Boolean, default: undefined },
    revision: { type: [String, Number] as PropType<string | number>, default: undefined },
    class: {
      type: String,
      default: undefined,
    },
    style: {
      type: [String, Object] as PropType<string | CSSProperties>,
      default: undefined,
    },
    selectedElement: {
      type: Object as PropType<ElementRef>,
      default: undefined,
    },
    highlight: {
      type: [Array, null] as unknown as PropType<string[] | null>,
      default: undefined,
    },
    interaction: {
      type: String as PropType<InteractionMode>,
      default: undefined,
    },
  },
  emits: {
    'reader-change': (_selection: ChartReaderSelection, _meta: ReaderChangeMeta) => true,
    'mark-click': (_event: MarkEvent) => true,
    'mark-hover': (_event: MarkEvent) => true,
    'mark-focus': (_event: MarkFocusEvent) => true,
    'mark-leave': () => true,
    'legend-toggle': (_series: string, _visible: boolean) => true,
    'annotation-click': (_annotation: Annotation, _event: MouseEvent, _element: ElementRef) => true,
    'highlight-change': (_values: string[]) => true,
    reveal: (_guess: Array<{ x: string | number; y: number }>) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: ChartInstance | null = null;
    let prevSpec = '';
    const readerBinding = createChartReaderBinding();
    function syncReader() {
      if (containerRef.value && instance)
        readerBinding.sync(
          containerRef.value,
          instance,
          props.spec,
          props.reader,
          props.readerSelection,
          (state, meta) => emit('reader-change', state, meta),
        );
    }

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return mergeThemeConfig(contextTheme?.value, props.theme);
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function mountChart() {
      const container = containerRef.value;
      if (!container) return;

      const options: MountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        renderer: props.renderer,
        onMarkClick: (event: MarkEvent) => emit('mark-click', event),
        onMarkHover: (event: MarkEvent) => emit('mark-hover', event),
        onMarkFocus: (event: MarkFocusEvent) => emit('mark-focus', event),
        onMarkLeave: () => emit('mark-leave'),
        onLegendToggle: (series: string, visible: boolean) =>
          emit('legend-toggle', series, visible),
        onAnnotationClick: (annotation: Annotation, event: MouseEvent, element: ElementRef) =>
          emit('annotation-click', annotation, event, element),
        onHighlightChange: (values: string[]) => emit('highlight-change', values),
        onReveal: (guess) => emit('reveal', guess),
        // Only include selection/edit callbacks when the parent binds a listener:
        // their presence infers the interaction mode when `interaction` is omitted.
        ...(props.onSelect ? { onSelect: (element: ElementRef) => props.onSelect?.(element) } : {}),
        ...(props.onDeselect
          ? { onDeselect: (element: ElementRef) => props.onDeselect?.(element) }
          : {}),
        ...(props.interaction != null ? { interaction: props.interaction } : {}),
        ...(props.selectedElement ? { selectedElement: props.selectedElement } : {}),
        rowHover: props.rowHover,
        autoResize: props.autoResize,
        revision: props.revision,
        ...(props.onEdit ? { onEdit: (tx: EditTransaction) => props.onEdit?.(tx) } : {}),
      };

      instance = createChart(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
      syncReader();
      if (props.highlight !== undefined) {
        instance.setHighlight(props.highlight ?? null);
      }
    }

    function destroyChart() {
      readerBinding.detach();
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    // Expose imperative methods for parent ref access
    expose({
      getSelectedElement(): ElementRef | null {
        return instance?.getSelectedElement() ?? null;
      },
      select(elementRef: ElementRef): void {
        instance?.select(elementRef);
      },
      deselect(): void {
        instance?.deselect();
      },
      get instance() {
        return instance;
      },
    });

    onMounted(() => {
      mountChart();
    });

    onUnmounted(() => {
      destroyChart();
    });

    // Watch spec and revision together so an undo that changes both updates once
    watch(
      () => [JSON.stringify(props.spec), props.revision] as const,
      ([newSpec, newRevision], [, oldRevision]) => {
        if (!instance) return;
        if (newSpec !== prevSpec || newRevision !== oldRevision) {
          prevSpec = newSpec;
          instance.update(props.spec, {
            selectedElement: props.selectedElement,
            revision: props.revision,
          });
          syncReader();
        }
      },
    );

    // Watch selectedElement prop changes
    watch(
      () => props.selectedElement,
      (newVal) => {
        if (!instance) return;
        if (newVal) {
          instance.select(newVal);
        } else {
          instance.deselect();
        }
      },
    );

    // Watch highlight prop changes
    watch(
      () => props.highlight,
      (newVal) => {
        if (!instance) return;
        instance.setHighlight(newVal ?? null);
      },
    );

    watch([() => props.reader, () => props.readerSelection], () => syncReader(), { deep: false });

    // Recreate chart when theme, darkMode, renderer, or the interaction mode
    // (explicit or inferred from listener presence) change
    watch(
      [
        () => Boolean(props.onEdit),
        () => Boolean(props.onSelect),
        () => Boolean(props.onDeselect),
        () => props.rowHover,
        () => props.autoResize,
        () => props.theme,
        () => props.darkMode,
        () => props.renderer,
        () => props.interaction,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyChart();
        mountChart();
      },
    );

    const rootClass = () => {
      const base = 'oc-chart-root';
      return props.class ? `${base} ${props.class}` : base;
    };

    return () =>
      h('div', {
        ref: containerRef,
        class: rootClass(),
        style: props.style,
      });
  },
});

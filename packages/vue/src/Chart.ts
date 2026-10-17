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
  GraphSpec,
  LayerSpec,
  MarkEvent,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
import { mergeThemeConfig } from '@opendata-ai/openchart-core';
import { type ChartInstance, createChart, type MountOptions } from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  defineComponent,
  getCurrentInstance,
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
  spec: ChartSpec | LayerSpec | GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  /** Rendering backend for point marks; see the vanilla `MountOptions.renderer`. */
  renderer?: 'auto' | 'svg' | 'canvas';
  autoResize?: boolean;
  revision?: string | number;
  onEdit?: (tx: EditTransaction) => void;
  class?: string;
  style?: string | CSSProperties;
}

export const Chart = defineComponent({
  name: 'Chart',
  props: {
    spec: {
      type: Object as PropType<ChartSpec | LayerSpec | GraphSpec>,
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
    // A declared listener prop makes presence reactive. Vue excludes declared
    // emits listeners from update checks, which would leave editing enabled
    // when a parent removes its transaction listener.
    onEdit: {
      type: Function as PropType<(tx: EditTransaction) => void>,
      default: undefined,
    },
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
    editable: {
      type: Boolean as PropType<boolean>,
      default: undefined,
    },
  },
  emits: {
    'mark-click': (_event: MarkEvent) => true,
    'mark-hover': (_event: MarkEvent) => true,
    'mark-leave': () => true,
    'legend-toggle': (_series: string, _visible: boolean) => true,
    'annotation-click': (_annotation: Annotation, _event: MouseEvent, _element: ElementRef) => true,
    select: (_element: ElementRef) => true,
    deselect: (_element: ElementRef) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: ChartInstance | null = null;
    let prevSpec = '';

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    // Check which event listeners are bound by the parent.
    // Vue 3 passes listeners as onXxx props on the component vnode.
    // Edit listener presence is a reactive prop below.
    const vm = getCurrentInstance();
    const vnodeProps = vm?.vnode.props ?? {};
    const hasSelectListener = 'onSelect' in vnodeProps;
    const hasDeselectListener = 'onDeselect' in vnodeProps;

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
        onMarkLeave: () => emit('mark-leave'),
        onLegendToggle: (series: string, visible: boolean) =>
          emit('legend-toggle', series, visible),
        onAnnotationClick: (annotation: Annotation, event: MouseEvent, element: ElementRef) =>
          emit('annotation-click', annotation, event, element),
        // Only include editing callbacks when the parent binds a listener.
        // Without this gate, every chart gets drag editing wired up.
        ...(hasSelectListener
          ? { onSelect: (element: ElementRef) => emit('select', element) }
          : {}),
        ...(hasDeselectListener
          ? { onDeselect: (element: ElementRef) => emit('deselect', element) }
          : {}),
        ...(props.editable != null ? { editable: props.editable } : {}),
        ...(props.selectedElement ? { selectedElement: props.selectedElement } : {}),
        autoResize: props.autoResize,
        revision: props.revision,
        ...(props.onEdit ? { onEdit: (tx: EditTransaction) => props.onEdit?.(tx) } : {}),
      };

      instance = createChart(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
      if (props.highlight !== undefined) {
        instance.setHighlight(props.highlight ?? null);
      }
    }

    function destroyChart() {
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

    // Watch spec changes: update if only spec changed, recreate if theme/darkMode changed
    watch(
      () => JSON.stringify(props.spec),
      (newVal) => {
        if (!instance) return;
        if (newVal !== prevSpec) {
          prevSpec = newVal;
          instance.update(props.spec, {
            selectedElement: props.selectedElement,
            revision: props.revision,
          });
        }
      },
    );

    watch(
      () => props.revision,
      () => instance?.update(props.spec, { revision: props.revision }),
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

    // Recreate chart when theme, darkMode, renderer, or editable change
    watch(
      [
        () => Boolean(props.onEdit),
        () => props.autoResize,
        () => props.theme,
        () => props.darkMode,
        () => props.renderer,
        () => props.editable,
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

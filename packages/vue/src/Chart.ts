/**
 * Vue Chart component: thin wrapper around the vanilla adapter.
 *
 * Mounts a chart instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createChart() function.
 */

import type {
  Annotation,
  AnnotationOffset,
  ChartSpec,
  DarkMode,
  ElementEdit,
  ElementRef,
  GraphSpec,
  LayerSpec,
  MarkEvent,
  TextAnnotation,
  ThemeConfig,
} from '@opendata-ai/openchart-core';
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
    'annotation-click': (_annotation: Annotation, _event: MouseEvent) => true,
    'annotation-edit': (_annotation: TextAnnotation, _updatedOffset: AnnotationOffset) => true,
    edit: (_edit: ElementEdit) => true,
    select: (_element: ElementRef) => true,
    deselect: (_element: ElementRef) => true,
    'text-edit': (_element: ElementRef, _oldText: string, _newText: string) => true,
    'data-point-click': (_data: Record<string, unknown>) => true,
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
    // We cache this at setup time since it won't change.
    const vm = getCurrentInstance();
    const vnodeProps = vm?.vnode.props ?? {};
    const hasAnnotationEditListener =
      'onAnnotation-edit' in vnodeProps || 'onAnnotationEdit' in vnodeProps;
    const hasEditListener = 'onEdit' in vnodeProps;
    const hasSelectListener = 'onSelect' in vnodeProps;
    const hasDeselectListener = 'onDeselect' in vnodeProps;
    const hasTextEditListener = 'onText-edit' in vnodeProps || 'onTextEdit' in vnodeProps;

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
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
        onDataPointClick: (data: Record<string, unknown>) => emit('data-point-click', data),
        onMarkClick: (event: MarkEvent) => emit('mark-click', event),
        onMarkHover: (event: MarkEvent) => emit('mark-hover', event),
        onMarkLeave: () => emit('mark-leave'),
        onLegendToggle: (series: string, visible: boolean) =>
          emit('legend-toggle', series, visible),
        onAnnotationClick: (annotation: Annotation, event: MouseEvent) =>
          emit('annotation-click', annotation, event),
        // Only include editing callbacks when the parent binds a listener.
        // Without this gate, every chart gets drag editing wired up.
        ...(hasAnnotationEditListener
          ? {
              onAnnotationEdit: (annotation: TextAnnotation, updatedOffset: AnnotationOffset) =>
                emit('annotation-edit', annotation, updatedOffset),
            }
          : {}),
        ...(hasEditListener ? { onEdit: (edit: ElementEdit) => emit('edit', edit) } : {}),
        ...(hasSelectListener
          ? { onSelect: (element: ElementRef) => emit('select', element) }
          : {}),
        ...(hasDeselectListener
          ? { onDeselect: (element: ElementRef) => emit('deselect', element) }
          : {}),
        ...(hasTextEditListener
          ? {
              onTextEdit: (element: ElementRef, oldText: string, newText: string) =>
                emit('text-edit', element, oldText, newText),
            }
          : {}),
        ...(props.editable != null ? { editable: props.editable } : {}),
        ...(props.selectedElement ? { selectedElement: props.selectedElement } : {}),
        responsive: true,
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
          instance.update(props.spec, { selectedElement: props.selectedElement });
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

    // Recreate chart when theme, darkMode, or editable change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
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

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
  GraphSpec,
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
  spec: ChartSpec | GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const Chart = defineComponent({
  name: 'Chart',
  props: {
    spec: {
      type: Object as PropType<ChartSpec | GraphSpec>,
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
  },
  emits: {
    'mark-click': (_event: MarkEvent) => true,
    'mark-hover': (_event: MarkEvent) => true,
    'mark-leave': () => true,
    'legend-toggle': (_series: string, _visible: boolean) => true,
    'annotation-click': (_annotation: Annotation, _event: MouseEvent) => true,
    'annotation-edit': (_annotation: TextAnnotation, _updatedOffset: AnnotationOffset) => true,
    edit: (_edit: ElementEdit) => true,
    'data-point-click': (_data: Record<string, unknown>) => true,
  },
  setup(props, { emit }) {
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
        responsive: true,
      };

      instance = createChart(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyChart() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

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
          instance.update(props.spec);
        }
      },
    );

    // Recreate chart when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
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
      const base = 'viz-chart-root';
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

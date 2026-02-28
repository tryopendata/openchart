/**
 * Vue Graph component: thin wrapper around the vanilla adapter.
 *
 * Mounts a graph instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createGraph() function.
 *
 * Exposes imperative methods via defineExpose for use with useGraph().
 */

import type { DarkMode, GraphSpec, ThemeConfig } from '@openchart/core';
import { createGraph, type GraphInstance, type GraphMountOptions } from '@openchart/vanilla';
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

export interface GraphProps {
  spec: GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  class?: string;
  style?: string | CSSProperties;
}

export const Graph = defineComponent({
  name: 'Graph',
  props: {
    spec: {
      type: Object as PropType<GraphSpec>,
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
    'node-click': (_node: Record<string, unknown>) => true,
    'node-double-click': (_node: Record<string, unknown>) => true,
    'selection-change': (_nodeIds: string[]) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: GraphInstance | null = null;
    let prevSpec = '';

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    function mountGraph() {
      const container = containerRef.value;
      if (!container) return;

      const options: GraphMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        onNodeClick: (node: Record<string, unknown>) => emit('node-click', node),
        onNodeDoubleClick: (node: Record<string, unknown>) => emit('node-double-click', node),
        onSelectionChange: (nodeIds: string[]) => emit('selection-change', nodeIds),
        responsive: true,
      };

      instance = createGraph(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
    }

    function destroyGraph() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    // Expose imperative methods for useGraph() composable
    expose({
      search(query: string) {
        instance?.search(query);
      },
      clearSearch() {
        instance?.clearSearch();
      },
      zoomToFit() {
        instance?.zoomToFit();
      },
      zoomToNode(nodeId: string) {
        instance?.zoomToNode(nodeId);
      },
      selectNode(nodeId: string) {
        instance?.selectNode(nodeId);
      },
      getSelectedNodes(): string[] {
        return instance?.getSelectedNodes() ?? [];
      },
      get instance() {
        return instance;
      },
    });

    onMounted(() => {
      mountGraph();
    });

    onUnmounted(() => {
      destroyGraph();
    });

    // Watch spec changes
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

    // Recreate graph when theme or darkMode change
    watch(
      [
        () => props.theme,
        () => props.darkMode,
        () => contextTheme?.value,
        () => contextDarkMode?.value,
      ],
      () => {
        if (!containerRef.value) return;
        destroyGraph();
        mountGraph();
      },
    );

    const rootClass = () => {
      const base = 'viz-graph-root';
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

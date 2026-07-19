/**
 * Vue Graph component: thin wrapper around the vanilla adapter.
 *
 * Mounts a graph instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createGraph() function.
 *
 * Exposes imperative methods via defineExpose for use with useGraph().
 */

import type { DarkMode, GraphSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createGraph,
  type GraphInstance,
  type GraphMountOptions,
  type GraphTooltipFormatter,
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

/** Tooltip prop: `false` off, `true` default, or an object with a formatter. */
export type GraphTooltipProp = boolean | { formatter?: GraphTooltipFormatter };
/** Legend prop: `false` off, `true` default, or an object toggling interactivity/counts. */
export type GraphLegendProp = boolean | { interactive?: boolean; counts?: boolean };

export interface GraphProps {
  spec: GraphSpec;
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  tooltip?: GraphTooltipProp;
  legend?: GraphLegendProp;
  fitOnLoad?: boolean;
  class?: string;
  style?: string | CSSProperties;
}

/** True when the tooltip is on (only the on/off decision gates recreation). */
function tooltipOn(tooltip: GraphTooltipProp | undefined): boolean {
  return tooltip !== false;
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
    tooltip: {
      type: [Boolean, Object] as PropType<GraphTooltipProp>,
      default: undefined,
    },
    legend: {
      type: [Boolean, Object] as PropType<GraphLegendProp>,
      default: undefined,
    },
    fitOnLoad: {
      type: Boolean,
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
    'node-hover': (_node: Record<string, unknown> | null) => true,
    'edge-hover': (_edge: Record<string, unknown> | null) => true,
    'selection-change': (_nodeIds: string[]) => true,
    'legend-hover': (_entry: { field: string; value: string } | null) => true,
    'legend-toggle': (_activeValues: string[]) => true,
    'highlight-change': (_nodeIds: string[] | null) => true,
    'camera-change': (_camera: { x: number; y: number; k: number }) => true,
  },
  setup(props, { emit, expose }) {
    const containerRef = ref<HTMLDivElement | null>(null);
    let instance: GraphInstance | null = null;
    let prevSpec = '';
    // First mount plays the entrance; theme/darkMode-only recreations suppress it.
    let mountedOnce = false;

    // Inject theme/darkMode from provider as fallbacks
    const contextTheme = inject(VizThemeKey, undefined);
    const contextDarkMode = inject(VizDarkModeKey, undefined);

    function resolveTheme(): ThemeConfig | undefined {
      return props.theme ?? contextTheme?.value;
    }

    function resolveDarkMode(): DarkMode | undefined {
      return props.darkMode ?? contextDarkMode?.value;
    }

    // Stable tooltip formatter wrapper. Vue props are reactive, so reading
    // `props.tooltip` at CALL time always sees the latest formatter — no stale
    // closure, no recreation when the formatter changes. When the tooltip is on
    // we always hand the vanilla layer this wrapper (falling back to defaults),
    // so a formatter can be added or swapped per-render without a remount.
    const stableTooltipFormatter: GraphTooltipFormatter = (item, defaults) => {
      const t = props.tooltip;
      const fn = t && typeof t === 'object' ? t.formatter : undefined;
      return fn ? fn(item, defaults) : defaults;
    };

    function mountGraph() {
      const container = containerRef.value;
      if (!container) return;

      const tooltipOption: GraphMountOptions['tooltip'] = tooltipOn(props.tooltip)
        ? { formatter: stableTooltipFormatter }
        : false;

      const options: GraphMountOptions = {
        theme: resolveTheme(),
        darkMode: resolveDarkMode(),
        tooltip: tooltipOption,
        legend: props.legend,
        fitOnLoad: props.fitOnLoad,
        onNodeClick: (node) => emit('node-click', node),
        onNodeDoubleClick: (node) => emit('node-double-click', node),
        onNodeHover: (node) => emit('node-hover', node),
        onEdgeHover: (edge) => emit('edge-hover', edge),
        onSelectionChange: (nodeIds) => emit('selection-change', nodeIds),
        onLegendHover: (entry) => emit('legend-hover', entry),
        onLegendToggle: (activeValues) => emit('legend-toggle', activeValues),
        onHighlightChange: (nodeIds) => emit('highlight-change', nodeIds),
        onCameraChange: (camera) => emit('camera-change', camera),
        responsive: true,
        suppressEntrance: mountedOnce,
      };

      instance = createGraph(container, props.spec, options);
      prevSpec = JSON.stringify(props.spec);
      mountedOnce = true;
    }

    function destroyGraph() {
      instance?.destroy();
      instance = null;
      prevSpec = '';
    }

    // Expose imperative methods for useGraph() composable. Every method forwards
    // opts to the underlying instance so consumers get the full vanilla API.
    expose({
      search(query: string) {
        instance?.search(query);
      },
      clearSearch() {
        instance?.clearSearch();
      },
      getSearchMatches(): string[] {
        return instance?.getSearchMatches() ?? [];
      },
      zoomToFit(opts?: Parameters<GraphInstance['zoomToFit']>[0]) {
        instance?.zoomToFit(opts);
      },
      zoomToNode(nodeId: string, opts?: Parameters<GraphInstance['zoomToNode']>[1]) {
        instance?.zoomToNode(nodeId, opts);
      },
      flyTo(
        target: Parameters<GraphInstance['flyTo']>[0],
        opts?: Parameters<GraphInstance['flyTo']>[1],
      ) {
        instance?.flyTo(target, opts);
      },
      centerAt(x: number, y: number, opts?: Parameters<GraphInstance['centerAt']>[2]) {
        instance?.centerAt(x, y, opts);
      },
      getCamera() {
        return instance?.getCamera() ?? { x: 0, y: 0, k: 1 };
      },
      selectNode(nodeId: string, opts?: Parameters<GraphInstance['selectNode']>[1]) {
        instance?.selectNode(nodeId, opts);
      },
      getSelectedNodes(): string[] {
        return instance?.getSelectedNodes() ?? [];
      },
      highlight(
        target: Parameters<GraphInstance['highlight']>[0],
        opts?: Parameters<GraphInstance['highlight']>[1],
      ) {
        instance?.highlight(target, opts);
      },
      clearHighlight() {
        instance?.clearHighlight();
      },
      getHighlight() {
        return instance?.getHighlight() ?? null;
      },
      getLegend() {
        return instance?.getLegend() ?? null;
      },
      setActiveCategories(values: string[]) {
        instance?.setActiveCategories(values);
      },
      getActiveCategories(): string[] {
        return instance?.getActiveCategories() ?? [];
      },
      updateVisuals(spec: GraphSpec) {
        instance?.updateVisuals(spec);
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

    // Recreate graph when theme or darkMode change (spec unchanged). mountedOnce
    // is already true here, so mountGraph passes suppressEntrance: true and the
    // entrance does not replay.
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
      const base = 'oc-graph-root';
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

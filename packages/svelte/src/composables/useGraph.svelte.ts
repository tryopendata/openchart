/**
 * useGraph: composable for imperative graph control.
 *
 * Returns a Svelte action and exposes graph methods (search, zoom, select, fly,
 * highlight) for programmatic control of the graph instance. The full vanilla
 * GraphInstance API is threaded through.
 *
 * Usage:
 * ```svelte
 * <script>
 *   const { action, search, zoomToFit } = useGraph(spec);
 * </script>
 * <div use:action></div>
 * ```
 *
 * Uses .svelte.ts extension so runes ($state, $effect) work outside
 * .svelte components.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import {
  type CameraFlightOptions,
  createGraph,
  type GraphHighlightTarget,
  type GraphInstance,
  type GraphLegendData,
  type GraphMountOptions,
} from '@opendata-ai/openchart-vanilla';

/** Camera transform components (graph-space). */
export type GraphCamera = { x: number; y: number; k: number };

export interface UseGraphOptions {
  /** Theme overrides. */
  theme?: GraphMountOptions['theme'];
  /** Dark mode setting. */
  darkMode?: GraphMountOptions['darkMode'];
  /** Built-in tooltip; pass an object for a custom formatter. Defaults to true. */
  tooltip?: GraphMountOptions['tooltip'];
  /** Built-in legend. Defaults to true. Pass `false` if you render your own. */
  legend?: GraphMountOptions['legend'];
  /** Fit the graph to the viewport on the first tick. Default true. */
  fitOnLoad?: GraphMountOptions['fitOnLoad'];
  /** Node click handler. */
  onNodeClick?: GraphMountOptions['onNodeClick'];
  /** Node double-click handler. */
  onNodeDoubleClick?: GraphMountOptions['onNodeDoubleClick'];
  /** Node hover handler. */
  onNodeHover?: GraphMountOptions['onNodeHover'];
  /** Edge hover handler. */
  onEdgeHover?: GraphMountOptions['onEdgeHover'];
  /** Selection change handler. */
  onSelectionChange?: GraphMountOptions['onSelectionChange'];
  /** Legend hover handler. */
  onLegendHover?: GraphMountOptions['onLegendHover'];
  /** Legend toggle handler. */
  onLegendToggle?: GraphMountOptions['onLegendToggle'];
  /** Highlight change handler. */
  onHighlightChange?: GraphMountOptions['onHighlightChange'];
  /** Camera change handler. */
  onCameraChange?: GraphMountOptions['onCameraChange'];
  /** Enable responsive resizing. Defaults to true. */
  responsive?: boolean;
}

export interface UseGraphReturn {
  /** Svelte action to attach to a container div. */
  action: (node: HTMLElement) => { destroy: () => void };
  /** Search for nodes matching a query string. */
  search: (query: string) => void;
  /** Clear the current search. */
  clearSearch: () => void;
  /** Node ids currently matching the active search query. */
  getSearchMatches: () => string[];
  /** Zoom to fit all nodes in view. Animated by default; `{ duration: 0 }` snaps. */
  zoomToFit: (opts?: CameraFlightOptions & { padding?: number }) => void;
  /** Fly to a node and zoom in (default scale 2). */
  zoomToNode: (nodeId: string, opts?: CameraFlightOptions & { scale?: number }) => void;
  /** Fly the camera to a graph-space target. */
  flyTo: (target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions) => void;
  /** Center the camera on a graph-space point (keeps current zoom). */
  centerAt: (x: number, y: number, opts?: CameraFlightOptions) => void;
  /** Current camera transform. */
  getCamera: () => GraphCamera;
  /** Select a node by id; `{ fly: true }` also flies to it. */
  selectNode: (nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions) => void;
  /** Get the currently selected node ids. */
  getSelectedNodes: () => string[];
  /** Emphasize a set of nodes; eased via the focus model. */
  highlight: (target: GraphHighlightTarget, opts?: { dimOpacity?: number }) => void;
  /** Clear any programmatic highlight (and legend toggles). */
  clearHighlight: () => void;
  /** The currently highlighted node ids, or null when nothing is highlighted. */
  getHighlight: () => string[] | null;
  /** Headless snapshot of the legend. */
  getLegend: () => GraphLegendData | null;
  /** Set the active category filter declaratively (replaces legend toggle state). */
  setActiveCategories: (values: string[]) => void;
  /** Current active category values (empty = all active, no filter). */
  getActiveCategories: () => string[];
}

export function useGraph(
  spec: () => GraphSpec,
  options?: () => UseGraphOptions | undefined,
): UseGraphReturn {
  let instance = $state<GraphInstance | null>(null);

  function action(node: HTMLElement) {
    $effect(() => {
      const currentSpec = spec();
      const opts = options?.();

      const mountOpts: GraphMountOptions = {
        theme: opts?.theme,
        darkMode: opts?.darkMode,
        tooltip: opts?.tooltip,
        legend: opts?.legend,
        fitOnLoad: opts?.fitOnLoad,
        onNodeClick: opts?.onNodeClick,
        onNodeDoubleClick: opts?.onNodeDoubleClick,
        onNodeHover: opts?.onNodeHover,
        onEdgeHover: opts?.onEdgeHover,
        onSelectionChange: opts?.onSelectionChange,
        onLegendHover: opts?.onLegendHover,
        onLegendToggle: opts?.onLegendToggle,
        onHighlightChange: opts?.onHighlightChange,
        onCameraChange: opts?.onCameraChange,
        responsive: opts?.responsive ?? true,
      };

      const graph = createGraph(node, currentSpec, mountOpts);
      instance = graph;

      return () => {
        graph.destroy();
        instance = null;
      };
    });

    return {
      destroy() {
        // $effect cleanup handles teardown
      },
    };
  }

  return {
    action,
    search(query: string) {
      instance?.search(query);
    },
    clearSearch() {
      instance?.clearSearch();
    },
    getSearchMatches(): string[] {
      return instance?.getSearchMatches() ?? [];
    },
    zoomToFit(opts?: CameraFlightOptions & { padding?: number }) {
      instance?.zoomToFit(opts);
    },
    zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }) {
      instance?.zoomToNode(nodeId, opts);
    },
    flyTo(target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions) {
      instance?.flyTo(target, opts);
    },
    centerAt(x: number, y: number, opts?: CameraFlightOptions) {
      instance?.centerAt(x, y, opts);
    },
    getCamera(): GraphCamera {
      return instance?.getCamera() ?? { x: 0, y: 0, k: 1 };
    },
    selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions) {
      instance?.selectNode(nodeId, opts);
    },
    getSelectedNodes(): string[] {
      return instance?.getSelectedNodes() ?? [];
    },
    highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }) {
      instance?.highlight(target, opts);
    },
    clearHighlight() {
      instance?.clearHighlight();
    },
    getHighlight(): string[] | null {
      return instance?.getHighlight() ?? null;
    },
    getLegend(): GraphLegendData | null {
      return instance?.getLegend() ?? null;
    },
    setActiveCategories(values: string[]) {
      instance?.setActiveCategories(values);
    },
    getActiveCategories(): string[] {
      return instance?.getActiveCategories() ?? [];
    },
  };
}

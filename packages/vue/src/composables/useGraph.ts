/**
 * useGraph: composable for imperative graph control.
 *
 * Provides a template ref to pass to <Graph /> and exposes graph methods
 * (search, zoom, select, fly, highlight) for programmatic control of the
 * graph instance. The full vanilla GraphInstance API is threaded through.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import type {
  CameraFlightOptions,
  GraphHighlightTarget,
  GraphInstance,
  GraphLegendData,
} from '@opendata-ai/openchart-vanilla';
import { type Ref, ref } from 'vue';

/** Camera transform components (graph-space). */
export type GraphCamera = { x: number; y: number; k: number };

/** Handle exposed by Graph component via expose(). */
export interface GraphHandle {
  search: (query: string) => void;
  clearSearch: () => void;
  getSearchMatches: () => string[];
  zoomToFit: (opts?: CameraFlightOptions & { padding?: number }) => void;
  zoomToNode: (nodeId: string, opts?: CameraFlightOptions & { scale?: number }) => void;
  flyTo: (target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions) => void;
  centerAt: (x: number, y: number, opts?: CameraFlightOptions) => void;
  getCamera: () => GraphCamera;
  selectNode: (nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions) => void;
  getSelectedNodes: () => string[];
  highlight: (target: GraphHighlightTarget, opts?: { dimOpacity?: number }) => void;
  clearHighlight: () => void;
  getHighlight: () => string[] | null;
  getLegend: () => GraphLegendData | null;
  /** Re-compile encoding/legend/chrome without restarting the simulation. */
  updateVisuals: (spec: GraphSpec) => void;
  /** The underlying GraphInstance from the vanilla adapter. */
  instance: GraphInstance | null;
}

export interface UseGraphReturn {
  /** Template ref to pass to <Graph ref={graphRef} />. */
  graphRef: Ref<GraphHandle | null>;
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
}

/**
 * Composable for imperative graph control.
 *
 * Usage:
 * ```vue
 * <script setup>
 * const { graphRef, search, zoomToFit } = useGraph();
 * </script>
 * <template>
 *   <Graph ref="graphRef" :spec="spec" />
 * </template>
 * ```
 */
export function useGraph(): UseGraphReturn {
  const graphRef = ref<GraphHandle | null>(null);

  function search(query: string) {
    graphRef.value?.search(query);
  }

  function clearSearch() {
    graphRef.value?.clearSearch();
  }

  function getSearchMatches(): string[] {
    return graphRef.value?.getSearchMatches() ?? [];
  }

  function zoomToFit(opts?: CameraFlightOptions & { padding?: number }) {
    graphRef.value?.zoomToFit(opts);
  }

  function zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }) {
    graphRef.value?.zoomToNode(nodeId, opts);
  }

  function flyTo(target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions) {
    graphRef.value?.flyTo(target, opts);
  }

  function centerAt(x: number, y: number, opts?: CameraFlightOptions) {
    graphRef.value?.centerAt(x, y, opts);
  }

  function getCamera(): GraphCamera {
    return graphRef.value?.getCamera() ?? { x: 0, y: 0, k: 1 };
  }

  function selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions) {
    graphRef.value?.selectNode(nodeId, opts);
  }

  function getSelectedNodes(): string[] {
    return graphRef.value?.getSelectedNodes() ?? [];
  }

  function highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }) {
    graphRef.value?.highlight(target, opts);
  }

  function clearHighlight() {
    graphRef.value?.clearHighlight();
  }

  function getHighlight(): string[] | null {
    return graphRef.value?.getHighlight() ?? null;
  }

  function getLegend(): GraphLegendData | null {
    return graphRef.value?.getLegend() ?? null;
  }

  return {
    graphRef,
    search,
    clearSearch,
    getSearchMatches,
    zoomToFit,
    zoomToNode,
    flyTo,
    centerAt,
    getCamera,
    selectNode,
    getSelectedNodes,
    highlight,
    clearHighlight,
    getHighlight,
    getLegend,
  };
}

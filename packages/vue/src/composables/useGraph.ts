/**
 * useGraph: composable for imperative graph control.
 *
 * Provides a template ref to pass to <Graph /> and exposes graph methods
 * (search, zoom, select) for programmatic control of the graph instance.
 */

import type { GraphInstance } from '@openchart/vanilla';
import { type Ref, ref } from 'vue';

/** Handle exposed by Graph component via expose(). */
export interface GraphHandle {
  search: (query: string) => void;
  clearSearch: () => void;
  zoomToFit: () => void;
  zoomToNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  getSelectedNodes: () => string[];
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
  /** Zoom to fit all nodes in view. */
  zoomToFit: () => void;
  /** Zoom and center on a specific node. */
  zoomToNode: (nodeId: string) => void;
  /** Select a node by id. */
  selectNode: (nodeId: string) => void;
  /** Get the currently selected node ids. */
  getSelectedNodes: () => string[];
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

  function zoomToFit() {
    graphRef.value?.zoomToFit();
  }

  function zoomToNode(nodeId: string) {
    graphRef.value?.zoomToNode(nodeId);
  }

  function selectNode(nodeId: string) {
    graphRef.value?.selectNode(nodeId);
  }

  function getSelectedNodes(): string[] {
    return graphRef.value?.getSelectedNodes() ?? [];
  }

  return {
    graphRef,
    search,
    clearSearch,
    zoomToFit,
    zoomToNode,
    selectNode,
    getSelectedNodes,
  };
}

/**
 * useGraph: composable for imperative graph control.
 *
 * Returns a Svelte action and exposes graph methods (search, zoom, select)
 * for programmatic control of the graph instance.
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
  createGraph,
  type GraphInstance,
  type GraphMountOptions,
} from '@opendata-ai/openchart-vanilla';

export interface UseGraphOptions {
  /** Theme overrides. */
  theme?: GraphMountOptions['theme'];
  /** Dark mode setting. */
  darkMode?: GraphMountOptions['darkMode'];
  /** Node click handler. */
  onNodeClick?: GraphMountOptions['onNodeClick'];
  /** Node double-click handler. */
  onNodeDoubleClick?: GraphMountOptions['onNodeDoubleClick'];
  /** Selection change handler. */
  onSelectionChange?: GraphMountOptions['onSelectionChange'];
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
  /** Zoom to fit all nodes in view. */
  zoomToFit: () => void;
  /** Zoom and center on a specific node. */
  zoomToNode: (nodeId: string) => void;
  /** Select a node by id. */
  selectNode: (nodeId: string) => void;
  /** Get the currently selected node ids. */
  getSelectedNodes: () => string[];
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
        onNodeClick: opts?.onNodeClick,
        onNodeDoubleClick: opts?.onNodeDoubleClick,
        onSelectionChange: opts?.onSelectionChange,
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
  };
}

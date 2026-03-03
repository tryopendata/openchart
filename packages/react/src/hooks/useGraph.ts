/**
 * useGraph: hook for imperative graph control.
 *
 * Provides a ref to pass to <Graph /> and exposes graph methods
 * (search, zoom, select) for programmatic control of the graph instance.
 */

import type { GraphInstance } from '@opendata-ai/openchart-vanilla';
import { useCallback, useRef } from 'react';

export interface UseGraphReturn {
  /** Ref to pass to <Graph ref={ref} />. */
  ref: React.RefObject<GraphHandle | null>;
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

/** Handle exposed by Graph component via forwardRef. */
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

/**
 * Hook for imperative graph control.
 *
 * Usage:
 * ```tsx
 * const { ref, search, zoomToFit } = useGraph();
 * return <Graph ref={ref} spec={spec} />;
 * ```
 */
export function useGraph(): UseGraphReturn {
  const ref = useRef<GraphHandle | null>(null);

  const search = useCallback((query: string) => {
    ref.current?.search(query);
  }, []);

  const clearSearch = useCallback(() => {
    ref.current?.clearSearch();
  }, []);

  const zoomToFit = useCallback(() => {
    ref.current?.zoomToFit();
  }, []);

  const zoomToNode = useCallback((nodeId: string) => {
    ref.current?.zoomToNode(nodeId);
  }, []);

  const selectNode = useCallback((nodeId: string) => {
    ref.current?.selectNode(nodeId);
  }, []);

  const getSelectedNodes = useCallback((): string[] => {
    return ref.current?.getSelectedNodes() ?? [];
  }, []);

  return {
    ref,
    search,
    clearSearch,
    zoomToFit,
    zoomToNode,
    selectNode,
    getSelectedNodes,
  };
}

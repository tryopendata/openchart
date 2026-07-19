/**
 * useGraph: hook for imperative graph control.
 *
 * Provides a ref to pass to <Graph /> and exposes graph methods
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
import { useCallback, useRef } from 'react';

/** Camera transform components (graph-space). */
export type GraphCamera = { x: number; y: number; k: number };

export interface UseGraphReturn {
  /** Ref to pass to <Graph ref={ref} />. */
  ref: React.RefObject<GraphHandle | null>;
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

/** Handle exposed by Graph component via forwardRef. */
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
  setActiveCategories: (values: string[]) => void;
  getActiveCategories: () => string[];
  /** Re-compile encoding/legend/chrome without restarting the simulation. */
  updateVisuals: (spec: GraphSpec) => void;
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

  const getSearchMatches = useCallback((): string[] => {
    return ref.current?.getSearchMatches() ?? [];
  }, []);

  const zoomToFit = useCallback((opts?: CameraFlightOptions & { padding?: number }) => {
    ref.current?.zoomToFit(opts);
  }, []);

  const zoomToNode = useCallback(
    (nodeId: string, opts?: CameraFlightOptions & { scale?: number }) => {
      ref.current?.zoomToNode(nodeId, opts);
    },
    [],
  );

  const flyTo = useCallback(
    (target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions) => {
      ref.current?.flyTo(target, opts);
    },
    [],
  );

  const centerAt = useCallback((x: number, y: number, opts?: CameraFlightOptions) => {
    ref.current?.centerAt(x, y, opts);
  }, []);

  const getCamera = useCallback((): GraphCamera => {
    return ref.current?.getCamera() ?? { x: 0, y: 0, k: 1 };
  }, []);

  const selectNode = useCallback(
    (nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions) => {
      ref.current?.selectNode(nodeId, opts);
    },
    [],
  );

  const getSelectedNodes = useCallback((): string[] => {
    return ref.current?.getSelectedNodes() ?? [];
  }, []);

  const highlight = useCallback((target: GraphHighlightTarget, opts?: { dimOpacity?: number }) => {
    ref.current?.highlight(target, opts);
  }, []);

  const clearHighlight = useCallback(() => {
    ref.current?.clearHighlight();
  }, []);

  const getHighlight = useCallback((): string[] | null => {
    return ref.current?.getHighlight() ?? null;
  }, []);

  const getLegend = useCallback((): GraphLegendData | null => {
    return ref.current?.getLegend() ?? null;
  }, []);

  const setActiveCategories = useCallback((values: string[]) => {
    ref.current?.setActiveCategories(values);
  }, []);

  const getActiveCategories = useCallback((): string[] => {
    return ref.current?.getActiveCategories() ?? [];
  }, []);

  return {
    ref,
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
    setActiveCategories,
    getActiveCategories,
  };
}

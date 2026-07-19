/**
 * React Graph component: thin wrapper around the vanilla adapter.
 *
 * Mounts a graph instance on render, updates when spec changes,
 * and cleans up on unmount. All heavy lifting is done by the vanilla
 * createGraph() function.
 *
 * Supports forwardRef for imperative control via useGraph() hook.
 */

import type { DarkMode, GraphSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import {
  createGraph,
  type GraphInstance,
  type GraphMountOptions,
} from '@opendata-ai/openchart-vanilla';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import type { GraphHandle } from './hooks/useGraph';
import { useVizDarkMode, useVizTheme } from './ThemeContext';

export interface GraphProps {
  /** The graph spec to render. */
  spec: GraphSpec;
  /** Theme overrides. */
  theme?: ThemeConfig;
  /** Dark mode: "auto", "force", or "off". */
  darkMode?: DarkMode;
  /** Callback when a node is clicked. */
  onNodeClick?: (node: Record<string, unknown>) => void;
  /** Callback when a node is double-clicked. */
  onNodeDoubleClick?: (node: Record<string, unknown>) => void;
  /** Callback when a node is hovered (null when hover ends). */
  onNodeHover?: (node: Record<string, unknown> | null) => void;
  /** Callback when an edge is hovered (null when hover ends). */
  onEdgeHover?: (edge: Record<string, unknown> | null) => void;
  /** Callback when selection changes. */
  onSelectionChange?: (nodeIds: string[]) => void;
  /** Show built-in tooltip on node/edge hover. Defaults to true. */
  tooltip?: boolean;
  /** Show built-in legend. Defaults to true. */
  legend?: boolean;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

/**
 * React component that renders a force-directed graph from a GraphSpec.
 *
 * Uses the vanilla adapter internally. The spec is compiled and rendered
 * on a canvas inside a wrapper div. Spec changes trigger re-renders via the
 * vanilla adapter's update() method.
 *
 * Supports ref for imperative control via useGraph() hook:
 * ```tsx
 * const { ref, search, zoomToFit } = useGraph();
 * return <Graph ref={ref} spec={spec} />;
 * ```
 */
export const Graph = forwardRef<GraphHandle, GraphProps>(function Graph(
  {
    spec,
    theme: themeProp,
    darkMode,
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onEdgeHover,
    onSelectionChange,
    tooltip,
    legend,
    className,
    style,
  },
  ref,
) {
  const contextTheme = useVizTheme();
  const contextDarkMode = useVizDarkMode();
  const theme = themeProp ?? contextTheme;
  const resolvedDarkMode = darkMode ?? contextDarkMode;
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphInstance | null>(null);
  const specRef = useRef<string>('');

  // Store event handlers in refs so they don't trigger graph recreation.
  // Inline arrow functions create new references every render, which would
  // destroy and recreate the entire graph instance without this pattern.
  const handlersRef = useRef<{
    onNodeClick?: GraphProps['onNodeClick'];
    onNodeDoubleClick?: GraphProps['onNodeDoubleClick'];
    onNodeHover?: GraphProps['onNodeHover'];
    onEdgeHover?: GraphProps['onEdgeHover'];
    onSelectionChange?: GraphProps['onSelectionChange'];
  }>({});
  handlersRef.current = {
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onEdgeHover,
    onSelectionChange,
  };

  // Stable callback wrappers that read from refs
  const stableOnNodeClick = useCallback(
    (node: Record<string, unknown>) => handlersRef.current.onNodeClick?.(node),
    [],
  );
  const stableOnNodeDoubleClick = useCallback(
    (node: Record<string, unknown>) => handlersRef.current.onNodeDoubleClick?.(node),
    [],
  );
  const stableOnNodeHover = useCallback(
    (node: Record<string, unknown> | null) => handlersRef.current.onNodeHover?.(node),
    [],
  );
  const stableOnEdgeHover = useCallback(
    (edge: Record<string, unknown> | null) => handlersRef.current.onEdgeHover?.(edge),
    [],
  );
  const stableOnSelectionChange = useCallback(
    (nodeIds: string[]) => handlersRef.current.onSelectionChange?.(nodeIds),
    [],
  );

  // Expose imperative handle for useGraph() hook
  useImperativeHandle(
    ref,
    () => ({
      search(query: string) {
        graphRef.current?.search(query);
      },
      clearSearch() {
        graphRef.current?.clearSearch();
      },
      zoomToFit() {
        graphRef.current?.zoomToFit();
      },
      zoomToNode(nodeId: string) {
        graphRef.current?.zoomToNode(nodeId);
      },
      selectNode(nodeId: string) {
        graphRef.current?.selectNode(nodeId);
      },
      getSelectedNodes() {
        return graphRef.current?.getSelectedNodes() ?? [];
      },
      updateVisuals(spec: GraphSpec) {
        graphRef.current?.updateVisuals(spec);
      },
      get instance() {
        return graphRef.current;
      },
    }),
    [],
  );

  // Mount graph and recreate when theme/darkMode change.
  // Event handlers use stable refs so they don't trigger recreation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: GraphMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      tooltip,
      legend,
      onNodeClick: stableOnNodeClick,
      onNodeDoubleClick: stableOnNodeDoubleClick,
      onNodeHover: stableOnNodeHover,
      onEdgeHover: stableOnEdgeHover,
      onSelectionChange: stableOnSelectionChange,
      responsive: true,
    };

    graphRef.current = createGraph(container, spec, options);
    specRef.current = JSON.stringify(spec);

    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
    // Only recreate when theme or darkMode change. Event handlers use stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    resolvedDarkMode,
    tooltip,
    legend,
    stableOnNodeClick,
    stableOnNodeDoubleClick,
    stableOnNodeHover,
    stableOnEdgeHover,
    stableOnSelectionChange,
  ]);

  // Update the graph when the spec changes. `update()` diffs prev↔next itself:
  // a visual-only change (same node/edge ids + same physics) preserves positions
  // without restarting the sim; anything structural reheats with a local impulse.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const specString = JSON.stringify(spec);
    if (specString === specRef.current) return;
    specRef.current = specString;

    // `update` diffs internally: same node/edge ids + same physics take the
    // position-preserving path, anything structural reheats. No wrapper-side
    // heuristic needed (the old JSON-diff silently ignored physics changes).
    graph.update(spec);
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className={className ? `oc-graph-root ${className}` : 'oc-graph-root'}
      style={style}
    />
  );
});

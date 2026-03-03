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
  /** Callback when selection changes. */
  onSelectionChange?: (nodeIds: string[]) => void;
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
    onSelectionChange,
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
    onSelectionChange?: GraphProps['onSelectionChange'];
  }>({});
  handlersRef.current = { onNodeClick, onNodeDoubleClick, onSelectionChange };

  // Stable callback wrappers that read from refs
  const stableOnNodeClick = useCallback(
    (node: Record<string, unknown>) => handlersRef.current.onNodeClick?.(node),
    [],
  );
  const stableOnNodeDoubleClick = useCallback(
    (node: Record<string, unknown>) => handlersRef.current.onNodeDoubleClick?.(node),
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
      get instance() {
        return graphRef.current;
      },
    }),
    [],
  );

  // Mount graph and recreate when theme/darkMode change.
  // Event handlers use stable refs so they don't trigger recreation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const options: GraphMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      onNodeClick: stableOnNodeClick,
      onNodeDoubleClick: stableOnNodeDoubleClick,
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
    spec,
    stableOnNodeClick,
    stableOnNodeDoubleClick,
    stableOnSelectionChange,
  ]);

  // Update graph when spec changes
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const specString = JSON.stringify(spec);
    if (specString !== specRef.current) {
      specRef.current = specString;
      graph.update(spec);
    }
  }, [spec]);

  return (
    <div
      ref={containerRef}
      className={className ? `viz-graph-root ${className}` : 'viz-graph-root'}
      style={style}
    />
  );
});

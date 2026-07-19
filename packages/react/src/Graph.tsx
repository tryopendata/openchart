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
  type GraphTooltipFormatter,
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

/** Tooltip prop: `false` off, `true` default, or an object with a formatter. */
export type GraphTooltipProp = boolean | { formatter?: GraphTooltipFormatter };
/** Legend prop: `false` off, `true` default, or an object toggling interactivity/counts. */
export type GraphLegendProp = boolean | { interactive?: boolean; counts?: boolean };

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
  /** Fired when the user hovers a legend entry (null on leave). */
  onLegendHover?: (entry: { field: string; value: string } | null) => void;
  /** Fired when legend toggle state changes; `activeValues` is the active set (empty = all). */
  onLegendToggle?: (activeValues: string[]) => void;
  /** Fired whenever the highlight set changes (programmatic or legend), null when cleared. */
  onHighlightChange?: (nodeIds: string[] | null) => void;
  /** Camera change callback, rAF-coalesced (fires at most once per rendered frame). */
  onCameraChange?: (camera: { x: number; y: number; k: number }) => void;
  /**
   * Show built-in tooltip on node/edge hover. Defaults to true. Pass an object
   * with a `formatter` to customize content.
   */
  tooltip?: GraphTooltipProp;
  /**
   * Show built-in legend. Defaults to true. Pass `false` if you render your own,
   * or an object to toggle interactivity/counts.
   */
  legend?: GraphLegendProp;
  /** Fit the graph to the viewport on the first tick. Default true. */
  fitOnLoad?: boolean;
  /** CSS class name for the wrapper div. */
  className?: string;
  /** Inline styles for the wrapper div. */
  style?: CSSProperties;
}

/** Structural (serializable) tooltip shape that participates in the mount dep key. */
function tooltipStructural(tooltip: GraphTooltipProp | undefined): boolean {
  // Only the on/off decision is structural; the formatter is a function carried
  // by the ref-trampoline, never pinned in the dep array (avoids stale closures).
  if (tooltip === false) return false;
  return true;
}

/** Structural (serializable) legend shape that participates in the mount dep key. */
function legendStructural(legend: GraphLegendProp | undefined): string {
  if (legend === false) return 'false';
  if (legend === true || legend === undefined) return 'true';
  return JSON.stringify({ interactive: legend.interactive, counts: legend.counts });
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
    onLegendHover,
    onLegendToggle,
    onHighlightChange,
    onCameraChange,
    tooltip,
    legend,
    fitOnLoad,
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
  // First run of the mount effect plays the entrance; subsequent runs (theme/
  // darkMode/structural-tooltip/legend change — all spec-unchanged) suppress it.
  const mountedOnceRef = useRef(false);

  // Store event handlers AND function-valued options in refs so they don't
  // trigger graph recreation. Inline functions create new references every
  // render, which would either destroy+recreate the graph (if pinned in the dep
  // array) or go stale (if read once at mount). The trampoline gives us stable
  // wrappers whose bodies read the LATEST handler on every call.
  const handlersRef = useRef<{
    onNodeClick?: GraphProps['onNodeClick'];
    onNodeDoubleClick?: GraphProps['onNodeDoubleClick'];
    onNodeHover?: GraphProps['onNodeHover'];
    onEdgeHover?: GraphProps['onEdgeHover'];
    onSelectionChange?: GraphProps['onSelectionChange'];
    onLegendHover?: GraphProps['onLegendHover'];
    onLegendToggle?: GraphProps['onLegendToggle'];
    onHighlightChange?: GraphProps['onHighlightChange'];
    onCameraChange?: GraphProps['onCameraChange'];
    tooltipFormatter?: GraphTooltipFormatter;
  }>({});
  handlersRef.current = {
    onNodeClick,
    onNodeDoubleClick,
    onNodeHover,
    onEdgeHover,
    onSelectionChange,
    onLegendHover,
    onLegendToggle,
    onHighlightChange,
    onCameraChange,
    tooltipFormatter: typeof tooltip === 'object' ? tooltip.formatter : undefined,
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
  const stableOnLegendHover = useCallback(
    (entry: { field: string; value: string } | null) => handlersRef.current.onLegendHover?.(entry),
    [],
  );
  const stableOnLegendToggle = useCallback(
    (activeValues: string[]) => handlersRef.current.onLegendToggle?.(activeValues),
    [],
  );
  const stableOnHighlightChange = useCallback(
    (nodeIds: string[] | null) => handlersRef.current.onHighlightChange?.(nodeIds),
    [],
  );
  const stableOnCameraChange = useCallback(
    (camera: { x: number; y: number; k: number }) => handlersRef.current.onCameraChange?.(camera),
    [],
  );
  // A stable formatter wrapper: it always calls the LATEST formatter off the ref.
  // The tooltip mount option carries this wrapper, never the raw prop function, so
  // the formatter can't go stale and can't force graph recreation.
  const stableTooltipFormatter = useCallback<GraphTooltipFormatter>(
    (item, defaults) => handlersRef.current.tooltipFormatter?.(item, defaults) ?? defaults,
    [],
  );

  // Expose imperative handle for useGraph() hook. Every method forwards opts to
  // the underlying instance so consumers get the full vanilla API surface.
  useImperativeHandle(
    ref,
    () => ({
      search(query) {
        graphRef.current?.search(query);
      },
      clearSearch() {
        graphRef.current?.clearSearch();
      },
      getSearchMatches() {
        return graphRef.current?.getSearchMatches() ?? [];
      },
      zoomToFit(opts) {
        graphRef.current?.zoomToFit(opts);
      },
      zoomToNode(nodeId, opts) {
        graphRef.current?.zoomToNode(nodeId, opts);
      },
      flyTo(target, opts) {
        graphRef.current?.flyTo(target, opts);
      },
      centerAt(x, y, opts) {
        graphRef.current?.centerAt(x, y, opts);
      },
      getCamera() {
        return graphRef.current?.getCamera() ?? { x: 0, y: 0, k: 1 };
      },
      selectNode(nodeId, opts) {
        graphRef.current?.selectNode(nodeId, opts);
      },
      getSelectedNodes() {
        return graphRef.current?.getSelectedNodes() ?? [];
      },
      highlight(target, opts) {
        graphRef.current?.highlight(target, opts);
      },
      clearHighlight() {
        graphRef.current?.clearHighlight();
      },
      getHighlight() {
        return graphRef.current?.getHighlight() ?? null;
      },
      getLegend() {
        return graphRef.current?.getLegend() ?? null;
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

  // Structural-only parts of tooltip/legend that gate recreation. The tooltip
  // formatter (a function) is deliberately excluded — it rides the trampoline.
  const tooltipOn = tooltipStructural(tooltip);
  const legendKey = legendStructural(legend);

  // Mount graph and recreate when theme/darkMode/structural options change.
  // Event handlers and the tooltip formatter use stable refs so they don't
  // trigger recreation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: spec intentionally excluded - spec changes handled via update() in Effect 2
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Rebuild the tooltip option: keep the boolean/off decision, but always pass
    // the stable formatter wrapper when tooltips are on (so a formatter can be
    // added/changed per-render without recreating the graph).
    const tooltipOption: GraphMountOptions['tooltip'] = tooltipOn
      ? { formatter: stableTooltipFormatter }
      : false;

    const options: GraphMountOptions = {
      theme,
      darkMode: resolvedDarkMode,
      tooltip: tooltipOption,
      legend,
      fitOnLoad,
      onNodeClick: stableOnNodeClick,
      onNodeDoubleClick: stableOnNodeDoubleClick,
      onNodeHover: stableOnNodeHover,
      onEdgeHover: stableOnEdgeHover,
      onSelectionChange: stableOnSelectionChange,
      onLegendHover: stableOnLegendHover,
      onLegendToggle: stableOnLegendToggle,
      onHighlightChange: stableOnHighlightChange,
      onCameraChange: stableOnCameraChange,
      responsive: true,
      // First mount plays the entrance; theme/darkMode-only recreations suppress
      // it so the reveal doesn't replay on an unchanged spec.
      suppressEntrance: mountedOnceRef.current,
    };

    graphRef.current = createGraph(container, spec, options);
    specRef.current = JSON.stringify(spec);
    mountedOnceRef.current = true;

    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
    // Only recreate when theme/darkMode/structural options change. Event handlers
    // and the tooltip formatter use stable refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    resolvedDarkMode,
    tooltipOn,
    legendKey,
    fitOnLoad,
    stableOnNodeClick,
    stableOnNodeDoubleClick,
    stableOnNodeHover,
    stableOnEdgeHover,
    stableOnSelectionChange,
    stableOnLegendHover,
    stableOnLegendToggle,
    stableOnHighlightChange,
    stableOnCameraChange,
    stableTooltipFormatter,
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

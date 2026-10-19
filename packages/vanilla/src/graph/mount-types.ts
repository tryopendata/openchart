/** Public types for graph mounts: options, tooltip formatter, legend data, and the instance API. */

import type { DarkMode, GraphSpec, ThemeConfig, TooltipContent } from '@opendata-ai/openchart-core';
import type { CameraFlightOptions } from './camera';
import type { GraphCamera, GraphFlyTarget, GraphHighlightTarget } from './types';

/** A hovered node or edge, passed to a tooltip formatter. */
export interface GraphTooltipItem {
  kind: 'node' | 'edge';
  /** The raw datum (node record, or edge record with source/target). */
  data: Record<string, unknown>;
}

/**
 * Custom tooltip content builder. Receives the hovered item and the library's
 * default {@link TooltipContent}, returns replacement content.
 *
 * Safety contract:
 * - A returned `TooltipContent` or `string` is escaped by the library (strings
 *   are inserted via `textContent`, never `innerHTML`).
 * - A returned `HTMLElement` is trusted verbatim — the host owns sanitization.
 * - `null` suppresses the tooltip for that item.
 */
export type GraphTooltipFormatter = (
  item: GraphTooltipItem,
  defaults: TooltipContent,
) => TooltipContent | string | HTMLElement | null;

/** Built-in legend data (headless mirror of the rendered legend). */
export interface GraphLegendData {
  field: string | null;
  nodes: Array<{ label: string; color: string; count?: number; active: boolean }>;
  edges: Array<{ label: string; color: string; count?: number }>;
}

export interface GraphMountOptions {
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  /**
   * Sink for advisory spec warnings from the compiler (unknown `seedNode` id,
   * deprecations, and so on). Defaults to `console.warn`. Each distinct message
   * is emitted at most once per instance, so a warning that survives every
   * recompile doesn't spam the console on `update()`.
   */
  onWarn?: (message: string) => void;
  /** Observe container resizing. Defaults to true. */
  autoResize?: boolean;
  /** Show the OpenData watermark. Defaults to true. */
  watermark?: boolean;
  /** Show the built-in tooltip; pass an object for a custom formatter. Defaults to true. */
  tooltip?: boolean | { formatter?: GraphTooltipFormatter };
  /**
   * Built-in legend. `true` (default) renders an interactive legend with counts.
   * `false` renders none (set this if you render your own legend). An object
   * toggles interactivity/counts.
   */
  legend?: boolean | { interactive?: boolean; counts?: boolean };
  onNodeClick?: (node: Record<string, unknown>) => void;
  onNodeDoubleClick?: (node: Record<string, unknown>) => void;
  onNodeHover?: (node: Record<string, unknown> | null) => void;
  onEdgeHover?: (edge: Record<string, unknown> | null) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
  /** Fired when the user hovers a legend entry (null on leave). */
  onLegendHover?: (entry: { field: string; value: string } | null) => void;
  /** Fired when legend toggle state changes; `activeValues` is the active category set (empty = all). */
  onLegendToggle?: (activeValues: string[]) => void;
  /** Fired whenever the highlight set changes (programmatic or legend), null when cleared. */
  onHighlightChange?: (nodeIds: string[] | null) => void;
  /**
   * Fit the graph to the viewport on the first tick. Default true. Set false to
   * restore a saved camera (e.g. getCamera() + flyTo) without the initial fit.
   */
  fitOnLoad?: boolean;
  /**
   * How much closer than the fit the load-time framing sits, as a multiplier on
   * the fit (2 = twice as close). Default 1. Only the opening camera uses it;
   * an explicit `zoomToFit()` still frames the whole graph. Ignored when
   * `fitOnLoad` is false.
   */
  initialZoom?: number;
  /** Camera change callback, rAF-coalesced (fires at most once per rendered frame). */
  onCameraChange?: (camera: GraphCamera) => void;
  /** Skip the entrance reveal/flight on mount (spec unchanged; used by wrappers when recreating for a theme/darkMode-only change so the entrance doesn't replay). Warmup still runs. */
  suppressEntrance?: boolean;
}

export interface GraphInstance {
  update(spec: GraphSpec): void;
  search(query: string): void;
  clearSearch(): void;
  /** Fit all nodes into the viewport. Animated by default; `{ duration: 0 }` snaps. */
  zoomToFit(opts?: CameraFlightOptions & { padding?: number }): void;
  /** Fly to a node and zoom in (default scale 2). Tracks the node while it settles. */
  zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }): void;
  /** Fly the camera to a graph-space target. */
  flyTo(target: GraphFlyTarget, opts?: CameraFlightOptions): void;
  /** Center the camera on a graph-space point (keeps current zoom). */
  centerAt(x: number, y: number, opts?: CameraFlightOptions): void;
  /**
   * Current camera. In 2D this is the zoom transform; in 3D the same `x`/`y`/`k`
   * summary plus the `position`/`target` pose. See `GraphCamera`.
   */
  getCamera(): GraphCamera;
  /** Select a node; `{ fly: true }` also flies to it (default follows interaction.select.flyTo). */
  selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions): void;
  getSelectedNodes(): string[];
  /** Node ids currently matching the active search query. */
  getSearchMatches(): string[];
  /**
   * Emphasize a set of nodes; eased via the focus model. Layers over the
   * standing category filter (`setActiveCategories`) rather than replacing it:
   * the effective set is the intersection, or the highlight alone when the two
   * are disjoint. Legend toggle state is untouched.
   */
  highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }): void;
  /**
   * Clear the transient highlight, returning to the standing category filter.
   * Does NOT clear the filter — use `setActiveCategories([])` for that.
   */
  clearHighlight(): void;
  /** The effective highlighted node ids, or null when nothing is highlighted. */
  getHighlight(): string[] | null;
  /** Headless snapshot of the legend (node categories + edge categories). */
  getLegend(): GraphLegendData;
  /** Set the active category filter declaratively (replaces legend toggle state). */
  setActiveCategories(values: string[]): void;
  /** Current active category values (empty = all active, no filter). */
  getActiveCategories(): string[];
  resize(): void;
  destroy(): void;
}

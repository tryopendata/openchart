/**
 * Graph mount API: the main entry point for vanilla JS graph usage.
 *
 * createGraph() takes a container, GraphSpec, and options, compiles the graph,
 * creates a force simulation, canvas renderer, spatial index, interaction
 * manager, and search manager, then runs an animation loop driven by
 * simulation ticks. Returns a GraphInstance with update/search/zoom/destroy.
 */

import type {
  CompileOptions,
  DarkMode,
  GraphSpec,
  ThemeConfig,
  TooltipContent,
} from '@opendata-ai/openchart-core';
import type {
  CompiledGraphEdge,
  CompiledGraphNode,
  GraphCompilation,
} from '@opendata-ai/openchart-engine';
import { buildEdgeTooltip, compileGraph } from '@opendata-ai/openchart-engine';
import {
  type CameraFlightOptions,
  clampK,
  createCameraFlight,
  createCameraFollow,
} from './graph/camera';
import { GraphCanvasRenderer } from './graph/canvas-renderer';
import { ENTRANCE_STAGGER_MAX_NODES, entranceOffsets, entranceOrder } from './graph/entrance';
import {
  composeStandingFocus,
  type FocusSnapshot,
  FocusTransition,
  layerHoverFocus,
} from './graph/focus-transition';
import { GraphInteractionManager } from './graph/interaction';
import { attachGraphKeyboardNav } from './graph/keyboard';
import { createGraphLegend, type GraphLegendController } from './graph/legend';
import { createTween, prefersReducedMotion, resolveEase } from './graph/motion';
import { AnimationScheduler, type GraphAnimation } from './graph/scheduler';
import { GraphSearchManager } from './graph/search';
import { seedNodePositions } from './graph/seed';
import { SimulationManager } from './graph/simulation';
import { SpatialIndex } from './graph/spatial-index';
import type { GraphRenderState, PositionedEdge, PositionedNode } from './graph/types';
import { diffGraphUpdate } from './graph/update-diff';
import type { SimEdge, SimNode } from './graph/worker-protocol';
import { ZoomTransform } from './graph/zoom';
import { observeResize } from './resize-observer';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A programmatic highlight target. Resolved once at call time into a node id set
 * and rendered through the focus model (eased crossfade). See {@link GraphInstance.highlight}.
 */
export type GraphHighlightTarget =
  | { nodeIds: string[] }
  | { category: { field: string; value: string | string[] } }
  | { neighborsOf: string; includeSelf?: boolean };

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
  responsive?: boolean;
  /** Show the tryOpenData.ai watermark. Defaults to true. */
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
  /** Camera change callback, rAF-coalesced (fires at most once per rendered frame). */
  onCameraChange?: (camera: { x: number; y: number; k: number }) => void;
  /** Skip the entrance reveal/flight on mount (spec unchanged; used by wrappers when recreating for a theme/darkMode-only change so the entrance doesn't replay). Warmup still runs. */
  suppressEntrance?: boolean;
}

export interface GraphInstance {
  update(spec: GraphSpec): void;
  /** Re-compile encoding/legend/chrome without restarting the simulation. Preserves node positions. */
  updateVisuals(spec: GraphSpec): void;
  search(query: string): void;
  clearSearch(): void;
  /** Fit all nodes into the viewport. Animated by default; `{ duration: 0 }` snaps. */
  zoomToFit(opts?: CameraFlightOptions & { padding?: number }): void;
  /** Fly to a node and zoom in (default scale 2). Tracks the node while it settles. */
  zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }): void;
  /** Fly the camera to a graph-space target. */
  flyTo(target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions): void;
  /** Center the camera on a graph-space point (keeps current zoom). */
  centerAt(x: number, y: number, opts?: CameraFlightOptions): void;
  /** Current camera (graph-space center-ish transform components). */
  getCamera(): { x: number; y: number; k: number };
  /** Select a node; `{ fly: true }` also flies to it (default follows interaction.select.flyTo). */
  selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions): void;
  getSelectedNodes(): string[];
  /** Node ids currently matching the active search query. */
  getSearchMatches(): string[];
  /** Emphasize a set of nodes; eased via the focus model. Resets legend toggles. */
  highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }): void;
  /** Clear any programmatic highlight (and legend toggles). */
  clearHighlight(): void;
  /** The currently highlighted node ids, or null when nothing is highlighted. */
  getHighlight(): string[] | null;
  /** Headless snapshot of the legend (node categories + edge categories). */
  getLegend(): GraphLegendData;
  resize(): void;
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Dark mode resolution
// ---------------------------------------------------------------------------

function resolveDarkMode(mode?: DarkMode): boolean {
  if (mode === 'force') return true;
  if (mode === 'off' || mode === undefined) return false;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Physics-feel gates (Phase 8)
// ---------------------------------------------------------------------------

/** Springy drag disables above this node count (warm-sim cost at scale). */
const SPRINGY_DRAG_MAX_NODES = 5000;
/** Cursor-repulsion disables above this node count (mirrors the glow gate). */
const CURSOR_FORCE_MAX_NODES = 2000;
/** Cursor pointer-feed throttle (~30Hz) so we don't post on every mousemove. */
const CURSOR_POINTER_THROTTLE_MS = 33;

/** Post-flight camera follow stops once the sim alpha settles below this. */
const FOLLOW_SETTLE_ALPHA = 0.05;

// ---------------------------------------------------------------------------
// Main API
// ---------------------------------------------------------------------------

/**
 * Create a graph instance from a spec and mount it into a container.
 *
 * @param container - The DOM element to render into.
 * @param spec - The graph spec.
 * @param options - Mount options.
 * @returns A GraphInstance with update/search/zoom/destroy methods.
 */
export function createGraph(
  container: HTMLElement,
  spec: GraphSpec,
  options?: GraphMountOptions,
): GraphInstance {
  let currentSpec = spec;
  let compilation: GraphCompilation;
  let destroyed = false;

  // DOM elements
  let wrapper: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let chromeEl: HTMLElement | null = null;
  let legendEl: HTMLElement | null = null;
  let legendController: GraphLegendController | null = null;

  // Subsystems
  let renderer: GraphCanvasRenderer | null = null;
  let simulation: SimulationManager | null = null;
  const spatialIndex = new SpatialIndex();
  let interactionManager: GraphInteractionManager | null = null;
  const searchManager = new GraphSearchManager();
  let tooltipManager: TooltipManager | null = null;
  let cleanupKeyboard: (() => void) | null = null;
  let disconnectResize: (() => void) | null = null;

  // State
  let positionedNodes: PositionedNode[] = [];
  let positionedEdges: PositionedEdge[] = [];
  let adjacencyMap = new Map<string, Set<string>>();
  let nodeDataMap = new Map<string, Record<string, unknown>>();
  let edgeDataMap = new Map<string, Record<string, unknown>>();
  let hoveredNodeId: string | null = null;
  let hoveredEdgeId: string | null = null;
  let selectedNodeIds = new Set<string>();
  let animFrameId: number | null = null;
  let needsRender = false;
  let isGesturing = false;
  // Continuous-animation scheduler. Arms the first frame via scheduleRender on
  // the idle→active transition; the render loop ticks it each frame and re-arms
  // only while it stays active, so the base loop stays strictly dirty-flag.
  const scheduler = new AnimationScheduler(() => scheduleRender());
  let gestureTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastEdgeHitTime = 0;
  // Cursor-repulsion pointer-feed throttle timestamp (Phase 8).
  let lastPointerFeedTime = 0;
  // Camera flight state.
  let activeFlight: GraphAnimation | null = null;
  // Post-flight follow for provider-form flights (tracks a still-settling node).
  let activeFollow: GraphAnimation | null = null;
  // Latest simulation alpha, fed by onTick; the follow stops below the threshold.
  let lastAlpha = 1;
  let cameraChangePending = false;

  // Focus / highlight state (Phase 5). One highlight slot with two writers:
  // programmatic highlight() and legend toggles. `highlightSet` is the resolved
  // node id set (null = nothing highlighted); `activeCategories` holds legend
  // toggle state (empty = all active, no dimming). Whichever wrote last wins.
  let highlightSet: Set<string> | null = null;
  let highlightDimOpacity: number | null = null;
  let activeCategories = new Set<string>();
  // Node id → its legend-field category value, for category-based highlight.
  let nodeCategory = new Map<string, string>();
  // The live focus crossfade, driving eased dimming. Rebuilt on first render.
  let focusTransition: FocusTransition | null = null;
  // Scheduler animation that keeps frames dirty while the focus crossfade runs.
  let focusAnim: GraphAnimation | null = null;
  // Hovered-node radius tween (1 → 1.15), null when settled at 1.
  let hoverRadiusTween: { nodeId: string; scale: number } | null = null;

  // Entrance choreography state (Phase 6). `entranceProgress` is a mount-level
  // 0→1 value read by buildRenderState; < 1 means the reveal is mid-flight.
  // `entranceActive` gates the render-state `entrance` field. `entranceFitInFlight`
  // tracks the entrance camera flight so a resize can cancel just it (keeping the
  // reveal). `entranceReveal` is the scheduler tween driving `entranceProgress`.
  let entranceProgress = 1;
  let entranceActive = false;
  let entranceStagger = false;
  // Pop choreography inputs (staggered entrances only): centroid-radial stagger
  // rank and per-node convergence drift vectors, built once at entrance start.
  let entranceOrderMap: Map<string, number> | null = null;
  let entranceOffsetMap: Map<string, { x: number; y: number }> | null = null;
  let entranceFitInFlight = false;
  let entranceReveal: GraphAnimation | null = null;
  // Mount-level opt-out (Phase 9): when set, the FIRST entrance takes the instant
  // -fit branch (no 0.92 pullback, no reveal tween, no camera flight) even under
  // normal motion. Wrappers set this when recreating for a theme/darkMode-only
  // change so the entrance doesn't replay. Warmup still runs. One-shot.
  let suppressEntranceOnce = options?.suppressEntrance ?? false;

  // Data-update transition state (Phase 7). `enterAlphaMap` fades newly-added
  // nodes in over update.duration (null when no enter-fade is live). `exiting`
  // holds ghost marks (removed nodes/edges) fading out over exit.duration; both
  // are read by buildRenderState and drawn by the canvas renderer.
  let enterAlphaMap: Map<string, number> | null = null;
  let exitingGhosts: { nodes: PositionedNode[]; edges: PositionedEdge[]; alpha: number } | null =
    null;

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function markGesture(): void {
    isGesturing = true;
    if (gestureTimeout !== null) clearTimeout(gestureTimeout);
    gestureTimeout = setTimeout(() => {
      isGesturing = false;
      gestureTimeout = null;
      needsRender = true;
      scheduleRender();
    }, 150);
  }

  function getContainerDimensions(): { width: number; height: number } {
    const rect = container.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  function compile(): GraphCompilation {
    const { width, height } = getContainerDimensions();
    const darkMode = resolveDarkMode(options?.darkMode);

    const compileOpts: CompileOptions = {
      width,
      height,
      theme: options?.theme,
      darkMode,
      watermark: options?.watermark,
    };

    return compileGraph(currentSpec, compileOpts);
  }

  function buildDataMaps(): void {
    nodeDataMap = new Map(compilation.nodes.map((n) => [n.id, n.data ?? {}]));
    edgeDataMap = new Map(compilation.edges.map((e) => [`${e.source}->${e.target}`, e.data ?? {}]));

    // Node → legend-field category value, for category hover/highlight. Empty
    // when the graph has no categorical color field.
    nodeCategory = new Map();
    const field = compilation.legendField;
    if (field) {
      for (const n of compilation.nodes) {
        const v = n.data?.[field];
        if (v != null) nodeCategory.set(n.id, String(v));
      }
    }
  }

  function buildAdjacencyMap(edges: CompiledGraphEdge[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const edge of edges) {
      if (!map.has(edge.source)) map.set(edge.source, new Set());
      if (!map.has(edge.target)) map.set(edge.target, new Set());
      map.get(edge.source)!.add(edge.target);
      map.get(edge.target)!.add(edge.source);
    }
    return map;
  }

  function toSimNodes(nodes: CompiledGraphNode[]): SimNode[] {
    return nodes.map((n) => ({
      id: n.id,
      radius: n.radius,
      community: n.community,
    }));
  }

  function toSimEdges(edges: CompiledGraphEdge[]): SimEdge[] {
    return edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));
  }

  /**
   * Look up a node's data from the compilation by id.
   * Falls back to an empty object if not found.
   */
  function nodeDataById(nodeId: string): Record<string, unknown> {
    return nodeDataMap.get(nodeId) ?? {};
  }

  /**
   * Point-to-line-segment distance for edge hit testing.
   * Returns the shortest distance from point (px, py) to the segment (ax, ay)-(bx, by).
   */
  function pointToSegmentDist(
    px: number,
    py: number,
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ): number {
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - ax, py - ay);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  /**
   * Find the edge closest to a graph-space point, within a threshold.
   * Returns an edge key "source->target" or null.
   */
  function hitTestEdge(graphX: number, graphY: number, threshold: number): string | null {
    let bestDist = threshold;
    let bestEdgeId: string | null = null;

    for (const edge of positionedEdges) {
      const dist = pointToSegmentDist(
        graphX,
        graphY,
        edge.sourceX,
        edge.sourceY,
        edge.targetX,
        edge.targetY,
      );
      if (dist < bestDist) {
        bestDist = dist;
        bestEdgeId = `${edge.source}->${edge.target}`;
      }
    }

    return bestEdgeId;
  }

  /**
   * Look up edge data by edge id ("source->target").
   */
  function edgeDataById(edgeId: string): Record<string, unknown> | null {
    return edgeDataMap.get(edgeId) ?? null;
  }

  // ---------------------------------------------------------------------------
  // DOM creation
  // ---------------------------------------------------------------------------

  function createDOM(): void {
    const { width, height } = getContainerDimensions();
    const isDark = resolveDarkMode(options?.darkMode);

    // Wrapper
    wrapper = document.createElement('div');
    wrapper.className = isDark ? 'oc-graph-wrapper oc-dark' : 'oc-graph-wrapper';
    if (isDark) {
      container.classList.add('oc-dark');
    } else {
      container.classList.remove('oc-dark');
    }

    // Apply theme colors as CSS custom properties so chrome HTML picks them up.
    // Without this, consumer-supplied theme.colors.text only affects canvas-drawn
    // labels but not the HTML title/subtitle which read from --oc-text.
    const resolvedTheme = compilation.theme;
    if (resolvedTheme) {
      const s = wrapper.style;
      s.setProperty('--oc-bg', resolvedTheme.colors.background);
      s.setProperty('--oc-text', resolvedTheme.colors.text);
      s.setProperty('--oc-text-secondary', resolvedTheme.colors.axis ?? resolvedTheme.colors.text);
      s.setProperty('--oc-font-family', resolvedTheme.fonts.family);
      s.fontFamily = resolvedTheme.fonts.family;
    }

    // Chrome (title, subtitle)
    chromeEl = document.createElement('div');
    chromeEl.className = 'oc-graph-chrome';
    renderChrome();
    wrapper.appendChild(chromeEl);

    // Canvas
    canvas = document.createElement('canvas');
    canvas.className = 'oc-graph-canvas';
    canvas.setAttribute('role', 'img');
    if (compilation.a11y?.altText) {
      canvas.setAttribute('aria-label', compilation.a11y.altText);
    }
    wrapper.appendChild(canvas);

    // Legend
    if (options?.legend !== false) {
      legendEl = document.createElement('div');
      legendEl.className = 'oc-graph-legend';
      renderLegend();
      wrapper.appendChild(legendEl);
    }

    container.appendChild(wrapper);
    syncChromeInset();

    // Canvas uses the full container height; chrome overlays on top
    const canvasHeight = Math.max(height, 200);
    renderer = new GraphCanvasRenderer(canvas);
    renderer.resize(width, canvasHeight);
  }

  function renderChrome(): void {
    if (!chromeEl) return;
    let html = '';

    if (compilation.chrome.title) {
      html += `<h2 class="oc-title">${escapeHtml(compilation.chrome.title.text)}</h2>`;
    }
    if (compilation.chrome.subtitle) {
      html += `<p class="oc-subtitle">${escapeHtml(compilation.chrome.subtitle.text)}</p>`;
    }

    chromeEl.innerHTML = html;

    // Hide chrome if empty
    if (!html) {
      chromeEl.style.display = 'none';
    } else {
      chromeEl.style.display = '';
    }
  }

  /** Resolve legend interactive/counts flags from the legend option. */
  function legendConfig(): { interactive: boolean; counts: boolean } {
    const l = options?.legend;
    if (l && typeof l === 'object') {
      return { interactive: l.interactive ?? true, counts: l.counts ?? true };
    }
    return { interactive: true, counts: true };
  }

  /** Build the legend view data from the compilation + current toggle state. */
  function legendViewData(): { nodes: GraphLegendData['nodes']; edges: GraphLegendData['edges'] } {
    return { nodes: getLegend().nodes, edges: getLegend().edges };
  }

  /** Create or refresh the interactive legend from current state. */
  function renderLegend(): void {
    if (!legendEl) return;
    const cfg = legendConfig();
    if (!legendController) {
      legendController = createGraphLegend(legendEl, legendViewData(), {
        interactive: cfg.interactive,
        counts: cfg.counts,
        onToggle: (value) => toggleLegendCategory(value),
        onHover: (value) => {
          const field = compilation.legendField;
          options?.onLegendHover?.(value !== null && field ? { field, value } : null);
        },
      });
    } else {
      legendController.update(legendViewData());
    }
  }

  /** Re-render the legend to reflect the current active-category state. */
  function syncLegendActiveState(): void {
    if (legendController) legendController.update(legendViewData());
    syncChromeInset();
  }

  /**
   * Keep the chrome block out of the legend's column: the title/subtitle wrap
   * before they reach the legend box instead of running underneath it. No-op
   * when there's no legend (or it has no measurable width, e.g. in happy-dom).
   */
  function syncChromeInset(): void {
    if (!chromeEl) return;
    const legendW = legendEl?.offsetWidth ?? 0;
    chromeEl.style.right = legendW > 0 ? `${legendW + 24}px` : '';
  }

  /**
   * Height of the chrome overlay band (title + subtitle) the camera fit should
   * reserve, so nodes never settle underneath the text. 0 when chrome is empty
   * or unmeasurable (happy-dom).
   */
  function chromeInsetTop(): number {
    if (!chromeEl || chromeEl.style.display === 'none') return 0;
    return chromeEl.offsetHeight;
  }

  // ---------------------------------------------------------------------------
  // Physics-feel gates (Phase 8)
  // ---------------------------------------------------------------------------

  /**
   * Springy drag on: config opts in AND the graph is small enough that holding
   * the sim warm during a drag is cheap. Off/above threshold → legacy pin/unpin.
   */
  function springyDragEnabled(): boolean {
    return (
      compilation.interaction.springyDrag && compilation.nodes.length <= SPRINGY_DRAG_MAX_NODES
    );
  }

  /**
   * Cursor repulsion on: config opts in, the graph is small enough (mirrors the
   * glow gate), and reduced motion is off (ambient pointer-driven motion is
   * exactly what reduced-motion suppresses).
   */
  function cursorForceEnabled(): boolean {
    return (
      compilation.interaction.cursorRepulsion !== null &&
      compilation.nodes.length <= CURSOR_FORCE_MAX_NODES &&
      !prefersReducedMotion()
    );
  }

  // ---------------------------------------------------------------------------
  // Simulation and animation
  // ---------------------------------------------------------------------------

  /**
   * Create the simulation for the current compilation.
   *
   * On the initial mount (no `opts`), every node is seeded deterministically and
   * a fresh warmup runs. On a data update, `opts` supplies pre-known positions
   * (survivors keep their prior x/y; enterers get spawn positions), suppresses
   * the center force (it snaps every node by the full centroid error on tick 1,
   * the global-jump artifact this phase eliminates), and overrides the initial
   * alpha to the local-reheat impulse. Update sims skip warmup — survivors are
   * already settled, so a headless warmup would just churn them.
   */
  function initSimulation(opts?: {
    positions?: Map<string, { x: number; y: number }>;
    suppressCenter?: boolean;
    initialAlpha?: number;
    skipWarmup?: boolean;
    skipEntrance?: boolean;
  }): void {
    const simNodes = toSimNodes(compilation.nodes);
    const simEdges = toSimEdges(compilation.edges);
    const config = compilation.simulationConfig;

    if (opts?.positions) {
      // Update path: place each node at its known (survivor or spawn) position.
      // Any node without a supplied position (shouldn't happen) falls back to the
      // seeded disc so it isn't stuck at the origin.
      seedNodePositions(simNodes, config.seed ?? 0);
      for (const n of simNodes) {
        const p = opts.positions.get(n.id);
        if (p) {
          n.x = p.x;
          n.y = p.y;
        }
      }
    } else {
      // Initial mount: seed deterministic positions BEFORE the simulation starts,
      // so the settled layout is reproducible for a given (spec, seed).
      seedNodePositions(simNodes, config.seed ?? 0);
    }

    simulation = SimulationManager.create(simNodes, simEdges, {
      chargeStrength: config.chargeStrength,
      linkDistance: config.linkDistance,
      clustering: config.clustering,
      alphaDecay: config.alphaDecay,
      velocityDecay: config.velocityDecay,
      collisionRadius: config.collisionRadius,
      collisionPadding: config.collisionPadding,
      linkStrength: config.linkStrength,
      // Update sims suppress the (non-alpha-scaled) center force to avoid a
      // global jump on tick 1; the alpha-scaled forceX/forceY gravity still
      // holds the layout centered.
      centerForce: opts?.suppressCenter ? false : config.centerForce,
      warmupTicks: opts?.skipWarmup ? 0 : config.warmupTicks,
      warmupBudgetMs: config.warmupBudgetMs,
      initialAlpha: opts?.initialAlpha ?? config.initialAlpha,
      // Cursor force radius/strength (null when disabled or gated off by node
      // count). The mount only feeds pointer positions when the same gate holds.
      cursorRepulsion: cursorForceEnabled() ? compilation.interaction.cursorRepulsion : null,
    });

    // A fresh sim starts hot; don't let a settled previous sim's alpha linger
    // (it would end a post-flight camera follow before the first tick lands).
    lastAlpha = opts?.initialAlpha ?? 1;

    let initialSettleDone = false;
    // Update sims keep the current camera and don't run the entrance reveal, so
    // pre-mark the fit as done — the first update tick just streams positions.
    let initialFitDone = opts?.skipEntrance ?? false;

    simulation.onTick((positions, alpha) => {
      if (destroyed) return;
      lastAlpha = alpha;

      // Build position lookup
      const posMap = new Map<string, { x: number; y: number }>();
      for (const p of positions) {
        posMap.set(p.id, { x: p.x, y: p.y });
      }

      // Build positioned nodes
      positionedNodes = compilation.nodes.map((node, index) => {
        const pos = posMap.get(node.id) ?? { x: 0, y: 0 };
        return { ...node, x: pos.x, y: pos.y, index };
      });

      // Build positioned edges
      positionedEdges = compilation.edges.map((edge) => {
        const src = posMap.get(edge.source) ?? { x: 0, y: 0 };
        const tgt = posMap.get(edge.target) ?? { x: 0, y: 0 };
        return {
          ...edge,
          sourceX: src.x,
          sourceY: src.y,
          targetX: tgt.x,
          targetY: tgt.y,
        };
      });

      // Rebuild spatial index
      spatialIndex.rebuild(positionedNodes);

      // Fit + entrance choreography on the FIRST post-warmup tick (the sim only
      // starts streaming ticks once warmup, if any, has completed). After that,
      // let the user interact freely while the simulation keeps settling.
      if (
        !initialFitDone &&
        positionedNodes.length > 0 &&
        interactionManager &&
        options?.fitOnLoad !== false
      ) {
        initialFitDone = true;
        startEntrance();
      } else if (!initialFitDone && options?.fitOnLoad === false) {
        // Skip the fit but mark it done so a saved camera (getCamera/flyTo) sticks.
        initialFitDone = true;
      }

      needsRender = true;
      scheduleRender();
    });

    simulation.onSettled(() => {
      if (initialSettleDone) return;
      initialSettleDone = true;
    });
  }

  /**
   * Compute the initial fit transform. Bypasses fitBounds' spread inflation when
   * warmup ran (warmed bounds are near-final; inflating them fits too small).
   */
  function computeInitialFit(): ZoomTransform {
    const { width: cw, height: ch } = getCanvasDimensions();
    const warmed = (compilation.simulationConfig.warmupTicks ?? 0) > 0;
    const { transform } = ZoomTransform.fitBounds(positionedNodes, cw, ch, undefined, {
      spread: !warmed,
      insetTop: chromeInsetTop(),
    });
    return transform;
  }

  /**
   * Fit + run the entrance reveal on the first post-warmup tick. Under an enabled
   * `enter` phase and normal motion, the camera starts pulled back to 0.92× the
   * fit and (optionally) flies in while a mount-level `entranceProgress` tween
   * ramps node/edge/label reveal. Under reduced motion or `animation: false`,
   * it's an instant fit (warmup still ran — it reduces motion, it isn't motion).
   */
  function startEntrance(): void {
    if (!interactionManager) return;
    const fit = computeInitialFit();
    const enter = compilation.animation?.enter ?? null;
    // One-shot mount-level suppression (theme/darkMode remount): take the same
    // instant-fit branch as reduced motion so the entrance doesn't replay.
    const suppressed = suppressEntranceOnce;
    suppressEntranceOnce = false;

    if (suppressed || !enter || prefersReducedMotion()) {
      interactionManager.setTransform(fit);
      cameraChangePending = true;
      entranceActive = false;
      entranceProgress = 1;
      return;
    }

    // Start pulled back so the reveal has somewhere to fly in from.
    const { width: cw, height: ch } = getCanvasDimensions();
    const pulledBack = fit.zoomAt(fit.k * 0.85, cw / 2, ch / 2);
    interactionManager.setTransform(pulledBack);
    cameraChangePending = true;

    entranceActive = true;
    entranceProgress = 0;
    // Stagger only when the spec asks for it AND the graph is small enough that
    // per-node start times still batch. Above the cap: a single global fade.
    entranceStagger = enter.stagger && positionedNodes.length <= ENTRANCE_STAGGER_MAX_NODES;
    // Pop choreography inputs, computed once against the warmed (near-final)
    // positions: centroid-radial stagger order + per-node convergence drift.
    if (entranceStagger) {
      entranceOrderMap = entranceOrder(positionedNodes);
      entranceOffsetMap = entranceOffsets(positionedNodes);
    } else {
      entranceOrderMap = null;
      entranceOffsetMap = null;
    }

    // Optional camera flight from the pulled-back framing to the true fit.
    if (enter.cameraFit) {
      entranceFitInFlight = true;
      flyCamera(fit, { duration: enter.duration + 100 }, () => {
        entranceFitInFlight = false;
      });
    }

    // Reveal tween drives entranceProgress 0→1; ends the entrance on completion.
    const ease = resolveEase(enter.ease);
    entranceReveal = createTween({
      duration: enter.duration,
      ease,
      apply: (t) => {
        entranceProgress = t;
        needsRender = true;
      },
      onDone: () => {
        entranceProgress = 1;
        entranceActive = false;
        entranceReveal = null;
        needsRender = true;
      },
    });
    scheduler.add(entranceReveal);
  }

  function getCanvasDimensions(): { width: number; height: number } {
    if (!canvas) return { width: 600, height: 400 };
    const rect = canvas.getBoundingClientRect();
    return {
      width: Math.max(rect.width || 600, 100),
      height: Math.max(rect.height || 400, 100),
    };
  }

  function scheduleRender(): void {
    if (animFrameId !== null || destroyed) return;
    animFrameId = requestAnimationFrame(renderFrame);
  }

  // -------------------------------------------------------------------------
  // Focus model (Phase 5): highlight ∩ search + hover neighborhood, eased.
  // -------------------------------------------------------------------------

  /** Neighborhood of the hovered node under the resolved hover mode. */
  function hoverConnectedSet(nodeId: string | null): Set<string> | null {
    if (nodeId === null) return null;
    if (compilation.interaction.hoverMode === 'category') {
      const cat = nodeCategory.get(nodeId);
      const set = new Set<string>([nodeId]);
      if (cat !== undefined) {
        for (const [id, c] of nodeCategory) if (c === cat) set.add(id);
      }
      return set;
    }
    // 'neighbors' (default): the node plus its adjacency.
    const set = new Set<string>([nodeId]);
    const neighbors = adjacencyMap.get(nodeId);
    if (neighbors) for (const nid of neighbors) set.add(nid);
    return set;
  }

  /** The standing (non-hover) focus from highlight + search + selection. */
  function standingSnapshot(): FocusSnapshot {
    return composeStandingFocus(
      highlightSet,
      searchManager.getMatches(),
      selectedNodeIds,
      adjacencyMap,
    );
  }

  /** The full target snapshot = standing state with the hover layer on top. */
  function targetSnapshot(): FocusSnapshot {
    return layerHoverFocus(standingSnapshot(), hoveredNodeId, hoverConnectedSet(hoveredNodeId));
  }

  /**
   * Point the focus crossfade at the current target and arm a scheduler
   * animation that keeps frames dirty until it settles. Snaps instantly under
   * reduced motion or when hover animation is disabled.
   */
  function armFocus(now: number): void {
    const target = targetSnapshot();
    const hoverCfg = compilation.animation?.hover ?? null;
    const duration = hoverCfg && !prefersReducedMotion() ? hoverCfg.duration : 0;
    const ease = resolveEase(hoverCfg?.ease ?? 'smooth');

    if (!focusTransition) {
      focusTransition = new FocusTransition(target, duration, ease, now);
      return;
    }
    focusTransition.retarget(target, now);

    // Keep the crossfade running via a scheduler animation until settled.
    if (focusAnim) scheduler.remove(focusAnim);
    focusAnim = {
      tick: (t: number): boolean => {
        const running = focusTransition !== null && !focusTransition.isSettled(t);
        if (!running) focusAnim = null;
        return running;
      },
      finish: (): void => {
        focusAnim = null;
      },
      cancel: (): void => {
        focusAnim = null;
      },
    };
    scheduler.add(focusAnim);
  }

  /** Recompute the highlight set and re-arm the focus crossfade. */
  function refreshFocus(): void {
    armFocus(performance.now());
    needsRender = true;
    scheduleRender();
  }

  /** Resolve a highlight target into a concrete node id set. */
  function resolveHighlightTarget(target: GraphHighlightTarget): Set<string> {
    if ('nodeIds' in target) return new Set(target.nodeIds);
    if ('neighborsOf' in target) {
      const set = new Set<string>();
      if (target.includeSelf !== false) set.add(target.neighborsOf);
      const neighbors = adjacencyMap.get(target.neighborsOf);
      if (neighbors) for (const nid of neighbors) set.add(nid);
      return set;
    }
    // Category form: match nodes whose `field` value is in `value`.
    const values = new Set(
      Array.isArray(target.category.value) ? target.category.value : [target.category.value],
    );
    const field = target.category.field;
    const set = new Set<string>();
    for (const n of compilation.nodes) {
      const v = n.data?.[field];
      if (v != null && values.has(String(v))) set.add(n.id);
    }
    return set;
  }

  /** Node ids for the active legend categories (empty categories = no filter). */
  function categoryHighlightSet(): Set<string> | null {
    if (activeCategories.size === 0) return null;
    const set = new Set<string>();
    for (const [id, cat] of nodeCategory) if (activeCategories.has(cat)) set.add(id);
    return set;
  }

  /** Fire onHighlightChange with the current highlight set. */
  function emitHighlightChange(): void {
    options?.onHighlightChange?.(highlightSet ? [...highlightSet] : null);
  }

  /** Apply the resolved initialHighlight from the compilation, if any. */
  function applyInitialHighlight(): void {
    const init = compilation.initialHighlight;
    if (!init) return;
    activeCategories = new Set(init.values);
    highlightSet = categoryHighlightSet();
    highlightDimOpacity = null;
  }

  /** Start (or cancel) the hovered node's 1 → 1.15 radius tween. */
  function startHoverRadiusTween(nodeId: string | null): void {
    const hoverCfg = compilation.animation?.hover ?? null;
    // No hover animation, reduced motion, or hover-off → snap (no tween).
    if (nodeId === null || !hoverCfg || prefersReducedMotion()) {
      hoverRadiusTween = nodeId ? { nodeId, scale: 1.15 } : null;
      return;
    }
    hoverRadiusTween = { nodeId, scale: 1 };
    const ease = resolveEase(hoverCfg.ease);
    const tween = createTween({
      duration: hoverCfg.duration,
      ease,
      apply: (t) => {
        // Guard against a newer hover having replaced the target mid-tween.
        if (hoverRadiusTween?.nodeId === nodeId) hoverRadiusTween.scale = 1 + 0.15 * t;
        needsRender = true;
      },
      onDone: () => {
        if (hoverRadiusTween?.nodeId === nodeId) hoverRadiusTween.scale = 1.15;
      },
    });
    scheduler.add(tween);
  }

  /** Resolve tooltip content for a node, applying a custom formatter if set. */
  function showNodeTooltip(nodeId: string): void {
    if (!tooltipManager || !interactionManager) return;
    const defaults = compilation.tooltipDescriptors.get(nodeId);
    if (!defaults) return;
    const node = positionedNodes.find((n) => n.id === nodeId);
    if (!node) return;
    const screen = interactionManager.getTransform().graphToScreen(node.x, node.y);

    const formatter = tooltipFormatter();
    if (!formatter) {
      tooltipManager.show(defaults, screen.x, screen.y);
      return;
    }
    const result = formatter({ kind: 'node', data: nodeDataById(nodeId) }, defaults);
    applyFormatterResult(result, screen.x, screen.y);
  }

  /** Resolve tooltip content for an edge (lazy default), applying a formatter. */
  function showEdgeTooltip(
    edgeId: string,
    data: Record<string, unknown>,
    screenX: number,
    screenY: number,
  ): void {
    if (!tooltipManager) return;
    const edge = compilation.edges.find((e) => `${e.source}->${e.target}` === edgeId);
    const defaults = edge ? buildEdgeTooltip(edge) : { title: edgeId, fields: [] };

    const formatter = tooltipFormatter();
    if (!formatter) {
      tooltipManager.show(defaults, screenX, screenY);
      return;
    }
    const result = formatter({ kind: 'edge', data }, defaults);
    applyFormatterResult(result, screenX, screenY);
  }

  /** The configured tooltip formatter, or null when tooltips are plain. */
  function tooltipFormatter(): GraphTooltipFormatter | null {
    const t = options?.tooltip;
    return t && typeof t === 'object' ? (t.formatter ?? null) : null;
  }

  /** Route a formatter's return value to the tooltip manager (or hide on null). */
  function applyFormatterResult(
    result: TooltipContent | string | HTMLElement | null,
    x: number,
    y: number,
  ): void {
    if (!tooltipManager) return;
    if (result === null) {
      tooltipManager.hide();
    } else if (typeof result === 'string') {
      tooltipManager.show({ text: result }, x, y);
    } else if (result instanceof HTMLElement) {
      tooltipManager.show({ element: result }, x, y);
    } else {
      tooltipManager.show(result, x, y);
    }
  }

  /** Build the immutable per-frame render state from current mount state. */
  function buildRenderState(now: number): GraphRenderState {
    const transform = interactionManager!.getTransform();

    // Ensure a focus transition exists (first render), pointed at current state.
    if (!focusTransition) armFocus(now);
    const ft = focusTransition as FocusTransition;
    const t = ft.progress(now);
    const focus = t < 1 ? { t, prev: ft.prev, next: ft.next } : undefined;
    // When settled we still pass the resting snapshot as `next` for the fast path.
    const settledNext = ft.next;

    const hoverRadiusScale = hoverRadiusTween
      ? new Map([[hoverRadiusTween.nodeId, hoverRadiusTween.scale]])
      : undefined;

    return {
      nodes: positionedNodes,
      edges: positionedEdges,
      transform: { x: transform.x, y: transform.y, k: transform.k },
      hoveredNodeId,
      hoveredEdgeId,
      selectedNodeIds,
      adjacencyMap,
      theme: compilation.theme,
      searchMatches: searchManager.getMatches(),
      isGesturing,
      watermark: compilation.watermark,
      focus: focus ?? { t: 1, prev: settledNext, next: settledNext },
      hoverRadiusScale,
      dimOpacity: highlightDimOpacity ?? compilation.interaction.dimOpacity,
      entrance:
        entranceActive && entranceProgress < 1
          ? {
              t: entranceProgress,
              stagger: entranceStagger,
              order: entranceOrderMap ?? undefined,
              offsets: entranceOffsetMap ?? undefined,
            }
          : undefined,
      enterAlpha: enterAlphaMap ?? undefined,
      exiting: exitingGhosts ?? undefined,
    };
  }

  function renderFrame(now: number): void {
    animFrameId = null;
    if (destroyed || !renderer || !interactionManager) return;

    // Tick animations first; a running animation dirties the frame. Animations
    // mutate mount state only — they never render or arm rAF themselves.
    if (scheduler.tick(now)) needsRender = true;

    if (needsRender) {
      needsRender = false;
      renderer.render(buildRenderState(now));
    }

    // Re-arm only while animations are active; otherwise the loop goes idle.
    if (scheduler.active) scheduleRender();

    // Emit a coalesced camera-change after the frame renders (at most once/frame).
    if (cameraChangePending) {
      cameraChangePending = false;
      const t = interactionManager.getTransform();
      options?.onCameraChange?.({ x: t.x, y: t.y, k: t.k });
    }
  }

  /**
   * Fly the camera to a target transform (or a provider that tracks a moving
   * target). Cancels any prior flight. Snaps instead of flying when animation is
   * disabled, reduced motion is active, or duration is 0.
   */
  function flyCamera(
    to: ZoomTransform | (() => ZoomTransform),
    opts?: CameraFlightOptions,
    onDone?: () => void,
  ): void {
    if (destroyed || !interactionManager) return;

    // Cancel any in-flight camera animation (and a lingering post-flight follow).
    cancelFlight();

    const cameraCfg = compilation.animation?.camera ?? null;
    const resolveTarget = () => (typeof to === 'function' ? to() : to);
    const snap = cameraCfg === null || prefersReducedMotion() || opts?.duration === 0;

    if (snap) {
      interactionManager.setTransform(resolveTarget());
      cameraChangePending = true;
      needsRender = true;
      scheduleRender();
      onDone?.();
      return;
    }

    const { width, height } = getCanvasDimensions();
    const duration = opts?.duration ?? cameraCfg?.duration ?? 'auto';
    const ease = opts?.ease ?? cameraCfg?.ease ?? 'smooth';
    // Large graphs skip labels/glow while flying; the final frame is full quality.
    const heavy = positionedNodes.length > 1000;

    const flight = createCameraFlight({
      from: interactionManager.getTransform(),
      to,
      viewport: { width, height },
      apply: (t) => {
        interactionManager!.setTransform(t);
        isGesturing = heavy;
        cameraChangePending = true;
        needsRender = true;
      },
      onDone: () => {
        activeFlight = null;
        isGesturing = false;
        needsRender = true;
        // Provider-form flights converge at t=1 while the tracked node may
        // still be settling — keep following it until the sim quiets down.
        if (typeof to === 'function') startFollow(to);
        scheduleRender();
        onDone?.();
      },
      opts: { duration, ease },
    });
    activeFlight = flight;
    scheduler.add(flight);
  }

  /** Snap the camera to a provider each frame until the sim settles. */
  function startFollow(target: () => ZoomTransform): void {
    const follow = createCameraFollow({
      target,
      apply: (t) => {
        interactionManager!.setTransform(t);
        cameraChangePending = true;
        needsRender = true;
      },
      isActive: () => !destroyed && lastAlpha >= FOLLOW_SETTLE_ALPHA,
    });
    activeFollow = follow;
    scheduler.add(follow);
  }

  /** Cancel any active camera flight/follow (called by user-initiated pan/zoom). */
  function cancelFlight(): void {
    if (activeFlight) {
      scheduler.remove(activeFlight);
      activeFlight = null;
      isGesturing = false;
    }
    if (activeFollow) {
      scheduler.remove(activeFollow);
      activeFollow = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Interaction wiring
  // ---------------------------------------------------------------------------

  function initInteraction(): void {
    if (!canvas) return;

    if (options?.tooltip !== false) {
      tooltipManager = createTooltipManager(wrapper!);
    }

    interactionManager = new GraphInteractionManager(canvas, spatialIndex, {
      onTransformChange(_transform) {
        // User-initiated pan/zoom cancels any camera flight. Programmatic
        // setTransform does NOT call this callback, so there's no feedback loop;
        // node-drag correctly doesn't reach here either.
        cancelFlight();
        markGesture();
        // User pan/zoom is a camera change too — zoom UIs and camera
        // persistence rely on the coalesced onCameraChange, not polling.
        cameraChangePending = true;
        needsRender = true;
        scheduleRender();
      },
      onHoverChange(nodeId) {
        // Skip redundant work (and a duplicate onNodeHover fire) when the hovered
        // node id is unchanged.
        if (nodeId === hoveredNodeId) return;
        hoveredNodeId = nodeId;
        // Re-arm the focus crossfade so the hover neighborhood eases in/out.
        armFocus(performance.now());
        startHoverRadiusTween(nodeId);
        needsRender = true;
        scheduleRender();

        // Race-safe ordering: clear any edge hover and fire onEdgeHover(null)
        // BEFORE onNodeHover(node), so an edge session never interleaves inside
        // a node hover session.
        if (nodeId && hoveredEdgeId) {
          hoveredEdgeId = null;
          options?.onEdgeHover?.(null);
          tooltipManager?.hide();
        }

        // Fire onNodeHover callback
        options?.onNodeHover?.(nodeId ? nodeDataById(nodeId) : null);

        // Show or hide tooltip
        if (nodeId && tooltipManager) {
          showNodeTooltip(nodeId);
        } else if (!nodeId) {
          // Tooltip hiding handled in onBackgroundHover (edge may show tooltip).
          tooltipManager?.hide();
        }
      },
      onBackgroundHover(graphX, graphY, screenX, screenY) {
        // A live node hover owns the tooltip; don't let edge hit-testing steal it.
        if (hoveredNodeId) return;
        // Throttle edge hit testing to avoid O(n) scan on every mousemove
        const now = performance.now();
        if (now - lastEdgeHitTime < 32) {
          // When throttled, clear edge hover so hover-off transitions stay snappy
          if (hoveredEdgeId) {
            hoveredEdgeId = null;
            needsRender = true;
            scheduleRender();
            options?.onEdgeHover?.(null);
            tooltipManager?.hide();
          }
          return;
        }
        lastEdgeHitTime = now;

        // Edge hit testing: check proximity to edge line segments
        const transform = interactionManager?.getTransform();
        const threshold = 5 / (transform?.k ?? 1); // 5px in screen space
        const edgeId = hitTestEdge(graphX, graphY, threshold);

        if (edgeId !== hoveredEdgeId) {
          hoveredEdgeId = edgeId;
          needsRender = true;
          scheduleRender();

          if (edgeId) {
            const data = edgeDataById(edgeId);
            options?.onEdgeHover?.(data);
            if (tooltipManager && data) showEdgeTooltip(edgeId, data, screenX, screenY);
          } else {
            options?.onEdgeHover?.(null);
            tooltipManager?.hide();
          }
        }
      },
      onSelectionChange(nodeIds) {
        selectedNodeIds = new Set(nodeIds);
        armFocus(performance.now());
        needsRender = true;
        scheduleRender();
        options?.onSelectionChange?.(nodeIds);

        // Fire onNodeClick for the most recently added node
        if (nodeIds.length > 0) {
          const lastId = nodeIds[nodeIds.length - 1];
          options?.onNodeClick?.(nodeDataById(lastId));
        }
      },
      onNodeDragStart(nodeId) {
        // Pin at the node's current position to avoid visual snap to origin
        const node = positionedNodes.find((n) => n.id === nodeId);
        const x = node?.x ?? 0;
        const y = node?.y ?? 0;
        // Springy: hold the sim warm (alphaTarget 0.3) so neighbors follow. Off
        // → legacy pin with no alphaTarget field (byte-identical message).
        simulation?.pinNode(nodeId, x, y, springyDragEnabled() ? 0.3 : undefined);
        canvas?.classList.add('oc-graph-canvas--dragging');
      },
      onNodeDrag(nodeId, x, y) {
        simulation?.dragNode(nodeId, x, y);
      },
      onNodeDragEnd(nodeId) {
        // Springy: cool the sim back down (alphaTarget 0). Off → legacy unpin
        // with no alphaTarget field (preserves the legacy reheat behavior).
        simulation?.unpinNode(nodeId, springyDragEnabled() ? 0 : undefined);
        canvas?.classList.remove('oc-graph-canvas--dragging');
      },
      onPointerMove(graphX, graphY) {
        if (!cursorForceEnabled()) return;
        // Throttle the pointer feed to ~30Hz so we don't post on every mousemove.
        const now = performance.now();
        if (now - lastPointerFeedTime < CURSOR_POINTER_THROTTLE_MS) return;
        lastPointerFeedTime = now;
        simulation?.setPointer(graphX, graphY, true);
      },
      onPointerLeave() {
        if (!cursorForceEnabled()) return;
        simulation?.setPointer(0, 0, false);
      },
      onDoubleClick(nodeId) {
        options?.onNodeDoubleClick?.(nodeDataById(nodeId));
      },
    });

    // Wire keyboard navigation
    cleanupKeyboard = attachGraphKeyboardNav({
      canvas,
      getNodes: () => positionedNodes,
      getSelectedIds: () => [...selectedNodeIds],
      getAdjacency: () => adjacencyMap,
      onSelect(nodeId) {
        selectedNodeIds = new Set([nodeId]);
        needsRender = true;
        scheduleRender();
        options?.onNodeClick?.(nodeDataById(nodeId));
        options?.onSelectionChange?.([nodeId]);
      },
      onDeselect() {
        selectedNodeIds.clear();
        needsRender = true;
        scheduleRender();
        options?.onSelectionChange?.([]);
      },
      onZoom(direction) {
        if (!interactionManager || !canvas) return;
        const t = interactionManager.getTransform();
        const { width: cw, height: ch } = getCanvasDimensions();
        const factor = direction === 'in' ? 1.2 : 0.8;
        const newK = t.k * factor;
        const newTransform = t.zoomAt(newK, cw / 2, ch / 2);
        flyCamera(newTransform, { duration: 200 });
      },
      onFitAll() {
        zoomToFit();
      },
    });

    // Handle node clicks (from interaction manager selection change wiring above)
    // We catch clicks via the interaction manager's onSelectionChange callback
  }

  // ---------------------------------------------------------------------------
  // Public API methods
  // ---------------------------------------------------------------------------

  function search(query: string): void {
    if (destroyed) return;
    searchManager.search(query, positionedNodes);
    needsRender = true;
    scheduleRender();
  }

  function clearSearch(): void {
    if (destroyed) return;
    searchManager.clearSearch();
    needsRender = true;
    scheduleRender();
  }

  function zoomToFit(opts?: CameraFlightOptions & { padding?: number }): void {
    if (destroyed || !interactionManager || positionedNodes.length === 0) return;
    const { width: cw, height: ch } = getCanvasDimensions();
    const { transform: fitTransform } = ZoomTransform.fitBounds(
      positionedNodes,
      cw,
      ch,
      opts?.padding,
      {
        insetTop: chromeInsetTop(),
      },
    );
    flyCamera(fitTransform, opts);
  }

  function zoomToNode(nodeId: string, opts?: CameraFlightOptions & { scale?: number }): void {
    if (destroyed || !interactionManager || !canvas) return;
    const node = positionedNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const { width: cw, height: ch } = getCanvasDimensions();
    const k = clampK(opts?.scale ?? 2);
    // Provider form: re-read the node's live position each frame so the camera
    // tracks it while the simulation is still settling.
    const provider = (): ZoomTransform => {
      const live = positionedNodes.find((n) => n.id === nodeId) ?? node;
      return new ZoomTransform(cw / 2 - live.x * k, ch / 2 - live.y * k, k);
    };
    flyCamera(provider, opts);
  }

  function flyTo(target: { x: number; y: number; k?: number }, opts?: CameraFlightOptions): void {
    if (destroyed || !interactionManager) return;
    const { width: cw, height: ch } = getCanvasDimensions();
    const k = clampK(target.k ?? interactionManager.getTransform().k);
    flyCamera(new ZoomTransform(cw / 2 - target.x * k, ch / 2 - target.y * k, k), opts);
  }

  function centerAt(x: number, y: number, opts?: CameraFlightOptions): void {
    flyTo({ x, y }, opts);
  }

  function getCamera(): { x: number; y: number; k: number } {
    const t = interactionManager?.getTransform() ?? ZoomTransform.identity();
    return { x: t.x, y: t.y, k: t.k };
  }

  function selectNode(nodeId: string, opts?: { fly?: boolean } & CameraFlightOptions): void {
    if (destroyed) return;
    selectedNodeIds = new Set([nodeId]);
    needsRender = true;
    scheduleRender();
    options?.onSelectionChange?.([nodeId]);
    const shouldFly = opts?.fly ?? compilation.interaction.selectFlyTo;
    if (shouldFly) zoomToNode(nodeId, opts);
  }

  function getSelectedNodes(): string[] {
    return [...selectedNodeIds];
  }

  function getSearchMatches(): string[] {
    return [...(searchManager.getMatches() ?? [])];
  }

  // -------------------------------------------------------------------------
  // Highlight API (single slot, two writers: highlight() and legend toggles)
  // -------------------------------------------------------------------------

  function highlight(target: GraphHighlightTarget, opts?: { dimOpacity?: number }): void {
    // Programmatic highlight resets legend toggle state (last writer wins).
    activeCategories = new Set();
    highlightSet = resolveHighlightTarget(target);
    highlightDimOpacity = opts?.dimOpacity ?? null;
    syncLegendActiveState();
    refreshFocus();
    emitHighlightChange();
  }

  function clearHighlight(): void {
    activeCategories = new Set();
    highlightSet = null;
    highlightDimOpacity = null;
    syncLegendActiveState();
    refreshFocus();
    emitHighlightChange();
  }

  function getHighlight(): string[] | null {
    return highlightSet ? [...highlightSet] : null;
  }

  function getLegend(): GraphLegendData {
    const nodeEntries = 'entries' in compilation.legend ? compilation.legend.entries : [];
    return {
      field: compilation.legendField,
      nodes: nodeEntries
        .filter((e) => !e.overflow)
        .map((e) => ({
          label: e.label,
          color: e.color,
          count: e.count,
          active: activeCategories.size === 0 || activeCategories.has(e.label),
        })),
      edges: (compilation.edgeLegend ?? []).map((e) => ({
        label: e.label,
        color: e.color,
        count: e.count,
      })),
    };
  }

  /**
   * Toggle a legend category (built-in legend + headless). Legend toggles ARE
   * the highlight state: this replaces any programmatic highlight. Empty active
   * set = all categories shown (no dimming).
   */
  function toggleLegendCategory(value: string): void {
    if (activeCategories.has(value)) activeCategories.delete(value);
    else activeCategories.add(value);
    highlightSet = categoryHighlightSet();
    highlightDimOpacity = null;
    syncLegendActiveState();
    refreshFocus();
    options?.onLegendToggle?.([...activeCategories]);
    emitHighlightChange();
  }

  function doResize(): void {
    if (destroyed || !canvas || !renderer || !wrapper) return;
    const { width, height } = getContainerDimensions();
    const canvasHeight = Math.max(height, 200);
    renderer.resize(width, canvasHeight);
    // A width change can rewrap the title or move the legend; re-derive the
    // chrome/legend separation before any fit below measures the chrome band.
    syncChromeInset();

    // Mid-entrance: the in-flight camera fit targets the OLD viewport, so cancel
    // just that flight and snap to the new-viewport fit. The reveal tween (node
    // alpha/scale ramp) is orthogonal to the camera and keeps running.
    if (entranceFitInFlight && interactionManager) {
      cancelFlight();
      entranceFitInFlight = false;
      interactionManager.setTransform(computeInitialFit());
      cameraChangePending = true;
    }

    needsRender = true;
    scheduleRender();
  }

  /**
   * Unified data update.
   *
   * 1. Finish in-flight animations, then compile the new spec.
   * 2. Diff prev↔next. A `visualOnly` change (identical node AND edge id sets AND
   *    equal simulationConfig) takes the position-preserving refresh — no sim
   *    restart. Anything else (added/removed marks, or a physics change) is a
   *    structural update.
   * 3. Structural update: tear down the SIM ONLY (interaction manager, camera
   *    transform, and surviving selection are kept). Survivors keep their prior
   *    x/y; enterers get spawn positions. A new sim is created with the center
   *    force suppressed and a low reheat alpha, so survivors barely move and
   *    enterers locally settle. Enter fades and exit ghosts animate the delta.
   */
  function update(newSpec: GraphSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;

    // Finish any in-flight animations (e.g. an entrance reveal or a prior
    // update's enter/exit fade) so they snap to their final state and fire
    // onDone rather than being hard-cancelled mid-flight.
    scheduler.finishAll();
    entranceActive = false;
    entranceProgress = 1;
    entranceFitInFlight = false;
    entranceReveal = null;
    // Clear any lingering update-transition state (finishAll ran their onDone).
    enterAlphaMap = null;
    exitingGhosts = null;

    // Capture prev state BEFORE recompiling.
    const prevNodes = positionedNodes;
    const prevEdges = positionedEdges;
    const prevConfig = compilation.simulationConfig;

    // Recompile with the new spec.
    compilation = compile();

    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      compilation,
      prevConfig,
      prevConfig.seed ?? 0,
    );

    if (diff.visualOnly) {
      runVisualOnlyUpdate();
      return;
    }

    runStructuralUpdate(diff);
  }

  /**
   * Position-preserving visual refresh: recompile changed encoding/chrome/legend
   * and transfer existing node positions. No simulation restart. (Assumes the
   * new `compilation` is already set and node/edge id sets are unchanged.)
   */
  function runVisualOnlyUpdate(): void {
    adjacencyMap = buildAdjacencyMap(compilation.edges);
    buildDataMaps();

    // Build a position lookup from the current positioned nodes.
    const posMap = new Map<string, { x: number; y: number }>();
    for (const node of positionedNodes) {
      posMap.set(node.id, { x: node.x, y: node.y });
    }

    // Transfer positions to the newly compiled nodes.
    positionedNodes = compilation.nodes.map((node, index) => {
      const pos = posMap.get(node.id) ?? { x: 0, y: 0 };
      return { ...node, x: pos.x, y: pos.y, index };
    });

    positionedEdges = compilation.edges.map((edge) => {
      const src = posMap.get(edge.source) ?? { x: 0, y: 0 };
      const tgt = posMap.get(edge.target) ?? { x: 0, y: 0 };
      return { ...edge, sourceX: src.x, sourceY: src.y, targetX: tgt.x, targetY: tgt.y };
    });

    spatialIndex.rebuild(positionedNodes);

    // Highlight persists: re-resolve category-derived sets against new nodes.
    if (activeCategories.size > 0) {
      highlightSet = categoryHighlightSet();
    }

    // Search survives: re-run the stored query against the new nodes.
    reRunSearch();

    renderChrome();
    renderLegend();
    syncLegendActiveState();

    needsRender = true;
    scheduleRender();
  }

  /**
   * Structural update: nodes/edges added/removed or physics changed. Tears down
   * only the simulation, recreates it with survivor/spawn positions and a local
   * reheat, and animates the enter/exit delta.
   */
  function runStructuralUpdate(diff: ReturnType<typeof diffGraphUpdate>): void {
    // Tear down the SIM ONLY. Interaction manager, camera transform, and
    // selection all survive (the plan's key divergence from the old full update).
    teardownSimOnly();

    adjacencyMap = buildAdjacencyMap(compilation.edges);
    buildDataMaps();

    // Known positions for the new sim: survivors keep prior x/y, enterers spawn.
    const positions = new Map<string, { x: number; y: number }>();
    for (const [id, p] of diff.survivingPositions) positions.set(id, p);
    for (const [id, p] of diff.spawnPositions) positions.set(id, p);

    // changeRatio = max(node churn, edge churn). Node churn is
    // (|entering| + |exiting nodes|) / max(prevNodeCount, nextNodeCount); the
    // edge analog uses the same shape. Low alpha IS the local reheat.
    const prevNodeCount = diff.survivingPositions.size + diff.exitingNodes.length;
    const nextNodeCount = diff.survivingPositions.size + diff.enteringIds.length;
    const nodeRatio = ratio(
      diff.enteringIds.length + diff.exitingNodes.length,
      Math.max(prevNodeCount, nextNodeCount),
    );
    const prevEdgeCount =
      compilation.edges.length - diff.enteringEdgeCount + diff.exitingEdges.length;
    const nextEdgeCount = compilation.edges.length;
    const edgeRatio = ratio(
      diff.enteringEdgeCount + diff.exitingEdges.length,
      Math.max(prevEdgeCount, nextEdgeCount),
    );
    const changeRatio = Math.max(nodeRatio, edgeRatio);
    const initialAlpha = Math.min(1, 0.3 + 0.7 * changeRatio);

    // Seed positioned nodes/edges immediately so the first frame (before the sim
    // streams its first tick) draws survivors at their prior spots and enterers
    // at their spawn spots — no flash at the origin.
    positionedNodes = compilation.nodes.map((node, index) => {
      const pos = positions.get(node.id) ?? { x: 0, y: 0 };
      return { ...node, x: pos.x, y: pos.y, index };
    });
    positionedEdges = compilation.edges.map((edge) => {
      const src = positions.get(edge.source) ?? { x: 0, y: 0 };
      const tgt = positions.get(edge.target) ?? { x: 0, y: 0 };
      return { ...edge, sourceX: src.x, sourceY: src.y, targetX: tgt.x, targetY: tgt.y };
    });
    spatialIndex.rebuild(positionedNodes);

    initSimulation({
      positions,
      suppressCenter: true,
      initialAlpha,
      skipWarmup: true,
      skipEntrance: true,
    });

    // Update DOM chrome/legend for the new graph.
    renderChrome();
    renderLegend();

    // Reconcile interaction/highlight/search state against the new node set.
    reconcileStateAfterUpdate();

    // Wire the enter-fade and exit-ghost transitions.
    startUpdateTransitions(diff);

    needsRender = true;
    scheduleRender();
  }

  /** Safe ratio (0 when the denominator is 0). */
  function ratio(numerator: number, denominator: number): number {
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Prune stale interaction state after a structural update: drop hovered
   * node/edge ids that no longer exist, intersect the selection with the new
   * node set (pushing the pruned set into the interaction manager so a later
   * shift-click can't resurrect deleted ids), re-resolve highlight, and re-run
   * any active search.
   */
  function reconcileStateAfterUpdate(): void {
    const nextIds = new Set(compilation.nodes.map((n) => n.id));

    // Hovered node: clear if gone.
    if (hoveredNodeId && !nextIds.has(hoveredNodeId)) hoveredNodeId = null;
    // Hovered edge: clear if either endpoint is gone.
    if (hoveredEdgeId) {
      const [src, tgt] = hoveredEdgeId.split('->');
      if (!nextIds.has(src) || !nextIds.has(tgt)) hoveredEdgeId = null;
    }

    // Selection: intersect with survivors, then push into the interaction manager.
    const survivingSelection = [...selectedNodeIds].filter((id) => nextIds.has(id));
    selectedNodeIds = new Set(survivingSelection);
    interactionManager?.setSelection(survivingSelection);

    // Highlight persists: re-resolve category-derived sets against new nodes.
    if (activeCategories.size > 0) {
      highlightSet = categoryHighlightSet();
    } else if (highlightSet) {
      // Explicit-id highlight: prune ids that no longer exist.
      highlightSet = new Set([...highlightSet].filter((id) => nextIds.has(id)));
      if (highlightSet.size === 0) highlightSet = null;
    }
    syncLegendActiveState();

    // Search survives: re-run the stored query against the new nodes.
    reRunSearch();

    // Re-arm the focus crossfade against the reconciled state (a fresh transition
    // so it doesn't blend from stale prev/next snapshots).
    focusTransition = null;
    armFocus(performance.now());
  }

  /** Re-run the active search query (if any) against the current positioned nodes. */
  function reRunSearch(): void {
    const q = searchManager.getQuery();
    if (q !== null) searchManager.search(q, positionedNodes);
  }

  /**
   * Start the enter-fade (new nodes 0→1 over update.duration, quantized for
   * batching) and the exit-ghost fade (removed marks 1→0 over exit.duration).
   * Snaps instantly under reduced motion or when the phase is disabled.
   */
  function startUpdateTransitions(diff: ReturnType<typeof diffGraphUpdate>): void {
    const updateCfg = compilation.animation?.update ?? null;
    const exitCfg = compilation.animation?.exit ?? null;
    const reduced = prefersReducedMotion();

    // -- Enter fade --
    if (diff.enteringIds.length > 0 && updateCfg && !reduced) {
      const entering = diff.enteringIds;
      enterAlphaMap = new Map(entering.map((id) => [id, 0]));
      const ease = resolveEase(updateCfg.ease);
      const tween = createTween({
        duration: updateCfg.duration,
        ease,
        apply: (t) => {
          // Quantize to 8 buckets so per-node alpha keeps fill-batching bounded.
          const q = Math.round(t * 8) / 8;
          if (enterAlphaMap) for (const id of entering) enterAlphaMap.set(id, q);
          needsRender = true;
        },
        onDone: () => {
          enterAlphaMap = null;
          needsRender = true;
        },
      });
      scheduler.add(tween);
    }

    // -- Exit ghosts --
    if ((diff.exitingNodes.length > 0 || diff.exitingEdges.length > 0) && exitCfg && !reduced) {
      exitingGhosts = { nodes: diff.exitingNodes, edges: diff.exitingEdges, alpha: 1 };
      const ease = resolveEase(exitCfg.ease);
      const tween = createTween({
        duration: exitCfg.duration,
        ease,
        apply: (t) => {
          if (exitingGhosts) exitingGhosts.alpha = 1 - t;
          needsRender = true;
        },
        onDone: () => {
          exitingGhosts = null;
          needsRender = true;
        },
      });
      scheduler.add(tween);
    }
  }

  /**
   * @deprecated Use {@link GraphInstance.update} instead. `update` now handles
   * both visual-only and structural changes (diffed automatically) and preserves
   * node positions when nothing structural changed. Kept as an alias for backward
   * compatibility.
   */
  function updateVisuals(newSpec: GraphSpec): void {
    update(newSpec);
  }

  /** Tear down ONLY the simulation, keeping interaction/transform/selection. */
  function teardownSimOnly(): void {
    simulation?.destroy();
    simulation = null;
  }

  function teardownSubsystems(): void {
    // Cancel animations BEFORE tearing down the sim/DOM, so no in-flight tick
    // writes to removed state.
    scheduler.cancelAll();
    activeFlight = null;
    activeFollow = null;
    // Reset entrance state so a remount (React StrictMode) starts clean.
    entranceReveal = null;
    entranceActive = false;
    entranceProgress = 1;
    entranceFitInFlight = false;
    // Reset update-transition state too (cancelAll already stopped the tweens).
    enterAlphaMap = null;
    exitingGhosts = null;
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    if (cleanupKeyboard) {
      cleanupKeyboard();
      cleanupKeyboard = null;
    }
    interactionManager?.destroy();
    interactionManager = null;
    simulation?.destroy();
    simulation = null;
    tooltipManager?.destroy();
    tooltipManager = null;
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;

    if (gestureTimeout !== null) {
      clearTimeout(gestureTimeout);
      gestureTimeout = null;
    }

    teardownSubsystems();

    if (disconnectResize) {
      disconnectResize();
      disconnectResize = null;
    }

    legendController?.destroy();
    legendController = null;

    if (wrapper?.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
    wrapper = null;
    canvas = null;
    chromeEl = null;
    legendEl = null;
    renderer = null;

    container.classList.remove('oc-dark');
  }

  // ---------------------------------------------------------------------------
  // Initialize
  // ---------------------------------------------------------------------------

  try {
    compilation = compile();
    adjacencyMap = buildAdjacencyMap(compilation.edges);
    buildDataMaps();
    applyInitialHighlight();
    createDOM();
    initSimulation();
    initInteraction();
  } catch (err) {
    console.error('[viz] Graph mount failed:', err);
    // Return a no-op instance so callers don't crash
    return {
      update() {},
      updateVisuals() {},
      search() {},
      clearSearch() {},
      zoomToFit() {},
      zoomToNode() {},
      flyTo() {},
      centerAt() {},
      getCamera: () => ({ x: 0, y: 0, k: 1 }),
      selectNode() {},
      getSelectedNodes: () => [],
      getSearchMatches: () => [],
      highlight() {},
      clearHighlight() {},
      getHighlight: () => null,
      getLegend: () => ({ field: null, nodes: [], edges: [] }),
      resize() {},
      destroy() {},
    };
  }

  // Responsive resize
  if (options?.responsive !== false) {
    disconnectResize = observeResize(container, () => {
      doResize();
    });
  }

  return {
    update,
    updateVisuals,
    search,
    clearSearch,
    zoomToFit,
    zoomToNode,
    flyTo,
    centerAt,
    getCamera,
    selectNode,
    getSelectedNodes,
    getSearchMatches,
    highlight,
    clearHighlight,
    getHighlight,
    getLegend,
    resize: doResize,
    destroy,
  };
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

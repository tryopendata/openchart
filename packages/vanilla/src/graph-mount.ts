/**
 * Graph mount API: the main entry point for vanilla JS graph usage.
 *
 * createGraph() takes a container, GraphSpec, and options, compiles the graph,
 * creates a force simulation, canvas renderer, spatial index, interaction
 * manager, and search manager, then runs an animation loop driven by
 * simulation ticks. Returns a GraphInstance with update/search/zoom/destroy.
 */

import type { CompileOptions, DarkMode, GraphSpec, ThemeConfig } from '@opendata-ai/openchart-core';
import type {
  CompiledGraphEdge,
  CompiledGraphNode,
  GraphCompilation,
} from '@opendata-ai/openchart-engine';
import { compileGraph } from '@opendata-ai/openchart-engine';

import { GraphCanvasRenderer } from './graph/canvas-renderer';
import { GraphInteractionManager } from './graph/interaction';
import { attachGraphKeyboardNav } from './graph/keyboard';
import { AnimationScheduler } from './graph/scheduler';
import { GraphSearchManager } from './graph/search';
import { SimulationManager } from './graph/simulation';
import { SpatialIndex } from './graph/spatial-index';
import type { GraphRenderState, PositionedEdge, PositionedNode } from './graph/types';
import type { SimEdge, SimNode } from './graph/worker-protocol';
import { ZoomTransform } from './graph/zoom';
import { observeResize } from './resize-observer';
import { createTooltipManager, type TooltipManager } from './tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphMountOptions {
  theme?: ThemeConfig;
  darkMode?: DarkMode;
  responsive?: boolean;
  /** Show the tryOpenData.ai watermark. Defaults to true. */
  watermark?: boolean;
  /** Show the built-in tooltip on node/edge hover. Defaults to true. */
  tooltip?: boolean;
  /** Show the built-in legend. Defaults to true. */
  legend?: boolean;
  onNodeClick?: (node: Record<string, unknown>) => void;
  onNodeDoubleClick?: (node: Record<string, unknown>) => void;
  onNodeHover?: (node: Record<string, unknown> | null) => void;
  onEdgeHover?: (edge: Record<string, unknown> | null) => void;
  onSelectionChange?: (nodeIds: string[]) => void;
}

export interface GraphInstance {
  update(spec: GraphSpec): void;
  /** Re-compile encoding/legend/chrome without restarting the simulation. Preserves node positions. */
  updateVisuals(spec: GraphSpec): void;
  search(query: string): void;
  clearSearch(): void;
  zoomToFit(): void;
  zoomToNode(nodeId: string): void;
  selectNode(nodeId: string): void;
  getSelectedNodes(): string[];
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

  function renderLegend(): void {
    if (!legendEl) return;

    const entries = 'entries' in compilation.legend ? compilation.legend.entries : [];
    if (entries.length === 0) {
      legendEl.style.display = 'none';
      return;
    }

    legendEl.style.display = '';
    let html = '';
    for (const entry of entries) {
      html += '<div class="oc-graph-legend-item">';
      html += `<span class="oc-graph-legend-swatch" style="background:${escapeHtml(entry.color)}"></span>`;
      html += `<span>${escapeHtml(entry.label)}</span>`;
      html += '</div>';
    }
    legendEl.innerHTML = html;
  }

  // ---------------------------------------------------------------------------
  // Simulation and animation
  // ---------------------------------------------------------------------------

  function initSimulation(): void {
    const simNodes = toSimNodes(compilation.nodes);
    const simEdges = toSimEdges(compilation.edges);
    const config = compilation.simulationConfig;

    simulation = SimulationManager.create(simNodes, simEdges, {
      chargeStrength: config.chargeStrength,
      linkDistance: config.linkDistance,
      clustering: config.clustering,
      alphaDecay: config.alphaDecay,
      velocityDecay: config.velocityDecay,
      collisionRadius: config.collisionRadius,
      collisionPadding: config.collisionPadding,
      linkStrength: config.linkStrength,
      centerForce: config.centerForce,
    });

    let initialSettleDone = false;
    let initialFitDone = false;

    simulation.onTick((positions, _alpha) => {
      if (destroyed) return;

      // Build position lookup
      const posMap = new Map<string, { x: number; y: number }>();
      for (const p of positions) {
        posMap.set(p.id, { x: p.x, y: p.y });
      }

      // Build positioned nodes
      positionedNodes = compilation.nodes.map((node) => {
        const pos = posMap.get(node.id) ?? { x: 0, y: 0 };
        return { ...node, x: pos.x, y: pos.y };
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

      // Fit the viewport once on the first tick so the graph is visible and
      // centered immediately. After that, let the user interact freely while
      // the simulation continues settling in the background.
      if (!initialFitDone && positionedNodes.length > 0 && interactionManager) {
        initialFitDone = true;
        const { width: cw, height: ch } = getCanvasDimensions();
        const { transform: fitTransform } = ZoomTransform.fitBounds(positionedNodes, cw, ch);
        interactionManager.setTransform(fitTransform);
      }

      needsRender = true;
      scheduleRender();
    });

    simulation.onSettled(() => {
      if (initialSettleDone) return;
      initialSettleDone = true;
    });
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

  /** Build the immutable per-frame render state from current mount state. */
  function buildRenderState(): GraphRenderState {
    const transform = interactionManager!.getTransform();
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
      renderer.render(buildRenderState());
    }

    // Re-arm only while animations are active; otherwise the loop goes idle.
    if (scheduler.active) scheduleRender();
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
        markGesture();
        needsRender = true;
        scheduleRender();
      },
      onHoverChange(nodeId) {
        hoveredNodeId = nodeId;
        needsRender = true;
        scheduleRender();

        // Fire onNodeHover callback
        if (nodeId) {
          options?.onNodeHover?.(nodeDataById(nodeId));
        } else {
          options?.onNodeHover?.(null);
        }

        // Show or hide tooltip
        if (nodeId && tooltipManager) {
          // Clear edge hover when hovering a node
          if (hoveredEdgeId) {
            hoveredEdgeId = null;
            options?.onEdgeHover?.(null);
          }
          const content = compilation.tooltipDescriptors.get(nodeId);
          if (content) {
            const node = positionedNodes.find((n) => n.id === nodeId);
            if (node && interactionManager) {
              const screen = interactionManager.getTransform().graphToScreen(node.x, node.y);
              tooltipManager.show(content, screen.x, screen.y);
            }
          }
        } else if (!nodeId) {
          // Tooltip hiding handled in onBackgroundHover (edge may show tooltip)
          // If no edge hover happens, tooltip stays hidden
          tooltipManager?.hide();
        }
      },
      onBackgroundHover(graphX, graphY, screenX, screenY) {
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

            // Show edge tooltip
            if (tooltipManager && data) {
              const fields = Object.entries(data)
                .filter(([key]) => key !== 'source' && key !== 'target')
                .filter(([, value]) => value != null)
                .map(([key, value]) => ({
                  label: key,
                  value: typeof value === 'number' ? value.toLocaleString() : String(value),
                }));

              const [source, target] = edgeId.split('->');
              tooltipManager.show({ title: `${source} → ${target}`, fields }, screenX, screenY);
            }
          } else {
            options?.onEdgeHover?.(null);
            tooltipManager?.hide();
          }
        }
      },
      onSelectionChange(nodeIds) {
        selectedNodeIds = new Set(nodeIds);
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
        simulation?.pinNode(nodeId, x, y);
        canvas?.classList.add('oc-graph-canvas--dragging');
      },
      onNodeDrag(nodeId, x, y) {
        simulation?.dragNode(nodeId, x, y);
      },
      onNodeDragEnd(nodeId) {
        simulation?.unpinNode(nodeId);
        canvas?.classList.remove('oc-graph-canvas--dragging');
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
        interactionManager.setTransform(newTransform);
        needsRender = true;
        scheduleRender();
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

  function zoomToFit(): void {
    if (destroyed || !interactionManager || positionedNodes.length === 0) return;
    const { width: cw, height: ch } = getCanvasDimensions();
    const { transform: fitTransform } = ZoomTransform.fitBounds(positionedNodes, cw, ch);
    interactionManager.setTransform(fitTransform);
    needsRender = true;
    scheduleRender();
  }

  function zoomToNode(nodeId: string): void {
    if (destroyed || !interactionManager || !canvas) return;
    const node = positionedNodes.find((n) => n.id === nodeId);
    if (!node) return;

    const { width: cw, height: ch } = getCanvasDimensions();
    // Zoom to 2x and center on node
    const k = 2;
    const tx = cw / 2 - node.x * k;
    const ty = ch / 2 - node.y * k;
    const newTransform = new ZoomTransform(tx, ty, k);
    interactionManager.setTransform(newTransform);
    needsRender = true;
    scheduleRender();
  }

  function selectNode(nodeId: string): void {
    if (destroyed) return;
    selectedNodeIds = new Set([nodeId]);
    needsRender = true;
    scheduleRender();
    options?.onSelectionChange?.([nodeId]);
  }

  function getSelectedNodes(): string[] {
    return [...selectedNodeIds];
  }

  function doResize(): void {
    if (destroyed || !canvas || !renderer || !wrapper) return;
    const { width, height } = getContainerDimensions();
    const canvasHeight = Math.max(height, 200);
    renderer.resize(width, canvasHeight);
    needsRender = true;
    scheduleRender();
  }

  function update(newSpec: GraphSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;

    // Tear down old simulation + interaction
    teardownSubsystems();

    // Recompile
    compilation = compile();
    adjacencyMap = buildAdjacencyMap(compilation.edges);
    buildDataMaps();

    // Update DOM chrome/legend
    renderChrome();
    renderLegend();

    // Reinit
    initSimulation();
    initInteraction();

    // Reset state
    hoveredNodeId = null;
    hoveredEdgeId = null;
    selectedNodeIds = new Set();
    searchManager.clearSearch();
  }

  function updateVisuals(newSpec: GraphSpec): void {
    if (destroyed) return;
    currentSpec = newSpec;

    // Build a position lookup from current positioned nodes
    const posMap = new Map<string, { x: number; y: number }>();
    for (const node of positionedNodes) {
      posMap.set(node.id, { x: node.x, y: node.y });
    }

    // Recompile with new spec (encoding, chrome, nodeOverrides, etc.)
    compilation = compile();
    adjacencyMap = buildAdjacencyMap(compilation.edges);
    buildDataMaps();

    // Transfer positions to new compiled nodes
    positionedNodes = compilation.nodes.map((node) => {
      const pos = posMap.get(node.id) ?? { x: 0, y: 0 };
      return { ...node, x: pos.x, y: pos.y };
    });

    // Rebuild positioned edges from existing positions
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

    // Rebuild spatial index with updated visuals
    spatialIndex.rebuild(positionedNodes);

    // Update DOM chrome/legend
    renderChrome();
    renderLegend();

    // Re-render canvas without restarting simulation
    needsRender = true;
    scheduleRender();
  }

  function teardownSubsystems(): void {
    // Cancel animations BEFORE tearing down the sim/DOM, so no in-flight tick
    // writes to removed state.
    scheduler.cancelAll();
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
      selectNode() {},
      getSelectedNodes: () => [],
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
    selectNode,
    getSelectedNodes,
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

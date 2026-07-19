/**
 * Canvas 2D renderer for force-directed graph visualization.
 *
 * Stateless renderer: receives a GraphRenderState each frame and draws it.
 * Handles DPR scaling, viewport culling, LOD labels, dark mode glow effects,
 * and batched drawing for performance at 10k+ nodes.
 *
 * Performance strategy:
 * - Edges batched by (stroke, strokeWidth, dash) key → one stroke() per group
 * - Nodes batched by fill color → one fill() per color group
 * - Node strokes batched by stroke color
 * - Labels and glow skipped during active pan/zoom gestures
 */

import { BRAND_FONT_SIZE, BRAND_MIN_WIDTH } from '@opendata-ai/openchart-core';
import { nodeEnterProgress } from './entrance';
import type { FocusSnapshot } from './focus-transition';
import type { GraphRenderState, PositionedEdge, PositionedNode } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_MIN = 8;
const LABEL_FONT_MAX = 12;
const EDGE_ALPHA_DEFAULT = 0.35;
const EDGE_ALPHA_CONNECTED = 1.0;
const SEARCH_NON_MATCH_ALPHA = 0.15;
/** Default node dim tier — the ratio the edge dim tier derives against. */
const DEFAULT_DIM_OPACITY = 0.15;
/** Above this visible-edge count a focus crossfade snaps (no per-frame blend). */
const CROSSFADE_MAX_EDGES = 20000;

/**
 * The three emphasis tiers an edge/node can fall into for a given focus state.
 * `default` is the resting alpha (nothing emphasized); `connected` is fully lit;
 * `dimmed` is de-emphasized while something else is in focus.
 */
type FocusTier = 'default' | 'connected' | 'dimmed';

/** Classify an edge under a focus snapshot into its emphasis tier. */
function edgeTier(edge: PositionedEdge, focus: FocusSnapshot): FocusTier {
  if (!focus.hasActive) return 'default';
  return focus.connected.has(edge.source) && focus.connected.has(edge.target)
    ? 'connected'
    : 'dimmed';
}

/** Classify a node under a focus snapshot into its emphasis tier. */
function nodeTier(node: PositionedNode, focus: FocusSnapshot): FocusTier {
  if (!focus.hasActive) return 'default';
  return focus.connected.has(node.id) ? 'connected' : 'dimmed';
}

/**
 * Resolve a tier to its edge alpha. The dimmed tier derives from the node dim
 * knob (`dimOpacity / 3`), preserving the deliberate 0.15-node / 0.05-edge ratio
 * that keeps dense hairballs quiet during hover.
 */
function edgeTierAlpha(tier: FocusTier, dimOpacity: number): number {
  switch (tier) {
    case 'connected':
      return EDGE_ALPHA_CONNECTED;
    case 'dimmed':
      return dimOpacity / 3;
    default:
      return EDGE_ALPHA_DEFAULT;
  }
}

/** Resolve a tier to its node alpha. The dimmed tier is the raw dim knob. */
function nodeTierAlpha(tier: FocusTier, dimOpacity: number): number {
  switch (tier) {
    case 'dimmed':
      return dimOpacity;
    default:
      return 1;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Per-frame entrance reveal helper, built from the mount's `entrance` state.
 *
 * Node alpha and radius both ramp `0.6 + 0.4·nodeT`, where `nodeT` is the global
 * progress (single global fade) or a per-node staggered+quantized progress. Edges
 * lag 30% behind the global progress; labels fade with the raw global progress.
 * The `total` is fixed at build time so the stagger window is stable per frame.
 */
interface EntranceReveal {
  nodeRamp(node: PositionedNode): number;
  edgeAlpha: number;
  labelAlpha: number;
}

function makeEntranceReveal(
  entrance: { t: number; stagger: boolean },
  total: number,
): EntranceReveal {
  const g = entrance.t;
  const ramp = (nodeT: number) => 0.6 + 0.4 * nodeT;
  const edgeAlpha = Math.max(0, (g - 0.3) / 0.7); // lag 30%
  return {
    nodeRamp: (node) => ramp(entrance.stagger ? nodeEnterProgress(g, node.index, total) : g),
    edgeAlpha,
    labelAlpha: g,
  };
}

/**
 * Derive a focus snapshot from hovered/selected nodes when the mount doesn't
 * supply an explicit crossfade. Preserves the legacy "hover/select dims the
 * rest" behavior for callers (and tests) that pass raw render state.
 */
function deriveFocus(
  hoveredNodeId: string | null,
  selectedNodeIds: Set<string>,
  adjacencyMap: Map<string, Set<string>>,
): FocusSnapshot {
  const hasActive = hoveredNodeId !== null || selectedNodeIds.size > 0;
  const connected = new Set<string>();
  if (hasActive) {
    const active = new Set<string>();
    if (hoveredNodeId) active.add(hoveredNodeId);
    for (const id of selectedNodeIds) active.add(id);
    for (const id of active) {
      connected.add(id);
      const neighbors = adjacencyMap.get(id);
      if (neighbors) for (const nid of neighbors) connected.add(nid);
    }
  }
  return { hasActive, connected, searchMatches: null, selected: selectedNodeIds };
}
const GLOW_NODE_THRESHOLD = 2000;
const GLOW_RADIUS_MULTIPLIER = 1.3;
const GLOW_ALPHA = 0.15;
const CULL_MARGIN = 50;
const TWO_PI = Math.PI * 2;

/** Minimum node radius in screen pixels. Keeps nodes visible when zoomed out. */
const MIN_SCREEN_RADIUS = 2.5;

// ---------------------------------------------------------------------------
// Helpers (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Compute label visibility threshold from zoom level.
 * At zoom 0.2 (zoomed out): threshold ~1.0 (only top ~5% visible).
 * At zoom 2.0+: threshold ~0.0 (all visible).
 */
export function labelThreshold(zoom: number): number {
  const t = Math.max(0, Math.min(1, (zoom - 0.2) / 1.8));
  return 1 - t;
}

/** Compute visible rect in graph coordinates from canvas size + transform. */
export function visibleRect(
  canvasWidth: number,
  canvasHeight: number,
  transform: { x: number; y: number; k: number },
  margin: number = CULL_MARGIN,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const { x, y, k } = transform;
  return {
    minX: (-x - margin) / k,
    minY: (-y - margin) / k,
    maxX: (canvasWidth - x + margin) / k,
    maxY: (canvasHeight - y + margin) / k,
  };
}

/** Check if a node falls within the visible rect. */
function nodeInView(
  node: PositionedNode,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return (
    node.x + node.radius >= rect.minX &&
    node.x - node.radius <= rect.maxX &&
    node.y + node.radius >= rect.minY &&
    node.y - node.radius <= rect.maxY
  );
}

/** Check if an edge has at least one endpoint in view. */
function edgeInView(
  edge: PositionedEdge,
  rect: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return (
    (edge.sourceX >= rect.minX &&
      edge.sourceX <= rect.maxX &&
      edge.sourceY >= rect.minY &&
      edge.sourceY <= rect.maxY) ||
    (edge.targetX >= rect.minX &&
      edge.targetX <= rect.maxX &&
      edge.targetY >= rect.minY &&
      edge.targetY <= rect.maxY)
  );
}

// ---------------------------------------------------------------------------
// Dash patterns for edge styles
// ---------------------------------------------------------------------------

const DASH_PATTERNS: Record<string, number[]> = {
  solid: [],
  dashed: [6, 4],
  dotted: [2, 3],
};

// ---------------------------------------------------------------------------
// GraphCanvasRenderer
// ---------------------------------------------------------------------------

export class GraphCanvasRenderer {
  private canvas: HTMLCanvasElement;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via this-destructuring
  private ctx: CanvasRenderingContext2D;
  private dpr: number;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via this-destructuring
  private cssWidth = 0;
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: accessed via this-destructuring
  private cssHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  }

  /** Update canvas dimensions with DPR scaling. CSS size stays at css values. */
  resize(width: number, height: number): void {
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
  }

  /** Clear canvas and render the full graph state. */
  render(state: GraphRenderState): void {
    const { ctx, dpr, cssWidth, cssHeight } = this;
    const {
      nodes,
      edges,
      transform,
      hoveredNodeId,
      hoveredEdgeId,
      selectedNodeIds,
      adjacencyMap,
      theme,
      searchMatches,
      isGesturing,
    } = state;
    const dimOpacity = state.dimOpacity ?? DEFAULT_DIM_OPACITY;

    // Resolve the current (next) focus snapshot. When the mount supplies a
    // crossfade in `state.focus`, use its endpoints; otherwise derive a snapshot
    // from hovered/selected nodes (backward-compatible, no crossfade).
    const nextFocus: FocusSnapshot =
      state.focus?.next ?? deriveFocus(hoveredNodeId, selectedNodeIds, adjacencyMap);
    // A crossfade is live only when focus is present, mid-flight, and (cheaply)
    // the graph isn't gesturing (during gestures we snap for perf).
    const crossfade = state.focus && state.focus.t < 1 && !isGesturing ? state.focus : null;

    // Entrance reveal (Phase 6): present only while the mount is mid-entrance.
    const entrance =
      state.entrance && state.entrance.t < 1
        ? makeEntranceReveal(state.entrance, nodes.length)
        : null;

    // Viewport culling
    const rect = visibleRect(cssWidth, cssHeight, transform);
    const visibleNodes = nodes.filter((n) => nodeInView(n, rect));
    const visibleEdges = edges.filter((e) => edgeInView(e, rect));

    const isDark = theme.isDark;
    const showGlow = isDark && !isGesturing && visibleNodes.length < GLOW_NODE_THRESHOLD;
    const threshold = labelThreshold(transform.k);
    // Minimum radius in graph coordinates so nodes stay visible when zoomed out
    const minRadius = MIN_SCREEN_RADIUS / transform.k;

    // -- Clear and apply transform --
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Fill background (skip if transparent to let page background show through)
    if (theme.colors.background !== 'transparent') {
      ctx.fillStyle = theme.colors.background;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
    }

    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.k, transform.k);

    // -- Draw edges (batched) -- crossfade path only mid-transition, else the
    // fast 3-bucket steady-state path. Degrade to snap for huge edge sets.
    if (crossfade && visibleEdges.length <= CROSSFADE_MAX_EDGES) {
      this.drawEdgesCrossfade(
        ctx,
        visibleEdges,
        crossfade.prev,
        crossfade.next,
        crossfade.t,
        dimOpacity,
        isGesturing ? null : searchMatches,
        hoveredEdgeId,
        entrance,
      );
    } else {
      this.drawEdgesBatched(
        ctx,
        visibleEdges,
        nextFocus,
        dimOpacity,
        isGesturing ? null : searchMatches,
        hoveredEdgeId,
        entrance,
      );
    }

    // -- Draw nodes (batched by fill color) --
    this.drawNodesBatched(
      ctx,
      visibleNodes,
      hoveredNodeId,
      selectedNodeIds,
      isGesturing ? null : searchMatches,
      showGlow,
      theme,
      minRadius,
      nextFocus,
      dimOpacity,
      crossfade,
      state.hoverRadiusScale,
      entrance,
    );

    // -- Draw labels (skipped during gestures) --
    if (!isGesturing) {
      this.drawLabels(
        ctx,
        visibleNodes,
        threshold,
        hoveredNodeId,
        selectedNodeIds,
        searchMatches,
        transform.k,
        theme,
        entrance,
      );
    }

    ctx.restore();

    // Brand watermark in screen coordinates (unaffected by pan/zoom)
    if (state.watermark) {
      this.drawBrand(ctx, cssWidth, cssHeight, theme);
    }
  }

  // -------------------------------------------------------------------------
  // Brand rendering
  // -------------------------------------------------------------------------

  private drawBrand(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    theme: GraphRenderState['theme'],
  ): void {
    if (w < BRAND_MIN_WIDTH) return;
    const { dpr } = this;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const padding = theme.spacing.padding;
    const x = w - padding;
    const y = h - padding;
    ctx.font = `600 ${BRAND_FONT_SIZE}px ${theme.fonts.family}`;
    ctx.fillStyle = theme.colors.axis;
    ctx.globalAlpha = 0.55;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('tryOpenData.ai', x, y);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Batched edge drawing
  // -------------------------------------------------------------------------

  private drawEdgesBatched(
    ctx: CanvasRenderingContext2D,
    edges: PositionedEdge[],
    focus: FocusSnapshot,
    dimOpacity: number,
    searchMatches: Set<string> | null,
    hoveredEdgeId: string | null,
    entrance: EntranceReveal | null,
  ): void {
    // Settled fast path: classify each edge into one of 3 tiers, batch within.
    const buckets: Record<FocusTier, PositionedEdge[]> = {
      dimmed: [],
      default: [],
      connected: [],
    };
    let hoveredEdge: PositionedEdge | null = null;

    for (const edge of edges) {
      const edgeId = `${edge.source}->${edge.target}`;
      if (edgeId === hoveredEdgeId) {
        hoveredEdge = edge;
        continue; // Draw hovered edge last, on top
      }
      buckets[edgeTier(edge, focus)].push(edge);
    }

    // Entrance: edges lag 30% behind the reveal, so scale every tier's alpha.
    const ea = entrance ? entrance.edgeAlpha : 1;

    // Draw dimmed first, then default, then connected (on top)
    this.drawEdgeGroupBatched(
      ctx,
      buckets.dimmed,
      edgeTierAlpha('dimmed', dimOpacity) * ea,
      searchMatches,
    );
    this.drawEdgeGroupBatched(ctx, buckets.default, EDGE_ALPHA_DEFAULT * ea, searchMatches);
    this.drawEdgeGroupBatched(ctx, buckets.connected, EDGE_ALPHA_CONNECTED * ea, searchMatches);

    this.drawHoveredEdge(ctx, hoveredEdge);
  }

  /**
   * Crossfade edges between a prev and next focus state. Each edge is classified
   * under BOTH snapshots → at most 9 (prevTier × nextTier) buckets, each drawn
   * batched at `lerp(edgeTierAlpha[prev], edgeTierAlpha[next], t)`. Preserves the
   * per-group style batching within each bucket.
   */
  private drawEdgesCrossfade(
    ctx: CanvasRenderingContext2D,
    edges: PositionedEdge[],
    prev: FocusSnapshot,
    next: FocusSnapshot,
    t: number,
    dimOpacity: number,
    searchMatches: Set<string> | null,
    hoveredEdgeId: string | null,
    entrance: EntranceReveal | null,
  ): void {
    const ea = entrance ? entrance.edgeAlpha : 1;
    // Bucket by (prevTier, nextTier). Key encodes both tiers.
    const buckets = new Map<string, PositionedEdge[]>();
    let hoveredEdge: PositionedEdge | null = null;

    for (const edge of edges) {
      const edgeId = `${edge.source}->${edge.target}`;
      if (edgeId === hoveredEdgeId) {
        hoveredEdge = edge;
        continue;
      }
      const key = `${edgeTier(edge, prev)}|${edgeTier(edge, next)}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(edge);
    }

    // Draw dim→dim first (lowest alpha) up to connected→connected, so brighter
    // buckets paint over dimmer ones. Sort by blended alpha ascending.
    const ordered = [...buckets.entries()]
      .map(([key, bucket]) => {
        const [prevTier, nextTier] = key.split('|') as [FocusTier, FocusTier];
        const alpha =
          lerp(edgeTierAlpha(prevTier, dimOpacity), edgeTierAlpha(nextTier, dimOpacity), t) * ea;
        return { alpha, bucket };
      })
      .sort((a, b) => a.alpha - b.alpha);

    for (const { alpha, bucket } of ordered) {
      this.drawEdgeGroupBatched(ctx, bucket, alpha, searchMatches);
    }

    this.drawHoveredEdge(ctx, hoveredEdge);
  }

  /** Draw the hovered edge on top with a thickened highlight stroke. */
  private drawHoveredEdge(ctx: CanvasRenderingContext2D, hoveredEdge: PositionedEdge | null): void {
    if (!hoveredEdge) return;
    const dash = DASH_PATTERNS[hoveredEdge.style] ?? DASH_PATTERNS.solid;
    ctx.setLineDash(dash);
    ctx.strokeStyle = hoveredEdge.stroke;
    ctx.lineWidth = hoveredEdge.strokeWidth * 2;
    ctx.globalAlpha = EDGE_ALPHA_CONNECTED;
    ctx.beginPath();
    ctx.moveTo(hoveredEdge.sourceX, hoveredEdge.sourceY);
    ctx.lineTo(hoveredEdge.targetX, hoveredEdge.targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  /**
   * Draw a group of edges at a given alpha, batched by (stroke, strokeWidth, style).
   * When search is inactive, all edges of the same style are drawn in a single path.
   * When search is active, edges split by search-match status for alpha dimming.
   */
  private drawEdgeGroupBatched(
    ctx: CanvasRenderingContext2D,
    edges: PositionedEdge[],
    alpha: number,
    searchMatches: Set<string> | null,
  ): void {
    if (edges.length === 0) return;

    // Group by visual key: stroke + strokeWidth + style
    const groups = new Map<string, PositionedEdge[]>();
    for (const edge of edges) {
      const key = `${edge.stroke}|${edge.strokeWidth}|${edge.style}`;
      let group = groups.get(key);
      if (!group) {
        group = [];
        groups.set(key, group);
      }
      group.push(edge);
    }

    for (const [, group] of groups) {
      const sample = group[0];
      const dash = DASH_PATTERNS[sample.style] ?? DASH_PATTERNS.solid;
      ctx.setLineDash(dash);
      ctx.strokeStyle = sample.stroke;
      ctx.lineWidth = sample.strokeWidth;

      if (!searchMatches) {
        // Fast path: single batched path for all edges in this group
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (const edge of group) {
          ctx.moveTo(edge.sourceX, edge.sourceY);
          ctx.lineTo(edge.targetX, edge.targetY);
        }
        ctx.stroke();
      } else {
        // Search active: split into matched and non-matched batches
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        let hasMatched = false;

        const nonMatchPath: PositionedEdge[] = [];

        for (const edge of group) {
          const srcMatch = searchMatches.has(edge.source);
          const tgtMatch = searchMatches.has(edge.target);
          if (srcMatch || tgtMatch) {
            ctx.moveTo(edge.sourceX, edge.sourceY);
            ctx.lineTo(edge.targetX, edge.targetY);
            hasMatched = true;
          } else {
            nonMatchPath.push(edge);
          }
        }
        if (hasMatched) ctx.stroke();

        // Draw non-matching edges dimmed
        if (nonMatchPath.length > 0) {
          ctx.globalAlpha = SEARCH_NON_MATCH_ALPHA * alpha;
          ctx.beginPath();
          for (const edge of nonMatchPath) {
            ctx.moveTo(edge.sourceX, edge.sourceY);
            ctx.lineTo(edge.targetX, edge.targetY);
          }
          ctx.stroke();
        }
      }
    }

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Batched node drawing
  // -------------------------------------------------------------------------

  private drawNodesBatched(
    ctx: CanvasRenderingContext2D,
    nodes: PositionedNode[],
    hoveredNodeId: string | null,
    selectedNodeIds: Set<string>,
    searchMatches: Set<string> | null,
    showGlow: boolean,
    theme: GraphRenderState['theme'],
    minRadius: number,
    nextFocus: FocusSnapshot,
    dimOpacity: number,
    crossfade: { t: number; prev: FocusSnapshot; next: FocusSnapshot } | null,
    hoverRadiusScale: Map<string, number> | undefined,
    entrance: EntranceReveal | null,
  ): void {
    // Effective per-node alpha = focus dim × search dim. Focus dim crossfades
    // between prev/next tiers when a transition is live; otherwise it's the
    // settled next-tier alpha. Batching is preserved by grouping nodes that
    // share (fill, quantized-alpha) — at most 2 focus tiers × 2 search tiers.
    const focusAlpha = (node: PositionedNode): number => {
      if (crossfade) {
        return lerp(
          nodeTierAlpha(nodeTier(node, crossfade.prev), dimOpacity),
          nodeTierAlpha(nodeTier(node, crossfade.next), dimOpacity),
          crossfade.t,
        );
      }
      return nodeTierAlpha(nodeTier(node, nextFocus), dimOpacity);
    };
    const searchAlpha = (node: PositionedNode): number =>
      searchMatches !== null && !searchMatches.has(node.id) ? SEARCH_NON_MATCH_ALPHA : 1;
    // Entrance ramp (0.6 + 0.4·nodeT) applies to BOTH alpha and radius. Quantized
    // per-node (via nodeEnterProgress), so it keeps the fill/stroke batching keys
    // bounded during the reveal.
    const entranceRamp = (node: PositionedNode): number => (entrance ? entrance.nodeRamp(node) : 1);
    const effectiveAlpha = (node: PositionedNode): number =>
      focusAlpha(node) * searchAlpha(node) * entranceRamp(node);

    // Separate special nodes (hovered/selected, or mid radius-tween) from bulk.
    const bulkNodes: PositionedNode[] = [];
    const specialNodes: PositionedNode[] = [];

    for (const node of nodes) {
      if (
        node.id === hoveredNodeId ||
        selectedNodeIds.has(node.id) ||
        (hoverRadiusScale?.has(node.id) ?? false)
      ) {
        specialNodes.push(node);
      } else {
        bulkNodes.push(node);
      }
    }

    // Helper: effective radius clamped to minimum screen size, then scaled by
    // the entrance ramp (same 0.6 + 0.4·nodeT curve as the alpha ramp).
    const r = (node: PositionedNode) => Math.max(node.radius, minRadius) * entranceRamp(node);

    // --- Glow pass (dark mode only, before fills) ---
    if (showGlow) {
      this.drawGlowBatched(ctx, bulkNodes, searchMatches, minRadius);
    }

    // --- Bulk fill pass: batch by (fill color, quantized alpha) ---
    const fillGroups = new Map<string, { fill: string; alpha: number; nodes: PositionedNode[] }>();
    for (const node of bulkNodes) {
      const alpha = effectiveAlpha(node);
      const key = `${node.fill}|${alpha.toFixed(3)}`;
      let group = fillGroups.get(key);
      if (!group) {
        group = { fill: node.fill, alpha, nodes: [] };
        fillGroups.set(key, group);
      }
      group.nodes.push(node);
    }

    for (const { fill, alpha, nodes: group } of fillGroups.values()) {
      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const node of group) {
        const nr = r(node);
        ctx.moveTo(node.x + nr, node.y);
        ctx.arc(node.x, node.y, nr, 0, TWO_PI);
      }
      ctx.fill();
    }

    // --- Bulk stroke pass: batch by (stroke color+width, quantized alpha) ---
    const strokeGroups = new Map<
      string,
      { stroke: string; width: number; alpha: number; nodes: PositionedNode[] }
    >();
    for (const node of bulkNodes) {
      const alpha = effectiveAlpha(node);
      const key = `${node.stroke}|${node.strokeWidth}|${alpha.toFixed(3)}`;
      let group = strokeGroups.get(key);
      if (!group) {
        group = { stroke: node.stroke, width: node.strokeWidth, alpha, nodes: [] };
        strokeGroups.set(key, group);
      }
      group.nodes.push(node);
    }

    for (const { stroke, width, alpha, nodes: group } of strokeGroups.values()) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const node of group) {
        const nr = r(node);
        ctx.moveTo(node.x + nr, node.y);
        ctx.arc(node.x, node.y, nr, 0, TWO_PI);
      }
      ctx.stroke();
    }

    // --- Special nodes (hovered/selected) drawn individually ---
    for (const node of specialNodes) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = selectedNodeIds.has(node.id);
      const dimmed = searchMatches !== null && !searchMatches.has(node.id);
      const baseRadius = Math.max(node.radius, minRadius);
      // Hover radius tween: scale routes through here until it returns to 1.
      const hoverScale = hoverRadiusScale?.get(node.id) ?? (isHovered ? 1.15 : 1);
      const radius = baseRadius * hoverScale;
      // brighten() switches at the scale midpoint (>1.075 of the 1→1.15 range).
      const brightened = isHovered && hoverScale >= 1.075;

      ctx.globalAlpha = dimmed ? SEARCH_NON_MATCH_ALPHA : 1;

      // Glow for special nodes
      if (showGlow && !dimmed) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * GLOW_RADIUS_MULTIPLIER, 0, TWO_PI);
        ctx.fillStyle = node.fill;
        ctx.globalAlpha = GLOW_ALPHA;
        ctx.fill();
        ctx.globalAlpha = dimmed ? SEARCH_NON_MATCH_ALPHA : 1;
      }

      // Fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, TWO_PI);
      ctx.fillStyle = brightened ? brighten(node.fill) : node.fill;
      ctx.fill();

      // Stroke
      ctx.strokeStyle = node.stroke;
      ctx.lineWidth = node.strokeWidth;
      ctx.stroke();

      // Selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 3, 0, TWO_PI);
        ctx.strokeStyle = theme.colors.categorical[0] ?? '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 1;
  }

  /** Batch glow circles by fill color. */
  private drawGlowBatched(
    ctx: CanvasRenderingContext2D,
    nodes: PositionedNode[],
    searchMatches: Set<string> | null,
    minRadius: number,
  ): void {
    const glowGroups = new Map<string, PositionedNode[]>();
    for (const node of nodes) {
      if (searchMatches && !searchMatches.has(node.id)) continue;
      let group = glowGroups.get(node.fill);
      if (!group) {
        group = [];
        glowGroups.set(node.fill, group);
      }
      group.push(node);
    }

    ctx.globalAlpha = GLOW_ALPHA;
    for (const [fill, group] of glowGroups) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const node of group) {
        const gr = Math.max(node.radius, minRadius) * GLOW_RADIUS_MULTIPLIER;
        ctx.moveTo(node.x + gr, node.y);
        ctx.arc(node.x, node.y, gr, 0, TWO_PI);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Labels (drawn individually, skipped during gestures)
  // -------------------------------------------------------------------------

  private drawLabels(
    ctx: CanvasRenderingContext2D,
    nodes: PositionedNode[],
    threshold: number,
    hoveredNodeId: string | null,
    selectedNodeIds: Set<string>,
    searchMatches: Set<string> | null,
    zoom: number,
    theme: GraphRenderState['theme'],
    entrance: EntranceReveal | null,
  ): void {
    // Labels fade in with the raw entrance progress (× on top of dim alpha).
    const la = entrance ? entrance.labelAlpha : 1;
    // Font size inversely scaled by zoom, clamped to readable range
    const rawSize = 10 / zoom;
    const fontSize = Math.max(LABEL_FONT_MIN, Math.min(LABEL_FONT_MAX, rawSize));

    ctx.font = `${fontSize}px ${theme.fonts.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (const node of nodes) {
      if (!node.label) continue;

      const isHovered = node.id === hoveredNodeId;
      const isSelected = selectedNodeIds.has(node.id);
      const forced = isHovered || isSelected;
      const dimmed = searchMatches !== null && !searchMatches.has(node.id);

      // LOD: skip labels below threshold unless forced
      if (!forced && node.labelPriority < threshold) continue;

      ctx.globalAlpha = (dimmed ? SEARCH_NON_MATCH_ALPHA : 1) * la;

      const labelY = node.y + node.radius + 3;

      // Halo for readability: stroke behind text in the background color
      // so labels stay legible over edges and other nodes.
      if (theme.colors.background !== 'transparent') {
        ctx.strokeStyle = theme.colors.background;
      } else {
        // Transparent bg inherits its mode from the theme's darkMode flag, not
        // from text luminance. Dark mode = dark page = dark halo behind light
        // text; light mode = light page = light halo.
        ctx.strokeStyle = theme.isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.85)';
      }
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(node.label, node.x, labelY);

      ctx.fillStyle = theme.colors.text;
      ctx.fillText(node.label, node.x, labelY);
    }

    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Brighten a hex/rgb color by ~20% for hover effect.
 * Quick and dirty approach: parse hex, lighten each channel.
 */
function brighten(color: string): string {
  // Handle rgb(r,g,b) or rgb(r, g, b)
  const rgbMatch = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = Math.min(255, parseInt(rgbMatch[1], 10) + 40);
    const g = Math.min(255, parseInt(rgbMatch[2], 10) + 40);
    const b = Math.min(255, parseInt(rgbMatch[3], 10) + 40);
    return `rgb(${r},${g},${b})`;
  }

  // Handle hex colors (#rgb and #rrggbb)
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  if (full.length === 6) {
    const r = Math.min(255, parseInt(full.slice(0, 2), 16) + 40);
    const g = Math.min(255, parseInt(full.slice(2, 4), 16) + 40);
    const b = Math.min(255, parseInt(full.slice(4, 6), 16) + 40);
    return `rgb(${r},${g},${b})`;
  }

  return color;
}

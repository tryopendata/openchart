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

import type { GraphRenderState, PositionedEdge, PositionedNode } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LABEL_FONT_MIN = 8;
const LABEL_FONT_MAX = 12;
const EDGE_ALPHA_DEFAULT = 0.35;
const EDGE_ALPHA_CONNECTED = 1.0;
const EDGE_ALPHA_DIMMED = 0.05;
const SEARCH_NON_MATCH_ALPHA = 0.15;
const GLOW_NODE_THRESHOLD = 2000;
const GLOW_RADIUS_MULTIPLIER = 1.3;
const GLOW_ALPHA = 0.15;
const CULL_MARGIN = 50;
const TWO_PI = Math.PI * 2;

/** Minimum node radius in screen pixels. Keeps nodes visible when zoomed out. */
const MIN_SCREEN_RADIUS = 2.5;

/** Minimum canvas width to render the brand watermark. */
const BRAND_MIN_WIDTH = 120;

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
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
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

    const hasActiveNode = hoveredNodeId !== null || selectedNodeIds.size > 0;
    const activeNodeIds = new Set<string>();
    if (hoveredNodeId) activeNodeIds.add(hoveredNodeId);
    for (const id of selectedNodeIds) activeNodeIds.add(id);

    // Collect all nodes connected to any active node
    const connectedNodeIds = new Set<string>();
    for (const id of activeNodeIds) {
      connectedNodeIds.add(id);
      const neighbors = adjacencyMap.get(id);
      if (neighbors) {
        for (const nid of neighbors) connectedNodeIds.add(nid);
      }
    }

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

    // -- Draw edges (batched by style key) --
    this.drawEdgesBatched(
      ctx,
      visibleEdges,
      hasActiveNode,
      connectedNodeIds,
      isGesturing ? null : searchMatches,
      hoveredEdgeId,
    );

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
      );
    }

    ctx.restore();

    // Brand watermark in screen coordinates (unaffected by pan/zoom)
    this.drawBrand(ctx, cssWidth, cssHeight, theme);
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
    ctx.font = `600 20px ${theme.fonts.family}`;
    ctx.fillStyle = theme.colors.axis;
    ctx.globalAlpha = 0.5;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('OpenData', x, y);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Batched edge drawing
  // -------------------------------------------------------------------------

  private drawEdgesBatched(
    ctx: CanvasRenderingContext2D,
    edges: PositionedEdge[],
    hasActiveNode: boolean,
    connectedNodeIds: Set<string>,
    searchMatches: Set<string> | null,
    hoveredEdgeId: string | null,
  ): void {
    // Classify edges by alpha level, then batch by visual style within each level
    const dimmedEdges: PositionedEdge[] = [];
    const defaultEdges: PositionedEdge[] = [];
    const connectedEdges: PositionedEdge[] = [];
    let hoveredEdge: PositionedEdge | null = null;

    for (const edge of edges) {
      const edgeId = `${edge.source}->${edge.target}`;
      if (edgeId === hoveredEdgeId) {
        hoveredEdge = edge;
        continue; // Draw hovered edge last, on top
      }

      const isConnected =
        hasActiveNode && connectedNodeIds.has(edge.source) && connectedNodeIds.has(edge.target);
      const isDimmed = hasActiveNode && !isConnected;

      if (isConnected) {
        connectedEdges.push(edge);
      } else if (isDimmed) {
        dimmedEdges.push(edge);
      } else {
        defaultEdges.push(edge);
      }
    }

    // Draw dimmed first, then default, then connected (on top)
    this.drawEdgeGroupBatched(ctx, dimmedEdges, EDGE_ALPHA_DIMMED, searchMatches);
    this.drawEdgeGroupBatched(ctx, defaultEdges, EDGE_ALPHA_DEFAULT, searchMatches);
    this.drawEdgeGroupBatched(ctx, connectedEdges, EDGE_ALPHA_CONNECTED, searchMatches);

    // Draw hovered edge on top with highlight
    if (hoveredEdge) {
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
  ): void {
    // Separate special nodes (hovered/selected) from bulk nodes.
    // Special nodes need individual treatment; bulk nodes get batched by color.
    const bulkNodes: PositionedNode[] = [];
    const specialNodes: PositionedNode[] = [];

    for (const node of nodes) {
      if (node.id === hoveredNodeId || selectedNodeIds.has(node.id)) {
        specialNodes.push(node);
      } else {
        bulkNodes.push(node);
      }
    }

    // Helper: effective radius clamped to minimum screen size
    const r = (node: PositionedNode) => Math.max(node.radius, minRadius);

    // --- Glow pass (dark mode only, before fills) ---
    if (showGlow) {
      this.drawGlowBatched(ctx, bulkNodes, searchMatches, minRadius);
    }

    // --- Bulk fill pass: batch by fill color ---
    const fillGroups = new Map<string, PositionedNode[]>();
    for (const node of bulkNodes) {
      let group = fillGroups.get(node.fill);
      if (!group) {
        group = [];
        fillGroups.set(node.fill, group);
      }
      group.push(node);
    }

    if (!searchMatches) {
      // Fast path: no search dimming
      ctx.globalAlpha = 1;
      for (const [fill, group] of fillGroups) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        for (const node of group) {
          const nr = r(node);
          ctx.moveTo(node.x + nr, node.y);
          ctx.arc(node.x, node.y, nr, 0, TWO_PI);
        }
        ctx.fill();
      }
    } else {
      // Search active: split each color group into matched/dimmed batches
      for (const [fill, group] of fillGroups) {
        ctx.fillStyle = fill;

        // Matched nodes
        ctx.globalAlpha = 1;
        ctx.beginPath();
        let hasMatched = false;
        const dimmedNodes: PositionedNode[] = [];

        for (const node of group) {
          if (searchMatches.has(node.id)) {
            const nr = r(node);
            ctx.moveTo(node.x + nr, node.y);
            ctx.arc(node.x, node.y, nr, 0, TWO_PI);
            hasMatched = true;
          } else {
            dimmedNodes.push(node);
          }
        }
        if (hasMatched) ctx.fill();

        // Dimmed nodes
        if (dimmedNodes.length > 0) {
          ctx.globalAlpha = SEARCH_NON_MATCH_ALPHA;
          ctx.beginPath();
          for (const node of dimmedNodes) {
            const nr = r(node);
            ctx.moveTo(node.x + nr, node.y);
            ctx.arc(node.x, node.y, nr, 0, TWO_PI);
          }
          ctx.fill();
        }
      }
    }

    // --- Bulk stroke pass: batch by stroke color ---
    const strokeGroups = new Map<string, PositionedNode[]>();
    for (const node of bulkNodes) {
      const key = `${node.stroke}|${node.strokeWidth}`;
      let group = strokeGroups.get(key);
      if (!group) {
        group = [];
        strokeGroups.set(key, group);
      }
      group.push(node);
    }

    for (const [key, group] of strokeGroups) {
      const [stroke, widthStr] = key.split('|');
      ctx.strokeStyle = stroke;
      ctx.lineWidth = parseFloat(widthStr);

      if (!searchMatches) {
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (const node of group) {
          const nr = r(node);
          ctx.moveTo(node.x + nr, node.y);
          ctx.arc(node.x, node.y, nr, 0, TWO_PI);
        }
        ctx.stroke();
      } else {
        // Split matched/dimmed for strokes too
        ctx.globalAlpha = 1;
        ctx.beginPath();
        let hasMatched = false;
        const dimmedNodes: PositionedNode[] = [];

        for (const node of group) {
          if (searchMatches.has(node.id)) {
            const nr = r(node);
            ctx.moveTo(node.x + nr, node.y);
            ctx.arc(node.x, node.y, nr, 0, TWO_PI);
            hasMatched = true;
          } else {
            dimmedNodes.push(node);
          }
        }
        if (hasMatched) ctx.stroke();

        if (dimmedNodes.length > 0) {
          ctx.globalAlpha = SEARCH_NON_MATCH_ALPHA;
          ctx.beginPath();
          for (const node of dimmedNodes) {
            const nr = r(node);
            ctx.moveTo(node.x + nr, node.y);
            ctx.arc(node.x, node.y, nr, 0, TWO_PI);
          }
          ctx.stroke();
        }
      }
    }

    // --- Special nodes (hovered/selected) drawn individually ---
    for (const node of specialNodes) {
      const isHovered = node.id === hoveredNodeId;
      const isSelected = selectedNodeIds.has(node.id);
      const dimmed = searchMatches !== null && !searchMatches.has(node.id);
      const baseRadius = Math.max(node.radius, minRadius);
      const radius = isHovered ? baseRadius * 1.15 : baseRadius;

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
      ctx.fillStyle = isHovered ? brighten(node.fill) : node.fill;
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
  ): void {
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

      ctx.globalAlpha = dimmed ? SEARCH_NON_MATCH_ALPHA : 1;

      const labelY = node.y + node.radius + 3;

      // Halo for readability: stroke behind text in the background color
      // so labels stay legible over edges and other nodes.
      if (theme.colors.background !== 'transparent') {
        ctx.strokeStyle = theme.colors.background;
      } else {
        // Transparent bg: infer page background from text luminance.
        // Light text = dark page, dark text = light page.
        ctx.strokeStyle = isLightColor(theme.colors.text)
          ? 'rgba(0, 0, 0, 0.7)'
          : 'rgba(255, 255, 255, 0.85)';
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

/**
 * Returns true if a color is perceptually light (luminance > 0.5).
 * Used to pick a contrasting halo color for labels on transparent backgrounds.
 */
function isLightColor(color: string): boolean {
  const hex = color.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;
  if (full.length !== 6) return false;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b) > 0.5;
}

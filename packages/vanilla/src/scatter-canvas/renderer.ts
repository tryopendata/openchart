/**
 * Canvas 2D renderer for high-cardinality scatter point marks.
 *
 * Stateless: receives a `ScatterCanvasState` each frame and paints it. Trimmed
 * from `graph/canvas-renderer.ts` — no edges, labels, glow, focus dimming or
 * zoom transform, because the scatter layer paints in layout coordinates and
 * every point is equal.
 *
 * Performance strategy (the whole reason this layer exists):
 * - Points batched by (fill, effective alpha) → one `beginPath`/`fill` per bucket
 * - Strokes batched by (stroke, width) → one `beginPath`/`stroke` per bucket
 * - Trivial rect cull against the clip rect before a point enters a bucket
 *
 * Gradient fills are flattened to a solid color upstream (`state.flattenFill`);
 * exports materialize a true-gradient SVG render instead.
 */

import type { CanvasRect, ScatterCanvasState } from './types';

const TWO_PI = Math.PI * 2;

/**
 * Cap the backing-store scale. Above 2x the extra pixels are invisible but the
 * fill rate cost is real, and phones report 3-4x.
 */
const MAX_DPR = 2;

/** Extra radius on the hover ring, in CSS px. */
const HOVER_RING_PAD = 2;

function currentDpr(): number {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

/** True when the circle at (x, y, r) can possibly touch the rect. */
function inRect(x: number, y: number, r: number, rect: CanvasRect): boolean {
  return (
    x + r >= rect.x &&
    x - r <= rect.x + rect.width &&
    y + r >= rect.y &&
    y - r <= rect.y + rect.height
  );
}

export class ScatterCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  /**
   * `null` when the environment has no 2D context (happy-dom without a stub,
   * or a browser that refused the context). `render()` becomes a no-op rather
   * than throwing — a chart missing its dots beats a chart that crashes.
   */
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr: number;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = currentDpr();
  }

  /**
   * Resize the backing store. DPR is re-read here, not frozen in the
   * constructor: dragging a window between a Retina and a non-Retina display
   * changes `devicePixelRatio` mid-life, and resize is exactly when we find out.
   */
  resize(width: number, height: number): void {
    this.dpr = currentDpr();
    this.cssWidth = width;
    this.cssHeight = height;
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
  }

  /** Clear and paint the full state. */
  render(state: ScatterCanvasState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const dpr = this.dpr;
    const cssWidth = this.cssWidth;
    const cssHeight = this.cssHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    // Background full-bleed: the SVG suppresses its background rect in canvas
    // mode, so this layer owns the figure's surface color.
    if (state.background && state.background !== 'transparent') {
      ctx.fillStyle = state.background;
      ctx.fillRect(0, 0, cssWidth, cssHeight);
    }

    const clip = state.clipRect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.width, clip.height);
    ctx.clip();

    this.drawGridlines(ctx, state);
    if (state.exiting && state.exiting.alpha > 0) this.drawGhosts(ctx, state);
    this.drawPoints(ctx, state);
    this.drawStrokes(ctx, state);
    this.drawHoverRing(ctx, state);

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Gridlines
  // -------------------------------------------------------------------------

  /**
   * Gridlines, batched per alpha. Geometry mirrors `renderers/axes.ts`:
   * y-axis lines span the plot width, x-axis lines span the plot height.
   */
  private drawGridlines(ctx: CanvasRenderingContext2D, state: ScatterCanvasState): void {
    if (state.gridlines.length === 0) return;
    const area = state.plotRect;

    const byAlpha = new Map<number, ScatterCanvasState['gridlines']>();
    for (const gridline of state.gridlines) {
      const bucket = byAlpha.get(gridline.alpha);
      if (bucket) bucket.push(gridline);
      else byAlpha.set(gridline.alpha, [gridline]);
    }

    ctx.strokeStyle = state.gridlineStroke;
    ctx.lineWidth = state.gridlineWidth;
    for (const [alpha, bucket] of byAlpha) {
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const gridline of bucket) {
        if (gridline.orient === 'y') {
          ctx.moveTo(area.x, gridline.position);
          ctx.lineTo(area.x + area.width, gridline.position);
        } else {
          ctx.moveTo(gridline.position, area.y);
          ctx.lineTo(gridline.position, area.y + area.height);
        }
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Exit ghosts (painted UNDER the live points)
  // -------------------------------------------------------------------------

  private drawGhosts(ctx: CanvasRenderingContext2D, state: ScatterCanvasState): void {
    const exiting = state.exiting;
    if (!exiting) return;
    const clip = state.clipRect;

    const byFill = new Map<string, number[]>();
    for (let i = 0; i < exiting.r.length; i++) {
      const r = exiting.r[i];
      if (r <= 0) continue;
      if (!inRect(exiting.x[i], exiting.y[i], r, clip)) continue;
      const fill = exiting.fill[i];
      const bucket = byFill.get(fill);
      if (bucket) bucket.push(i);
      else byFill.set(fill, [i]);
    }

    ctx.globalAlpha = exiting.alpha;
    for (const [fill, indices] of byFill) {
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const i of indices) {
        const r = exiting.r[i];
        ctx.moveTo(exiting.x[i] + r, exiting.y[i]);
        ctx.arc(exiting.x[i], exiting.y[i], r, 0, TWO_PI);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Live points
  // -------------------------------------------------------------------------

  /** Fill pass: one path per (fill, effective alpha) bucket. */
  private drawPoints(ctx: CanvasRenderingContext2D, state: ScatterCanvasState): void {
    const marks = state.marks;
    const enterAlpha = state.enterAlpha;
    const clip = state.clipRect;

    const buckets = new Map<string, { fill: string; alpha: number; indices: number[] }>();
    for (let i = 0; i < marks.n; i++) {
      const r = marks.r[i];
      if (r <= 0) continue;
      if (!inRect(marks.x[i], marks.y[i], r, clip)) continue;
      const alpha = marks.fillOpacity[i] * (enterAlpha ? enterAlpha[i] : 1);
      if (alpha <= 0) continue;
      const fill = marks.fill[i];
      const key = `${fill}|${alpha.toFixed(3)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.indices.push(i);
      else buckets.set(key, { fill, alpha, indices: [i] });
    }

    for (const { fill, alpha, indices } of buckets.values()) {
      ctx.fillStyle = fill;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const i of indices) {
        const r = marks.r[i];
        ctx.moveTo(marks.x[i] + r, marks.y[i]);
        ctx.arc(marks.x[i], marks.y[i], r, 0, TWO_PI);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Stroke pass: one path per (stroke, width) bucket. */
  private drawStrokes(ctx: CanvasRenderingContext2D, state: ScatterCanvasState): void {
    const marks = state.marks;
    const enterAlpha = state.enterAlpha;
    const clip = state.clipRect;

    const buckets = new Map<
      string,
      { stroke: string; width: number; alpha: number; indices: number[] }
    >();
    for (let i = 0; i < marks.n; i++) {
      const width = marks.strokeWidth[i];
      const stroke = marks.stroke[i];
      if (!stroke || width <= 0) continue;
      const r = marks.r[i];
      if (r <= 0) continue;
      if (!inRect(marks.x[i], marks.y[i], r, clip)) continue;
      const alpha = enterAlpha ? enterAlpha[i] : 1;
      if (alpha <= 0) continue;
      const key = `${stroke}|${width}|${alpha.toFixed(3)}`;
      const bucket = buckets.get(key);
      if (bucket) bucket.indices.push(i);
      else buckets.set(key, { stroke, width, alpha, indices: [i] });
    }

    for (const { stroke, width, alpha, indices } of buckets.values()) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      for (const i of indices) {
        const r = marks.r[i];
        ctx.moveTo(marks.x[i] + r, marks.y[i]);
        ctx.arc(marks.x[i], marks.y[i], r, 0, TWO_PI);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------------------------
  // Hover
  // -------------------------------------------------------------------------

  private drawHoverRing(ctx: CanvasRenderingContext2D, state: ScatterCanvasState): void {
    const i = state.hoverIndex;
    if (i < 0 || i >= state.marks.n) return;
    const marks = state.marks;
    const r = marks.r[i];
    if (r <= 0) return;

    ctx.globalAlpha = 1;
    ctx.strokeStyle = state.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(marks.x[i], marks.y[i], r + HOVER_RING_PAD, 0, TWO_PI);
    ctx.stroke();
  }
}

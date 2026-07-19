/**
 * Immutable zoom transform for graph pan/zoom.
 *
 * Provides coordinate conversion between screen space (canvas pixels)
 * and graph space (simulation coordinates). All mutations return new
 * instances rather than modifying in place.
 */

import type { PositionedNode } from './types';

export class ZoomTransform {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly k: number,
  ) {}

  /** Convert screen coordinates to graph coordinates. */
  screenToGraph(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.x) / this.k,
      y: (sy - this.y) / this.k,
    };
  }

  /** Convert graph coordinates to screen coordinates. */
  graphToScreen(gx: number, gy: number): { x: number; y: number } {
    return {
      x: gx * this.k + this.x,
      y: gy * this.k + this.y,
    };
  }

  /**
   * Zoom to a target scale, keeping the given screen-space pivot
   * point fixed (content under the cursor stays under the cursor).
   */
  zoomAt(targetK: number, pivotX: number, pivotY: number): ZoomTransform {
    // The graph point under the pivot should remain at the same screen position.
    // Before: pivotX = gx * k + x  =>  gx = (pivotX - x) / k
    // After:  pivotX = gx * targetK + newX  =>  newX = pivotX - gx * targetK
    const gx = (pivotX - this.x) / this.k;
    const gy = (pivotY - this.y) / this.k;
    return new ZoomTransform(pivotX - gx * targetK, pivotY - gy * targetK, targetK);
  }

  /** Pan by a screen-space delta. */
  pan(dx: number, dy: number): ZoomTransform {
    return new ZoomTransform(this.x + dx, this.y + dy, this.k);
  }

  /**
   * Compute a transform that fits all nodes within the given canvas
   * dimensions with the specified padding.
   *
   * Returns the transform and the ideal content height (in screen pixels)
   * so callers can shrink the canvas to eliminate dead space.
   */
  static fitBounds(
    nodes: PositionedNode[],
    canvasW: number,
    canvasH: number,
    padding: number = 40,
    opts?: { spread?: boolean; insetTop?: number },
  ): { transform: ZoomTransform; contentHeight: number } {
    if (nodes.length === 0) {
      return { transform: ZoomTransform.identity(), contentHeight: canvasH };
    }

    // Reserved band at the top of the canvas (the HTML chrome overlay). The fit
    // centers within the remaining area so nodes don't sit under the title.
    // Clamped so a degenerate measurement can't consume the whole viewport.
    const insetTop = Math.min(Math.max(0, opts?.insetTop ?? 0), canvasH * 0.4);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const n of nodes) {
      const r = n.radius;
      if (n.x - r < minX) minX = n.x - r;
      if (n.y - r < minY) minY = n.y - r;
      if (n.x + r > maxX) maxX = n.x + r;
      if (n.y + r > maxY) maxY = n.y + r;
    }

    let graphW = maxX - minX;
    let graphH = maxY - minY;

    if (graphW === 0 && graphH === 0) {
      // All nodes at the same point; center within the area below the inset
      return {
        transform: new ZoomTransform(
          canvasW / 2 - minX,
          insetTop + (canvasH - insetTop) / 2 - minY,
          1,
        ),
        contentHeight: padding * 2 + insetTop,
      };
    }

    // When called early in the simulation (first tick), the bounding box
    // underestimates the final spread. Apply a spread multiplier based on
    // node count: larger graphs expand more as charge forces push nodes
    // apart over subsequent ticks. The sqrt scaling mirrors how d3-force
    // charge repulsion grows with node count.
    //
    // Warmup (Phase 6) settles the layout headlessly before the first fit, so
    // the bounds are already near-final; inflating them then fits at roughly
    // half the correct zoom at 10k nodes. Callers pass `spread: false` after a
    // warmup ran to skip the inflation. Default true = the original behavior.
    if (opts?.spread !== false && nodes.length > 50) {
      const spread = 1 + Math.sqrt(nodes.length) / 120;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      graphW *= spread;
      graphH *= spread;
      minX = cx - graphW / 2;
      maxX = cx + graphW / 2;
      minY = cy - graphH / 2;
      maxY = cy + graphH / 2;
    }

    const availW = canvasW - padding * 2;
    const availH = canvasH - insetTop - padding * 2;
    // Cap at 1 so the graph never renders larger than its natural size
    const k = Math.min(1, availW / graphW, availH / graphH);

    // Center horizontally; center vertically within the area below the inset.
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = canvasW / 2 - cx * k;
    const ty = insetTop + (canvasH - insetTop) / 2 - cy * k;

    // Content height = scaled graph extent + top and bottom padding + inset
    const contentHeight = graphH * k + padding * 2 + insetTop;

    return {
      transform: new ZoomTransform(tx, ty, k),
      contentHeight,
    };
  }

  /** Identity transform (no pan, no zoom). */
  static identity(): ZoomTransform {
    return new ZoomTransform(0, 0, 1);
  }
}

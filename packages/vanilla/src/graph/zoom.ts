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
   */
  static fitBounds(
    nodes: PositionedNode[],
    canvasW: number,
    canvasH: number,
    padding: number = 40,
  ): ZoomTransform {
    if (nodes.length === 0) {
      return ZoomTransform.identity();
    }

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

    const graphW = maxX - minX;
    const graphH = maxY - minY;

    if (graphW === 0 && graphH === 0) {
      // All nodes at the same point; just center
      return new ZoomTransform(canvasW / 2 - minX, canvasH / 2 - minY, 1);
    }

    const availW = canvasW - padding * 2;
    const availH = canvasH - padding * 2;
    const k = Math.min(availW / graphW, availH / graphH);

    // Center the graph in the canvas
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const tx = canvasW / 2 - cx * k;
    const ty = canvasH / 2 - cy * k;

    return new ZoomTransform(tx, ty, k);
  }

  /** Identity transform (no pan, no zoom). */
  static identity(): ZoomTransform {
    return new ZoomTransform(0, 0, 1);
  }
}

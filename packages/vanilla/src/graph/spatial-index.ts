/**
 * Spatial index for fast node hit-testing.
 *
 * Wraps d3-quadtree to provide findNearest (accounts for node radius)
 * and findInRect queries. Tracks a generation counter to avoid unnecessary
 * rebuilds when positions haven't changed.
 */

import { type Quadtree, quadtree } from 'd3-quadtree';
import type { PositionedNode } from './types';

export class SpatialIndex {
  private tree: Quadtree<PositionedNode> | null = null;
  private nodes: PositionedNode[] = [];
  private maxRadius = 0;
  private generation = 0;

  /** Rebuild the quadtree from the current set of positioned nodes. */
  rebuild(nodes: PositionedNode[]): void {
    this.nodes = nodes;
    this.maxRadius = 0;
    for (const n of nodes) {
      if (n.radius > this.maxRadius) this.maxRadius = n.radius;
    }

    this.tree = quadtree<PositionedNode>()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(nodes);
    this.generation++;
  }

  /** Current generation counter. Increments on each rebuild. */
  getGeneration(): number {
    return this.generation;
  }

  /**
   * Find the nearest node to (x, y) within maxDistance.
   * Accounts for node radius: a hit occurs if the point is inside
   * the node circle (distance to center < node.radius), or if the
   * edge-to-edge distance is within maxDistance.
   */
  findNearest(x: number, y: number, maxDistance: number = Infinity): PositionedNode | null {
    if (!this.tree || this.nodes.length === 0) return null;

    // The effective search radius for the quadtree needs to include
    // the largest node radius, because we might be "inside" a large node
    // whose center is far from our search point.
    const searchRadius = maxDistance + this.maxRadius;

    let best: PositionedNode | null = null;
    let bestEffectiveDist = maxDistance + this.maxRadius + 1;

    this.tree.visit((node, x0, y0, x1, y1) => {
      // Closest point in this quad to our target
      const closestX = Math.max(x0, Math.min(x, x1));
      const closestY = Math.max(y0, Math.min(y, y1));
      const quadDist = Math.hypot(closestX - x, closestY - y);

      // Prune: if the closest edge of this quad is beyond searchRadius, skip
      if (quadDist > searchRadius) return true;

      // Check leaf data
      if (!node.length) {
        let current = node;
        do {
          const d = current.data;
          if (d) {
            const dist = Math.hypot(d.x - x, d.y - y);
            // Effective distance: subtract the node's radius.
            // If we're inside the circle, effective distance is 0.
            const effectiveDist = Math.max(0, dist - d.radius);
            if (effectiveDist <= maxDistance && effectiveDist < bestEffectiveDist) {
              bestEffectiveDist = effectiveDist;
              best = d;
            }
          }
        } while ((current = current.next!));
      }

      return false;
    });

    return best;
  }

  /** Find all nodes whose centers fall within the given rectangle. */
  findInRect(x1: number, y1: number, x2: number, y2: number): PositionedNode[] {
    if (!this.tree) return [];

    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);

    const results: PositionedNode[] = [];

    this.tree.visit((node, qx0, qy0, qx1, qy1) => {
      // If quad doesn't overlap the search rect, skip
      if (qx0 > maxX || qx1 < minX || qy0 > maxY || qy1 < minY) {
        return true;
      }

      // Check leaf nodes
      if (!node.length) {
        let current = node;
        do {
          const d = current.data;
          if (d && d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY) {
            results.push(d);
          }
        } while ((current = current.next!));
      }

      return false;
    });

    return results;
  }
}

/**
 * Label collision detection and resolution.
 *
 * Greedy algorithm: sort by priority, place in order, try offset
 * positions for conflicts, demote to tooltip-only if no position works.
 * Targeting ~60% of Infrographic quality for Phase 0.
 */

import type { Rect, ResolvedLabel, TextStyle } from '../types/layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Priority levels for label placement. Data labels win over annotations which win over axes. */
export type LabelPriority = 'data' | 'annotation' | 'axis';

/** Priority sort order (lower = higher priority). */
const PRIORITY_ORDER: Record<LabelPriority, number> = {
  data: 0,
  annotation: 1,
  axis: 2,
};

/**
 * A label candidate for collision resolution.
 * The collision engine decides its final position and visibility.
 */
export interface LabelCandidate {
  /** The label text. */
  text: string;
  /** Preferred anchor position (before collision resolution). */
  anchorX: number;
  /** Preferred anchor position (before collision resolution). */
  anchorY: number;
  /** Estimated width of the label text. */
  width: number;
  /** Estimated height of the label text. */
  height: number;
  /** Label priority for collision resolution. */
  priority: LabelPriority;
  /** Text style to apply. */
  style: TextStyle;
}

// ---------------------------------------------------------------------------
// Collision detection
// ---------------------------------------------------------------------------

/**
 * Detect AABB (axis-aligned bounding box) overlap between two rectangles.
 */
export function detectCollision(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// ---------------------------------------------------------------------------
// Offset strategies
// ---------------------------------------------------------------------------

/** Offsets to try when a label collides with an existing placement. */
const OFFSET_STRATEGIES = [
  { dx: 0, dy: 0 }, // original position
  { dx: 0, dy: -1.2 }, // above (factor of height)
  { dx: 0, dy: 1.2 }, // below
  { dx: 1.1, dy: 0 }, // right
  { dx: -1.1, dy: 0 }, // left
  { dx: 1.1, dy: -1.2 }, // upper-right
  { dx: -1.1, dy: -1.2 }, // upper-left
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve label collisions using a greedy placement algorithm.
 *
 * Sorts labels by priority (data > annotation > axis), then places
 * each label at its preferred position. If it collides with an already-placed
 * label, tries offset positions. If no position works, the label is
 * demoted to tooltip-only (visible: false).
 *
 * @param labels - Array of label candidates to position.
 * @returns Array of resolved labels with computed positions and visibility.
 */
export function resolveCollisions(labels: LabelCandidate[]): ResolvedLabel[] {
  // Sort by priority (highest first)
  const sorted = [...labels].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
  );

  const placed: Rect[] = [];
  const results: ResolvedLabel[] = [];

  for (const label of sorted) {
    let bestRect: Rect | null = null;
    let bestX = label.anchorX;
    let bestY = label.anchorY;

    // Try each offset strategy
    for (const offset of OFFSET_STRATEGIES) {
      const candidateX = label.anchorX + offset.dx * label.width;
      const candidateY = label.anchorY + offset.dy * label.height;
      const candidateRect: Rect = {
        x: candidateX,
        y: candidateY,
        width: label.width,
        height: label.height,
      };

      const hasCollision = placed.some((p) => detectCollision(candidateRect, p));

      if (!hasCollision) {
        bestRect = candidateRect;
        bestX = candidateX;
        bestY = candidateY;
        break;
      }
    }

    if (bestRect) {
      placed.push(bestRect);
      const nudgeDx = bestX - label.anchorX;
      const nudgeDy = bestY - label.anchorY;
      const nudgeDist = Math.sqrt(nudgeDx * nudgeDx + nudgeDy * nudgeDy);
      // Only show a connector when the label is nudged far enough that the
      // reader can't tell which data point it belongs to. Short nudges between
      // adjacent series labels produce visual noise without aiding comprehension.
      const MIN_CONNECTOR_DISTANCE = 20;
      const needsConnector = nudgeDist >= MIN_CONNECTOR_DISTANCE;

      results.push({
        text: label.text,
        x: bestX,
        y: bestY,
        style: label.style,
        visible: true,
        connector: needsConnector
          ? {
              from: { x: bestX, y: bestY },
              to: { x: label.anchorX, y: label.anchorY },
              stroke: label.style.fill,
              style: 'straight' as const,
            }
          : undefined,
      });
    } else {
      // No position works, demote to tooltip-only
      results.push({
        text: label.text,
        x: label.anchorX,
        y: label.anchorY,
        style: label.style,
        visible: false,
      });
    }
  }

  return results;
}

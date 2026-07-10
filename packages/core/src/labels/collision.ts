/**
 * Label collision detection and resolution.
 *
 * Greedy algorithm: sort by priority, place in order, try offset
 * positions for conflicts, demote to tooltip-only if no position works.
 */

import { estimateTextWidth } from '../layout/text-measure';
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
  /**
   * Optional caller-assigned source index. resolveCollisions may reorder its
   * output (it sorts by priority), so callers that zip the result back against
   * a parallel array should carry an index here and read it off ResolvedLabel
   * rather than relying on positional order.
   */
  index?: number;
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

/** Compute the area of intersection between two axis-aligned rectangles. Returns 0 if disjoint. */
export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

// ---------------------------------------------------------------------------
// Offset strategies
// ---------------------------------------------------------------------------

/** An offset position to try when resolving a label collision. */
export interface OffsetStrategy {
  dx: number;
  dy: number;
}

/** Offsets to try when a label collides with an existing placement. */
export const OFFSET_STRATEGIES: readonly OffsetStrategy[] = [
  { dx: 0, dy: 0 }, // original position
  { dx: 0, dy: -1.2 }, // above (factor of height)
  { dx: 0, dy: 1.2 }, // below
  { dx: 1.1, dy: 0 }, // right
  { dx: -1.1, dy: 0 }, // left
  { dx: 1.1, dy: -1.2 }, // upper-right
  { dx: -1.1, dy: -1.2 }, // upper-left
];

/**
 * Extended offset strategies with additional vertical spread for dense
 * multi-series endpoints (e.g. 5+ line series converging at similar y-values).
 */
export const EXTENDED_OFFSET_STRATEGIES: readonly OffsetStrategy[] = [
  ...OFFSET_STRATEGIES,
  { dx: 0, dy: -2.4 }, // further above
  { dx: 0, dy: 2.4 }, // further below
  { dx: 0, dy: -3.6 }, // even further above
  { dx: 0, dy: 3.6 }, // even further below
  { dx: 1.1, dy: -2.4 }, // upper-right far
  { dx: 1.1, dy: 2.4 }, // lower-right far
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
 * @param strategies - Optional offset strategies to use (defaults to OFFSET_STRATEGIES).
 * @returns Array of resolved labels with computed positions and visibility.
 */
export function resolveCollisions(
  labels: LabelCandidate[],
  strategies: readonly OffsetStrategy[] = OFFSET_STRATEGIES,
): ResolvedLabel[] {
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
    for (const offset of strategies) {
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
        // Only carry the index through when the caller set one, so labels that
        // don't need it keep an unchanged output shape.
        ...(label.index !== undefined ? { index: label.index } : {}),
        connector: needsConnector
          ? {
              from: { x: bestX, y: bestY },
              to: { x: label.anchorX, y: label.anchorY },
              stroke: label.style.fill,
              style: 'straight' as const,
              arrow: false,
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
        ...(label.index !== undefined ? { index: label.index } : {}),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Label bounds estimation
// ---------------------------------------------------------------------------

/**
 * Compute the bounding rect of a resolved label from its position and text.
 * Uses heuristic text measurement so it works without DOM access.
 *
 * label.y is the SVG text anchor point, whose meaning depends on the label's
 * dominant-baseline. The rect's top edge is derived accordingly so the box
 * covers the actual glyphs (obstacles were sitting ~0.8*fontSize below the
 * text for alphabetic-baseline labels, e.g. column value labels):
 *   - 'central': y is the vertical center, so top = y - height/2.
 *   - 'hanging'/'text-after-edge': y is the top edge already.
 *   - default (alphabetic): y is the baseline, so top = y - fontSize*0.8
 *     (matches textAscent, the top-to-baseline distance renderers apply).
 */
export function computeLabelBounds(label: ResolvedLabel): Rect {
  const fontSize = label.style.fontSize;
  const fontWeight = label.style.fontWeight;
  const width = estimateTextWidth(label.text, fontSize, fontWeight);
  const height = fontSize * (label.style.lineHeight ?? 1.2);

  // Adjust x based on text anchor
  let x = label.x;
  if (label.style.textAnchor === 'middle') {
    x = label.x - width / 2;
  } else if (label.style.textAnchor === 'end') {
    x = label.x - width;
  }

  // Map the anchor y to the box top based on dominant-baseline.
  const baseline = label.style.dominantBaseline;
  let y: number;
  if (baseline === 'central') {
    y = label.y - height / 2;
  } else if (baseline === 'hanging' || baseline === 'text-after-edge') {
    y = label.y;
  } else {
    y = label.y - fontSize * 0.8;
  }

  return { x, y, width, height };
}

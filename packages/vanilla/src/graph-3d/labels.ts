/**
 * Label visibility policy for the 3D renderer.
 *
 * Same two-stage shape as 2D: rank, then declutter. This module is the ranking
 * half — forced labels (seed / `alwaysShowLabel` overrides, hovered, selected,
 * search matches) first, then the highest-priority nodes, nearest camera first,
 * up to the budget. The mount does the screen-space overlap pass on the ordered
 * result, which is why the order matters and not just the membership.
 *
 * Pure: no three.js, no DOM. The mount feeds it plain positions.
 */

/** A label candidate: a node with a resolved label and a compiled priority. */
export interface LabelCandidate {
  id: string;
  /** Compiled `labelPriority` (0..1, degree-derived). Higher wins. */
  priority: number;
  x: number;
  y: number;
  z: number;
}

/** Default 3D label budget beyond the forced set. */
export const LABEL_BUDGET_3D = 40;

/**
 * Node ids whose label sprite may be shown, best first.
 *
 * `forced` ids lead the list and do NOT consume budget. The rest are ranked by
 * `(priority desc, camera distance asc)` and the top `budget` follow.
 */
export function resolveVisibleLabels(
  nodes: LabelCandidate[],
  forced: Set<string>,
  cameraPos: { x: number; y: number; z: number },
  budget: number,
): string[] {
  const visible: string[] = [];
  for (const n of nodes) if (forced.has(n.id)) visible.push(n.id);
  if (budget <= 0) return visible;

  const ranked: Array<{ id: string; priority: number; dist: number }> = [];
  for (const n of nodes) {
    if (forced.has(n.id)) continue;
    const dx = n.x - cameraPos.x;
    const dy = n.y - cameraPos.y;
    const dz = n.z - cameraPos.z;
    ranked.push({ id: n.id, priority: n.priority, dist: dx * dx + dy * dy + dz * dz });
  }

  // Priority first (the compiled importance ordering), distance as the
  // tiebreaker, id last so the result is stable for equal-priority nodes at
  // equal distance (the seeded-layout stories rely on a deterministic set).
  ranked.sort((a, b) => b.priority - a.priority || a.dist - b.dist || (a.id < b.id ? -1 : 1));

  for (let i = 0; i < ranked.length && i < budget; i++) visible.push(ranked[i].id);
  return visible;
}

/** A label's screen-space footprint, in pixels. */
export interface LabelBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Breathing room around a label box in the declutter pass, in pixels. */
const LABEL_BOX_PAD = 2;

/**
 * The screen box a label would occupy, or null when the point did not project.
 *
 * Width is estimated from the glyph count rather than measured: a sprite has no
 * `measureText`, and 2D's own fallback in `graph/canvas-renderer.ts` uses the
 * same 0.55 average-glyph ratio.
 */
export function labelBox(
  projected: { x: number; y: number } | null | undefined,
  text: string,
  heightPx: number,
): LabelBox | null {
  if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  const width = Math.max(1, text.length) * heightPx * 0.55;
  // The sprite sits above the node; the exact offset only has to be consistent,
  // since every box uses it.
  const cy = projected.y - heightPx;
  return {
    x0: projected.x - width / 2 - LABEL_BOX_PAD,
    x1: projected.x + width / 2 + LABEL_BOX_PAD,
    y0: cy - heightPx / 2 - LABEL_BOX_PAD,
    y1: cy + heightPx / 2 + LABEL_BOX_PAD,
  };
}

export function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

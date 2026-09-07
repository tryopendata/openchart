/**
 * Highlight-target resolution, shared by the 2D and 3D graph renderers.
 *
 * Both mounts compose the same two-layer highlight model (a sticky legend
 * category filter under a transient `highlight()` target), and both resolved
 * targets the same way. The resolution is pure — target plus compiled nodes and
 * adjacency in, node id set out — so it lives here rather than being written
 * twice and drifting.
 */

import type { GraphHighlightTarget } from '../graph-mount';

/** The compiled-node fields the resolution actually reads. */
export interface HighlightNode {
  id: string;
  data?: Record<string, unknown>;
}

/**
 * Resolve a highlight target into a concrete node id set.
 *
 * @param target - The target passed to `highlight()`.
 * @param nodes - The current compiled nodes (for the category form).
 * @param adjacency - Node id to neighbour ids (for the `neighborsOf` form).
 */
export function resolveHighlightTarget(
  target: GraphHighlightTarget,
  nodes: readonly HighlightNode[],
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
): Set<string> {
  if ('nodeIds' in target) return new Set(target.nodeIds);
  if ('neighborsOf' in target) {
    const set = new Set<string>();
    if (target.includeSelf !== false) set.add(target.neighborsOf);
    const neighbors = adjacency.get(target.neighborsOf);
    if (neighbors) for (const nid of neighbors) set.add(nid);
    return set;
  }
  // Category form: match nodes whose `field` value is in `value`.
  const values = new Set(
    Array.isArray(target.category.value) ? target.category.value : [target.category.value],
  );
  const field = target.category.field;
  const set = new Set<string>();
  for (const n of nodes) {
    const v = n.data?.[field];
    if (v != null && values.has(String(v))) set.add(n.id);
  }
  return set;
}

/**
 * Node ids for the active legend categories, or null when no filter is up
 * (an empty active set means "everything", not "nothing").
 */
export function categoryHighlightSet(
  activeCategories: ReadonlySet<string>,
  nodeCategory: ReadonlyMap<string, string>,
): Set<string> | null {
  if (activeCategories.size === 0) return null;
  const set = new Set<string>();
  for (const [id, cat] of nodeCategory) if (activeCategories.has(cat)) set.add(id);
  return set;
}

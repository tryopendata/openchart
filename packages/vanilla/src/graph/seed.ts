/**
 * Deterministic seeded initial layout for the force simulation.
 *
 * Without seeding, d3-force places nodes on a phyllotaxis spiral, so the settled
 * layout depends on node ORDER and isn't reproducible across data reshapes. With
 * a seed, each node's start position is a pure function of `(id, seed, community)`,
 * so the same spec + seed produces the same settled layout — and adding a node
 * leaves the others' start positions untouched (their hash inputs don't change).
 *
 * Determinism is scoped PER EXECUTION PATH (worker OR sync): identical within a
 * path, not guaranteed identical across the two.
 */

import type { SimNode } from './worker-protocol';

/** FNV-1a 32-bit hash of a string. Fast, dependency-free, well-distributed. */
export function hash32(str: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts (stays within Math.imul's 32-bit range).
    h = Math.imul(h, 0x01000193);
  }
  // Coerce to an unsigned 32-bit integer.
  return h >>> 0;
}

/** Map a 32-bit hash to a float in [0, 1). */
function unit(h: number): number {
  return (h >>> 0) / 0x100000000;
}

/**
 * Seed each node's initial `x`/`y` as a pure function of `(id, seed, community)`.
 * Mutates the nodes in place (matching how d3 mutates its node objects).
 *
 * Placement is a uniform disc: `r = R0·sqrt(u1)`, `θ = u2·2π`. When a node has a
 * `community`, its disc center is biased by `0.6·R0` toward a per-community angle,
 * so clusters start near their eventual region and settle faster/cleaner.
 *
 * DEVIATION from the plan's `R0 ≈ 10·√n`: R0 is a FIXED constant, not derived
 * from the live node count. An n-dependent R0 would rescale every node's start
 * position whenever a node is added, which directly violates the reproducibility
 * guarantee ("adding a node leaves the others' seed positions unchanged"). Since
 * a deterministic seed is pointless if one insertion reshuffles the layout, the
 * per-node determinism wins; d3-force's charge repulsion still spreads the cloud
 * to fill the viewport regardless of the initial disc radius. R0 is sized for a
 * ~900-node graph (10·√900 = 300), a reasonable middle for the initial cloud.
 */
const R0 = 300;

export function seedNodePositions(nodes: SimNode[], seed: number): void {
  const n = nodes.length;
  if (n === 0) return;

  for (const node of nodes) {
    // Two independent hash streams per node from distinct salts.
    const u1 = unit(hash32(`${node.id}|${seed}|r`));
    const u2 = unit(hash32(`${node.id}|${seed}|t`));
    const r = R0 * Math.sqrt(u1);
    const theta = u2 * Math.PI * 2;

    let cx = 0;
    let cy = 0;
    if (node.community) {
      // Per-community region angle: stable across runs, varies with seed.
      const ca = unit(hash32(`${node.community}|${seed}`)) * Math.PI * 2;
      const bias = 0.6 * R0;
      cx = Math.cos(ca) * bias;
      cy = Math.sin(ca) * bias;
    }

    node.x = cx + r * Math.cos(theta);
    node.y = cy + r * Math.sin(theta);
  }
}

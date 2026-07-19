/**
 * The no-forceCenter-on-update fix.
 *
 * d3's `forceCenter` is NOT alpha-scaled: it snaps every node by the FULL centroid
 * error on tick 1, which is exactly the global-jump artifact Phase 7 eliminates on
 * data updates. Update sims omit it and rely on the alpha-scaled forceX/forceY
 * gravity (strength 0.05), so an off-center cluster of already-settled survivors
 * barely moves on the first post-update tick.
 *
 * This asserts the physics claim directly on a raw d3 sim ticked ONCE (isolating
 * tick 1 from the sync path's 15-tick batching), then confirms the two mount-level
 * sim paths register `center` behind the same `centerForce` guard so the mount can
 * suppress it by passing `centerForce: false`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationNodeDatum,
} from 'd3-force';
import { describe, expect, it } from 'vitest';

interface N extends SimulationNodeDatum {
  id: string;
  radius: number;
}

// An off-center cluster (~500,500), spread ~60px so charge/collision don't
// dominate. The centroid sits ~707px from origin.
function offCenterNodes(): N[] {
  return [
    { id: 'a', radius: 5, x: 470, y: 470 },
    { id: 'b', radius: 5, x: 530, y: 470 },
    { id: 'c', radius: 5, x: 470, y: 530 },
    { id: 'd', radius: 5, x: 530, y: 530 },
  ];
}

function centroid(ns: N[]): { x: number; y: number } {
  const n = ns.length;
  return {
    x: ns.reduce((s, p) => s + (p.x ?? 0), 0) / n,
    y: ns.reduce((s, p) => s + (p.y ?? 0), 0) / n,
  };
}

/**
 * Build the same force stack the mount's sim uses (charge, collide, alpha-scaled
 * gravity, link), optionally adding the non-scaled center force. Ticked once at a
 * low update alpha, mirroring an update reheat.
 */
function tickOnce(withCenter: boolean): N[] {
  const nodes = offCenterNodes();
  const sim = forceSimulation<N>(nodes)
    .force(
      'link',
      forceLink([{ source: 'a', target: 'b' }])
        .id((d) => (d as N).id)
        .distance(30),
    )
    .force('charge', forceManyBody().strength(-30))
    .force(
      'collide',
      forceCollide<N>().radius((d) => d.radius + 2),
    )
    .force('gravityX', forceX<N>(0).strength(0.05))
    .force('gravityY', forceY<N>(0).strength(0.05))
    .alphaDecay(0.0228)
    .velocityDecay(0.4)
    .stop();
  if (withCenter) sim.force('center', forceCenter(0, 0));
  sim.alpha(0.3);
  sim.tick();
  return nodes;
}

describe('update sim: forceCenter is the global-jump culprit on tick 1', () => {
  it('WITHOUT center force: the off-center centroid barely moves (alpha-scaled only)', () => {
    const c = centroid(tickOnce(false));
    const drift = Math.hypot(c.x - 500, c.y - 500);
    // Only alpha-scaled gravity acts: a few px, not the ~707px centroid offset.
    expect(drift).toBeLessThan(15);
  });

  it('WITH center force: the centroid snaps hard toward origin on tick 1', () => {
    const c = centroid(tickOnce(true));
    const drift = Math.hypot(c.x - 500, c.y - 500);
    // forceCenter recenters the centroid to origin in a single tick.
    expect(drift).toBeGreaterThan(600);
  });
});

// ---------------------------------------------------------------------------
// Both mount sim paths guard `center` behind `centerForce` — the mount passes
// `centerForce: false` for update sims, so this is what actually suppresses it.
// ---------------------------------------------------------------------------

describe('both sim paths gate the center force on config.centerForce', () => {
  const graphDir = join(import.meta.dirname, '..');
  const sync = readFileSync(join(graphDir, 'simulation.ts'), 'utf8');
  const worker = readFileSync(join(graphDir, 'simulation-worker.ts'), 'utf8');

  for (const [name, src] of [
    ['sync', sync],
    ['worker', worker],
  ] as const) {
    it(`${name} path installs forceCenter only when centerForce !== false`, () => {
      expect(src).toContain('config.centerForce !== false');
      expect(src).toContain("'center', forceCenter(0, 0)");
    });
  }
});

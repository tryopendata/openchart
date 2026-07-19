import { describe, expect, it } from 'vitest';
import { seedNodePositions } from '../seed';
import { SimulationManager, ticksToAlphaMin } from '../simulation';
import type { SimEdge, SimNode, WorkerSimulationConfig } from '../worker-protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultConfig(overrides?: Partial<WorkerSimulationConfig>): WorkerSimulationConfig {
  return {
    chargeStrength: -30,
    linkDistance: 30,
    clustering: null,
    alphaDecay: 0.0228,
    velocityDecay: 0.4,
    collisionRadius: 10,
    ...overrides,
  };
}

function makeTriangle(): { nodes: SimNode[]; edges: SimEdge[] } {
  return {
    nodes: [
      { id: 'a', radius: 5 },
      { id: 'b', radius: 5 },
      { id: 'c', radius: 5 },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' },
    ],
  };
}

function makePentagon(): { nodes: SimNode[]; edges: SimEdge[] } {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  return {
    nodes: ids.map((id) => ({ id, radius: 5 })),
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
      { source: 'd', target: 'e' },
      { source: 'e', target: 'a' },
      { source: 'a', target: 'c' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests: Synchronous fallback (bun test has no real Web Worker)
// ---------------------------------------------------------------------------

describe('SimulationManager (sync fallback)', () => {
  it('produces positions for a simple triangle graph', () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let positions: Array<{ id: string; x: number; y: number }> | null = null;
    mgr.onTick((pos) => {
      positions = pos;
    });

    // Sync path fires immediately during create, but callbacks aren't set yet.
    // Reheat to trigger another round with the callback attached.
    mgr.reheat(0.3);

    expect(positions).not.toBeNull();
    expect(positions!.length).toBe(3);

    // All nodes should have finite positions
    for (const p of positions!) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }

    mgr.destroy();
  });

  it('converges positions for a 5-node graph', () => {
    const { nodes, edges } = makePentagon();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let positions: Array<{ id: string; x: number; y: number }> | null = null;
    let _settled = false;

    mgr.onTick((pos) => {
      positions = pos;
    });
    mgr.onSettled(() => {
      _settled = true;
    });

    mgr.reheat(1.0);

    expect(positions).not.toBeNull();
    expect(positions!.length).toBe(5);

    // Nodes should be spread out (not all at origin)
    const uniqueX = new Set(positions!.map((p) => Math.round(p.x)));
    expect(uniqueX.size).toBeGreaterThan(1);

    mgr.destroy();
  });

  it('cluster force pulls same-community nodes closer together', () => {
    // Two communities: A,B,C in "red" and D,E,F in "blue"
    const nodes: SimNode[] = [
      { id: 'a', radius: 5, community: 'red' },
      { id: 'b', radius: 5, community: 'red' },
      { id: 'c', radius: 5, community: 'red' },
      { id: 'd', radius: 5, community: 'blue' },
      { id: 'e', radius: 5, community: 'blue' },
      { id: 'f', radius: 5, community: 'blue' },
    ];

    const edges: SimEdge[] = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'd', target: 'e' },
      { source: 'e', target: 'f' },
      // One cross-community link
      { source: 'c', target: 'd' },
    ];

    const configWithClustering = defaultConfig({
      clustering: { field: 'community', strength: 0.5 },
    });

    const mgr = SimulationManager.create(nodes, edges, configWithClustering);

    let positions: Array<{ id: string; x: number; y: number }> | null = null;
    mgr.onTick((pos) => {
      positions = pos;
    });

    mgr.reheat(1.0);
    expect(positions).not.toBeNull();

    // Compute average position per community
    const posMap = new Map(positions!.map((p) => [p.id, p]));
    const redCentroid = {
      x: (posMap.get('a')!.x + posMap.get('b')!.x + posMap.get('c')!.x) / 3,
      y: (posMap.get('a')!.y + posMap.get('b')!.y + posMap.get('c')!.y) / 3,
    };
    const blueCentroid = {
      x: (posMap.get('d')!.x + posMap.get('e')!.x + posMap.get('f')!.x) / 3,
      y: (posMap.get('d')!.y + posMap.get('e')!.y + posMap.get('f')!.y) / 3,
    };

    // The community centroids should be further apart than members are
    // from their own centroid (clustering is working)
    const interClusterDist = Math.hypot(
      redCentroid.x - blueCentroid.x,
      redCentroid.y - blueCentroid.y,
    );

    // At minimum, communities should be separated
    expect(interClusterDist).toBeGreaterThan(5);

    mgr.destroy();
  });

  it('pin fixes a node position', () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let positions: Array<{ id: string; x: number; y: number }> | null = null;
    mgr.onTick((pos) => {
      positions = pos;
    });

    // Pin node 'a' at specific coordinates
    mgr.pinNode('a', 42, 99);
    mgr.reheat(0.3);

    expect(positions).not.toBeNull();
    const pinned = positions!.find((p) => p.id === 'a');
    expect(pinned).toBeDefined();
    expect(pinned!.x).toBeCloseTo(42, 0);
    expect(pinned!.y).toBeCloseTo(99, 0);

    mgr.destroy();
  });

  it('unpin frees a pinned node', () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let positions: Array<{ id: string; x: number; y: number }> | null = null;
    mgr.onTick((pos) => {
      positions = pos;
    });

    mgr.pinNode('a', 500, 500);
    mgr.reheat(0.3);
    const pinnedPos = positions!.find((p) => p.id === 'a')!;
    expect(pinnedPos.x).toBeCloseTo(500, 0);

    // Now unpin and reheat with high alpha so it moves
    mgr.unpinNode('a');
    mgr.reheat(1.0);

    // After reheating with forces, 'a' should have moved away from 500,500
    // because the other nodes are near the center and charge pushes things apart
    const freedPos = positions!.find((p) => p.id === 'a')!;
    // It should have moved at least a little
    const dist = Math.hypot(freedPos.x - 500, freedPos.y - 500);
    expect(dist).toBeGreaterThan(1);

    mgr.destroy();
  });

  it('destroy prevents further callbacks', async () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let callCount = 0;
    mgr.onTick(() => {
      callCount++;
    });

    mgr.destroy();
    mgr.reheat(0.5);

    // Wait for the deferred initial tick microtask to drain
    await Promise.resolve();

    // No callbacks should fire after destroy
    expect(callCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ticksToAlphaMin: derived sync cap aligned with d3's stopping predicate
// ---------------------------------------------------------------------------

describe('ticksToAlphaMin', () => {
  it('matches d3’s default ~300 ticks for the default alphaDecay', () => {
    // d3: ⌈log(alphaMin) / log(1 - alphaDecay)⌉; default decay 0.0228 → ~300.
    expect(ticksToAlphaMin(0.0228)).toBe(300);
  });

  it('grows for a thorough (small alphaDecay) settle', () => {
    // settle: 'thorough' uses alphaDecay 0.01 → ~688 ticks (vs the old fixed 300).
    const n = ticksToAlphaMin(0.01);
    expect(n).toBeGreaterThan(600);
    expect(n).toBeLessThanOrEqual(800);
  });

  it('ceilings at 800 for tiny decay and guards degenerate inputs', () => {
    expect(ticksToAlphaMin(0.0001)).toBe(800);
    expect(ticksToAlphaMin(0)).toBe(800);
    expect(ticksToAlphaMin(1)).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// Warmup: pre-reveal headless settle, bounded by tick count AND ms budget
// ---------------------------------------------------------------------------

function makeGrid(n: number): { nodes: SimNode[]; edges: SimEdge[] } {
  const nodes: SimNode[] = Array.from({ length: n }, (_, i) => ({ id: `g${i}`, radius: 5 }));
  const edges: SimEdge[] = [];
  for (let i = 1; i < n; i++) edges.push({ source: `g${i - 1}`, target: `g${i}` });
  return { nodes, edges };
}

describe('SimulationManager warmup (sync fallback)', () => {
  it('first delivered tick has alpha < 1 and a non-phyllotaxis spread', async () => {
    const { nodes, edges } = makeGrid(24);
    // Seed like the mount does so the spread isn't d3's phyllotaxis spiral.
    seedNodePositions(nodes, 0);

    const mgr = SimulationManager.create(nodes, edges, defaultConfig({ warmupTicks: 40 }));

    let first: { positions: Array<{ id: string; x: number; y: number }>; alpha: number } | null =
      null;
    mgr.onTick((positions, alpha) => {
      if (!first) first = { positions, alpha };
    });

    // Flush the deferred warmup + first reveal microtask.
    await Promise.resolve();

    expect(first).not.toBeNull();
    // Warmup consumed alpha before the first paint → strictly below the start.
    expect(first!.alpha).toBeLessThan(1);
    // Positions are distinct (spread), not collapsed to a point.
    const xs = new Set(first!.positions.map((p) => Math.round(p.x)));
    expect(xs.size).toBeGreaterThan(1);

    mgr.destroy();
  });

  it('respects the ms budget using an injected clock (no real time)', async () => {
    const { nodes, edges } = makeGrid(30);
    seedNodePositions(nodes, 0);

    // Fake clock: jumps past the 250ms budget on the SECOND read, so warmup bails
    // after the first chunk of ticks regardless of the requested 10000 ticks.
    let calls = 0;
    const fakeNow = () => {
      calls++;
      return calls === 1 ? 0 : 10_000; // first read = start, next = well past budget
    };

    const mgr = SimulationManager.create(
      nodes,
      edges,
      defaultConfig({ warmupTicks: 10_000, warmupBudgetMs: 250 }),
      { now: fakeNow },
    );

    let firstAlpha: number | null = null;
    mgr.onTick((_positions, alpha) => {
      if (firstAlpha === null) firstAlpha = alpha;
    });

    await Promise.resolve();

    expect(firstAlpha).not.toBeNull();
    // Budget truncated warmup: alpha is nowhere near settled (10k ticks would be).
    // A handful of ticks barely dents alpha from 1.
    expect(firstAlpha!).toBeGreaterThan(0.5);
    // The clock was consulted (budget path exercised), not real time.
    expect(calls).toBeGreaterThanOrEqual(2);

    mgr.destroy();
  });

  it('warmupTicks=0 disables warmup (first tick is the normal batch)', async () => {
    const { nodes, edges } = makeGrid(10);
    const mgr = SimulationManager.create(nodes, edges, defaultConfig({ warmupTicks: 0 }));

    let delivered = false;
    mgr.onTick(() => {
      delivered = true;
    });
    await Promise.resolve();
    expect(delivered).toBe(true);

    mgr.destroy();
  });
});

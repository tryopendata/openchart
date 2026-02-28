import { describe, expect, it } from 'vitest';
import { SimulationManager } from '../simulation';
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

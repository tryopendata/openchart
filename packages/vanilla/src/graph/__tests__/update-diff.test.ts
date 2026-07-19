import { describe, expect, it } from 'vitest';
import type { PositionedEdge, PositionedNode } from '../types';
import { diffGraphUpdate, type NextGraph } from '../update-diff';
import type { SimulationConfigLike } from '../update-diff-config';
import { simulationConfigEqual } from '../update-diff-config';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function node(id: string, x: number, y: number, community?: string): PositionedNode {
  return {
    id,
    x,
    y,
    index: 0,
    radius: 5,
    fill: '#3b82f6',
    stroke: '#2563eb',
    strokeWidth: 1,
    label: id,
    labelPriority: 0.5,
    community,
    opacity: 1,
    data: {},
  };
}

function edge(source: string, target: string): PositionedEdge {
  return {
    source,
    target,
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 0,
    stroke: '#999',
    strokeWidth: 1,
    style: 'solid',
    data: {},
  };
}

const baseConfig: SimulationConfigLike = {
  chargeStrength: -30,
  linkDistance: 30,
  clustering: null,
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
  collisionRadius: 7,
};

function next(
  nodes: Array<{ id: string; community?: string }>,
  edges: Array<{ source: string; target: string }>,
  config: SimulationConfigLike = baseConfig,
): NextGraph {
  return { nodes, edges, simulationConfig: config };
}

// ---------------------------------------------------------------------------
// visual-only detection
// ---------------------------------------------------------------------------

describe('diffGraphUpdate visual-only detection', () => {
  const prevNodes = [node('a', 0, 0), node('b', 10, 10)];
  const prevEdges = [edge('a', 'b')];

  it('same node+edge ids AND equal config → visualOnly true (parity with old heuristic)', () => {
    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }]),
      baseConfig,
      0,
    );
    expect(diff.visualOnly).toBe(true);
    expect(diff.enteringIds).toEqual([]);
    expect(diff.exitingNodes).toEqual([]);
    expect(diff.exitingEdges).toEqual([]);
  });

  it('same ids but DIFFERENT simulationConfig → visualOnly FALSE (the old heuristic bug)', () => {
    const changedPhysics = { ...baseConfig, chargeStrength: -120 };
    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }], changedPhysics),
      baseConfig,
      0,
    );
    expect(diff.visualOnly).toBe(false);
  });

  it('changed clustering config → visualOnly FALSE', () => {
    const clustered = { ...baseConfig, clustering: { field: 'group', strength: 0.1 } };
    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }], clustered),
      baseConfig,
      0,
    );
    expect(diff.visualOnly).toBe(false);
  });

  it('different edge set with same nodes → visualOnly FALSE', () => {
    const prevN = [node('a', 0, 0), node('b', 10, 10), node('c', 20, 20)];
    const diff = diffGraphUpdate(
      prevN,
      [edge('a', 'b')],
      next(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [{ source: 'b', target: 'c' }], // edge moved
      ),
      baseConfig,
      0,
    );
    expect(diff.visualOnly).toBe(false);
  });

  it('duplicate-edge multiplicity change → visualOnly FALSE (multiset compare)', () => {
    const prevN = [node('a', 0, 0), node('b', 10, 10), node('c', 20, 20), node('d', 30, 30)];
    const diff = diffGraphUpdate(
      prevN,
      [edge('a', 'b'), edge('a', 'b'), edge('c', 'd')],
      next(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }],
        [
          { source: 'a', target: 'b' },
          { source: 'c', target: 'd' },
          { source: 'c', target: 'd' },
        ],
      ),
      baseConfig,
      0,
    );
    expect(diff.visualOnly).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// entering edge count
// ---------------------------------------------------------------------------

describe('diffGraphUpdate enteringEdgeCount', () => {
  it('counts an edge added between two SURVIVORS (not just edges touching enterers)', () => {
    const prevN = [node('a', 0, 0), node('b', 10, 10), node('c', 20, 20)];
    const diff = diffGraphUpdate(
      prevN,
      [edge('a', 'b')],
      next(
        [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        [
          { source: 'a', target: 'b' },
          { source: 'b', target: 'c' }, // new edge between survivors
        ],
      ),
      baseConfig,
      0,
    );
    expect(diff.enteringIds).toEqual([]);
    expect(diff.enteringEdgeCount).toBe(1);
  });

  it('counts edges touching an entering node too', () => {
    const prevN = [node('a', 0, 0), node('b', 10, 10)];
    const diff = diffGraphUpdate(
      prevN,
      [edge('a', 'b')],
      next(
        [{ id: 'a' }, { id: 'b' }, { id: 'z' }],
        [
          { source: 'a', target: 'b' },
          { source: 'a', target: 'z' },
        ],
      ),
      baseConfig,
      0,
    );
    expect(diff.enteringIds).toEqual(['z']);
    expect(diff.enteringEdgeCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// spawn placement
// ---------------------------------------------------------------------------

describe('diffGraphUpdate spawn placement', () => {
  it('spawns an entering node at its first surviving neighbor (± jitter)', () => {
    const prevNodes = [node('a', 100, 200)];
    const diff = diffGraphUpdate(
      prevNodes,
      [],
      next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }]),
      baseConfig,
      0,
    );
    expect(diff.enteringIds).toEqual(['b']);
    const spawn = diff.spawnPositions.get('b')!;
    // Within the ±8px jitter window of the surviving neighbor 'a'.
    expect(Math.abs(spawn.x - 100)).toBeLessThanOrEqual(8);
    expect(Math.abs(spawn.y - 200)).toBeLessThanOrEqual(8);
    expect(spawn.x).not.toBe(100); // jittered, not exactly on neighbor
  });

  it('falls back to a seeded disc when a node has no surviving neighbor', () => {
    const prevNodes = [node('a', 100, 200)];
    // 'b' and 'c' both enter; 'c' only connects to 'b' (another enterer) → disc.
    const diff = diffGraphUpdate(
      prevNodes,
      [],
      next([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ source: 'b', target: 'c' }]),
      baseConfig,
      0,
    );
    const spawnC = diff.spawnPositions.get('c')!;
    // Not near the only survivor 'a' — the disc fallback is centered on origin.
    expect(Math.hypot(spawnC.x - 100, spawnC.y - 200)).toBeGreaterThan(8);
    expect(Number.isFinite(spawnC.x)).toBe(true);
    expect(Number.isFinite(spawnC.y)).toBe(true);
  });

  it('jitter is deterministic for the same id+seed', () => {
    const prevNodes = [node('a', 0, 0)];
    const graph = next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }]);
    const d1 = diffGraphUpdate(prevNodes, [], graph, baseConfig, 42);
    const d2 = diffGraphUpdate(prevNodes, [], graph, baseConfig, 42);
    expect(d1.spawnPositions.get('b')).toEqual(d2.spawnPositions.get('b'));

    // A different seed produces a different jitter.
    const d3 = diffGraphUpdate(prevNodes, [], graph, baseConfig, 43);
    expect(d3.spawnPositions.get('b')).not.toEqual(d1.spawnPositions.get('b'));
  });
});

// ---------------------------------------------------------------------------
// exit collection
// ---------------------------------------------------------------------------

describe('diffGraphUpdate exit collection', () => {
  it('a removed edge between two survivors lands in exitingEdges', () => {
    const prevNodes = [node('a', 0, 0), node('b', 10, 10)];
    const prevEdges = [edge('a', 'b')];
    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      next([{ id: 'a' }, { id: 'b' }], []), // both survive, edge removed
      baseConfig,
      0,
    );
    expect(diff.exitingNodes).toEqual([]);
    expect(diff.exitingEdges).toHaveLength(1);
    expect(diff.exitingEdges[0].source).toBe('a');
    expect(diff.exitingEdges[0].target).toBe('b');
    expect(diff.visualOnly).toBe(false);
  });

  it('removing a node collects its node and incident edges as exiting', () => {
    const prevNodes = [node('a', 0, 0), node('b', 10, 10), node('c', 20, 20)];
    const prevEdges = [edge('a', 'b'), edge('b', 'c')];
    const diff = diffGraphUpdate(
      prevNodes,
      prevEdges,
      next([{ id: 'a' }, { id: 'b' }], [{ source: 'a', target: 'b' }]),
      baseConfig,
      0,
    );
    expect(diff.exitingNodes.map((n) => n.id)).toEqual(['c']);
    expect(diff.exitingEdges.map((e) => `${e.source}->${e.target}`)).toEqual(['b->c']);
    // 'a' and 'b' survive with their prior positions.
    expect(diff.survivingPositions.get('a')).toEqual({ x: 0, y: 0 });
    expect(diff.survivingPositions.get('b')).toEqual({ x: 10, y: 10 });
  });
});

// ---------------------------------------------------------------------------
// config equality
// ---------------------------------------------------------------------------

describe('simulationConfigEqual', () => {
  it('ignores initialAlpha (the per-update reheat impulse)', () => {
    expect(
      simulationConfigEqual(
        { ...baseConfig, initialAlpha: 0.3 },
        { ...baseConfig, initialAlpha: 0.9 },
      ),
    ).toBe(true);
  });

  it('detects a physics change', () => {
    expect(simulationConfigEqual(baseConfig, { ...baseConfig, linkDistance: 60 })).toBe(false);
  });
});

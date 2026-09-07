import type { SimulationConfig } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import {
  applySimulationConfig,
  budgetedWarmupTicks,
  forceCluster3D,
  ticksToSettle,
} from '../forces';
import type { Graph3D, Node3D } from '../types';
import { FakeForceGraph3D } from './force-graph-fake';

function node(id: string, community: string | undefined, x: number, y: number, z: number): Node3D {
  return {
    id,
    // Only `radius` and `community` are read off the compiled node here.
    node: { community, radius: 5 } as Node3D['node'],
    x,
    y,
    z,
  };
}

const config: SimulationConfig = {
  chargeStrength: -500,
  linkDistance: 100,
  linkStrength: 0.3,
  clustering: { field: 'community', strength: 0.4 },
  alphaDecay: 0.0228,
  velocityDecay: 0.4,
  collisionRadius: 12,
  collisionPadding: 4,
  warmupTicks: 30,
};

describe('forceCluster3D', () => {
  it('pulls each node toward its own community centroid in all three axes', () => {
    const nodes = [
      node('a', 'x', 0, 0, 0),
      node('b', 'x', 10, 20, 30),
      node('c', 'y', -100, -100, -100),
    ];
    const force = forceCluster3D(0.5) as ((alpha: number) => void) & {
      initialize(n: Node3D[]): void;
    };
    force.initialize(nodes);
    force(1);

    // Community x centroid is (5, 10, 15); a is pulled toward it, b away from
    // the far corner back to it, and both by strength * alpha * delta.
    expect(nodes[0].vx).toBeCloseTo(2.5);
    expect(nodes[0].vy).toBeCloseTo(5);
    expect(nodes[0].vz).toBeCloseTo(7.5);
    expect(nodes[1].vx).toBeCloseTo(-2.5);
    // A single-member community sits on its own centroid, so nothing moves.
    expect(nodes[2].vx).toBeCloseTo(0);
  });

  it('ignores nodes with no community', () => {
    const nodes = [node('a', undefined, 10, 10, 10)];
    const force = forceCluster3D(1) as ((alpha: number) => void) & {
      initialize(n: Node3D[]): void;
    };
    force.initialize(nodes);
    force(1);
    expect(nodes[0].vx).toBeUndefined();
  });
});

describe('ticksToSettle', () => {
  it('derives the cooldown from the alpha decay', () => {
    expect(ticksToSettle(0.0228)).toBe(300);
    expect(ticksToSettle(0.01)).toBe(688);
  });

  it('clamps a degenerate decay to the ceiling', () => {
    expect(ticksToSettle(0)).toBe(800);
    expect(ticksToSettle(1)).toBe(800);
  });
});

describe('applySimulationConfig', () => {
  it('maps every compiled knob onto the library', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, config, 40);

    expect((fake.forces.get('charge') as { strengthValue: number }).strengthValue).toBe(-500);
    expect((fake.forces.get('link') as { distanceValue: number }).distanceValue).toBe(100);
    expect((fake.forces.get('link') as { strengthValue: number }).strengthValue).toBe(0.3);
    expect(fake.forces.get('collide')).toBeTypeOf('function');
    expect(fake.forces.get('cluster')).toBeTypeOf('function');
    expect(fake.props.d3VelocityDecay).toBe(0.4);
    expect(fake.props.d3AlphaDecay).toBe(0.0228);
    expect(fake.props.warmupTicks).toBe(30);
    expect(fake.props.cooldownTicks).toBe(300);
  });

  it('trims warmup ticks to the wall-clock budget on a big graph', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, { ...config, warmupTicks: 100 }, 3000);
    // 100 synchronous ticks at 3,000 nodes is a ~3s stall; the budget caps it.
    expect(fake.props.warmupTicks).toBeLessThan(40);
    expect(fake.props.warmupTicks).toBeGreaterThanOrEqual(5);
  });

  it('clears the cluster force when the spec has no clustering', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, { ...config, clustering: null }, 40);
    expect(fake.forces.get('cluster')).toBeNull();
  });

  it('removes the library default center force when the spec turns it off', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, { ...config, centerForce: false }, 40);
    expect(fake.forces.get('center')).toBeNull();
  });

  it('leaves the center force in place when the spec did not turn it off', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    const installed = fake.forces.get('center');
    applySimulationConfig(fake as unknown as Graph3D, config, 40);
    // The library's own force, not a replacement.
    expect(fake.forces.get('center')).toBe(installed);
  });

  it('restores a center force after an update turns centering back on', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, { ...config, centerForce: false }, 40);
    expect(fake.forces.get('center')).toBeNull();

    // The library installs its center force in the constructor only, so
    // nothing puts one back unless we do.
    applySimulationConfig(fake as unknown as Graph3D, { ...config, centerForce: true }, 40);
    expect(fake.forces.get('center')).toBeTypeOf('function');
  });

  it('sizes collision from the node radius plus the compiled padding', () => {
    const fake = new FakeForceGraph3D(document.createElement('div'));
    applySimulationConfig(fake as unknown as Graph3D, config, 40);
    const collide = fake.forces.get('collide') as {
      radius(): (n: Node3D, i: number, all: Node3D[]) => number;
    };
    const n = node('a', undefined, 0, 0, 0);
    expect(collide.radius()(n, 0, [n])).toBe(9);
  });
});

describe('budgetedWarmupTicks', () => {
  it('leaves a small graph at the requested count', () => {
    expect(budgetedWarmupTicks(100, 200)).toBe(100);
  });

  it('never drops below the floor, however large the graph', () => {
    expect(budgetedWarmupTicks(100, 1_000_000)).toBe(5);
  });

  it('keeps warmup off when the spec turned it off', () => {
    expect(budgetedWarmupTicks(0, 3000)).toBe(0);
  });
});

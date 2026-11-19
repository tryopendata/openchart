/**
 * 3D graph entrance trigger (play-when-seen), against mocked `three` and
 * `3d-force-graph`. `primeEntrance` hides the marks at boot and arms;
 * `playEntrance` runs once the container is seen.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { springDuration } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('three', async () => await import('./three-fake'));
vi.mock('three-spritetext', async () => await import('./spritetext-fake'));
vi.mock('3d-force-graph', async () => {
  const mod = await import('./force-graph-fake');
  return { default: mod.FakeForceGraph3D };
});

import { createFakeObserver, stubPageLayout } from '../../__test-fixtures__/visibility';
import { setObserverFactory } from '../../visibility';
import { createGraph3D } from '../index';
import type { Node3D } from '../types';
import {
  type FakeForceGraph3D,
  forceGraphInstances,
  resetForceGraphFakes,
} from './force-graph-fake';
import { type Group, resetAllocations } from './three-fake';

const NODES = [
  { id: 'a', label: 'Alpha', kind: 'lab' },
  { id: 'b', label: 'Beta', kind: 'lab' },
  { id: 'c', label: 'Gamma', kind: 'dataset' },
];
const EDGES = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];
/** Longest possible offset with these fixtures (1000ms enter): last node + the link beat. */
const SPAN_MS = 1750;

function enterSpec(enter: Record<string, unknown> = {}): GraphSpec {
  return {
    type: 'graph',
    dimensions: 3,
    nodes: NODES,
    edges: EDGES,
    encoding: { nodeColor: { field: 'kind', type: 'nominal' }, nodeLabel: { field: 'label' } },
    animation: { enter: { duration: 1000, stagger: true, ...enter } },
  } as GraphSpec;
}

let observer: ReturnType<typeof createFakeObserver>;

beforeEach(() => {
  resetForceGraphFakes();
  resetAllocations();
  document.body.replaceChildren();
  observer = createFakeObserver();
  setObserverFactory(observer.factory);
  stubPageLayout();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'Date',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
  setObserverFactory(null);
  vi.restoreAllMocks();
});

function mount(s: GraphSpec, options?: Parameters<typeof createGraph3D>[2]) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const instance = createGraph3D(container, s, options);
  const fake = forceGraphInstances[forceGraphInstances.length - 1];
  fake.flush();
  return { container, instance, fake };
}

function nodeGroup(fake: FakeForceGraph3D, id: string): Group {
  const datum = fake.graph.nodes.find((n) => (n as unknown as Node3D).id === id);
  const accessor = fake.props.nodeThreeObject as (d: Node3D) => Group;
  return accessor(datum as unknown as Node3D);
}

function alpha(fake: FakeForceGraph3D, id: string): number {
  return (nodeGroup(fake, id).children[0] as unknown as { material: { opacity: number } }).material
    .opacity;
}

function scale(fake: FakeForceGraph3D, id: string): number {
  return (nodeGroup(fake, id).children[0] as unknown as { scale: { x: number } }).scale.x;
}

function distance(fake: FakeForceGraph3D, index = fake.cameraPositionCalls.length - 1): number {
  const c = fake.cameraPositionCalls[index];
  return Math.hypot(
    c.position.x - (c.lookAt?.x ?? 0),
    c.position.y - (c.lookAt?.y ?? 0),
    c.position.z - (c.lookAt?.z ?? 0),
  );
}

describe('3D graph entrance trigger', () => {
  it("'visible' keeps every mark hidden until the container is seen", () => {
    const { container, instance, fake } = mount(enterSpec());
    vi.advanceTimersByTime(SPAN_MS + 500);
    for (const id of ['a', 'b', 'c']) expect(alpha(fake, id)).toBe(0);
    expect(instance.entrancePlayed).toBe(false);

    observer.fire(container, 1, 600);
    expect(instance.entrancePlayed).toBe(true);
    vi.advanceTimersByTime(SPAN_MS + 64);
    for (const id of ['a', 'b', 'c']) {
      expect(alpha(fake, id)).toBeCloseTo(1);
      expect(scale(fake, id)).toBe(1);
    }
  });

  it("'mount' plays at once without being seen", () => {
    const { instance, fake } = mount(enterSpec({ trigger: 'mount' }));
    expect(instance.entrancePlayed).toBe(true);
    vi.advanceTimersByTime(SPAN_MS + 64);
    for (const id of ['a', 'b', 'c']) expect(alpha(fake, id)).toBeCloseTo(1);
  });

  it('update() while waiting drops the reveal and ends with every alpha at 1', () => {
    const { container, instance, fake } = mount(enterSpec());
    vi.advanceTimersByTime(200);
    instance.update(enterSpec());
    for (const id of ['a', 'b', 'c']) {
      expect(alpha(fake, id)).toBeCloseTo(1);
      expect(scale(fake, id)).toBe(1);
    }
    // Seeing it afterwards replays nothing.
    observer.fire(container, 1, 600);
    vi.advanceTimersByTime(100);
    for (const id of ['a', 'b', 'c']) expect(alpha(fake, id)).toBeCloseTo(1);
  });

  it('first seen after the layout stopped: pulls back, flies in, lands on the fit', () => {
    const { container, fake } = mount(enterSpec());
    (fake.handlers.onEngineTick as () => void)();
    (fake.handlers.onEngineStop as () => void)();
    // Waiting: the settle framing is the true fit (no pull).
    const fit = distance(fake);
    const settledCalls = fake.cameraPositionCalls.length;

    observer.fire(container, 1, 600);
    vi.advanceTimersByTime(32);
    expect(fake.cameraPositionCalls.length).toBeGreaterThan(settledCalls);
    expect(distance(fake, settledCalls) / fit).toBeGreaterThan(1.4);
    vi.advanceTimersByTime(SPAN_MS + 64);
    expect(distance(fake)).toBeCloseTo(fit, 5);
  });

  it('a camera the viewer took while waiting is left alone on play', () => {
    const { container, fake } = mount(enterSpec());
    const canvas = fake.renderer().domElement as unknown as HTMLCanvasElement;
    canvas.dispatchEvent(new Event('pointerdown'));
    const before = fake.cameraPositionCalls.length;

    observer.fire(container, 1, 600);
    vi.advanceTimersByTime(SPAN_MS + 64);
    expect(fake.cameraPositionCalls).toHaveLength(before);
    for (const id of ['a', 'b', 'c']) expect(alpha(fake, id)).toBeCloseTo(1);
  });

  it('a spring enter phase lasts springDuration', () => {
    const spring = { stiffness: 120, damping: 14 };
    const total = springDuration(spring);
    expect(total).toBeGreaterThan(700);
    const { fake } = mount(
      enterSpec({ trigger: 'mount', stagger: false, spring, duration: undefined }),
    );
    // Past the 500ms default but inside the spring: still popping.
    vi.advanceTimersByTime(600);
    expect(scale(fake, 'a')).not.toBe(1);
    vi.advanceTimersByTime(total + 400);
    for (const id of ['a', 'b', 'c']) {
      expect(alpha(fake, id)).toBeCloseTo(1);
      expect(scale(fake, id)).toBe(1);
    }
  });

  it('suppressEntrance wins over the trigger', () => {
    const { instance, fake } = mount(enterSpec(), { suppressEntrance: true });
    expect(instance.entrancePlayed).toBe(true);
    expect(observer.observed.size).toBe(0);
    for (const id of ['a', 'b', 'c']) expect(alpha(fake, id)).toBeCloseTo(1);
  });
});

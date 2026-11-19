/**
 * 2D graph entrance trigger (play-when-seen) and spring timing.
 *
 * Warmup and the fit always run at mount; under `trigger: 'visible'` the reveal
 * waits, nodes hidden at progress 0, until the container is seen. The reveal is
 * read off the render state the mount hands the canvas renderer.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { springDuration } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FrameClock, installFrameClock } from '../../__test-fixtures__/graph-frame-clock';
import { createFakeObserver, stubPageLayout } from '../../__test-fixtures__/visibility';
import { createGraph } from '../../graph-mount';
import { setObserverFactory } from '../../visibility';
import { GraphCanvasRenderer } from '../canvas-renderer';
import type { GraphRenderState } from '../types';

function spec(enter: Record<string, unknown> = {}): GraphSpec {
  return {
    type: 'graph',
    nodes: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
      { id: 'c', label: 'C' },
      { id: 'd', label: 'D' },
    ],
    edges: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
    ],
    layout: { warmup: 30 },
    animation: { enter },
  } as GraphSpec;
}

function makeContainer(): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'getBoundingClientRect', {
    value: () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    }),
  });
  document.body.appendChild(el);
  return el;
}

let clock: FrameClock;
let fake: ReturnType<typeof createFakeObserver>;
let states: GraphRenderState[];
let container: HTMLElement;

beforeEach(() => {
  clock = installFrameClock();
  fake = createFakeObserver();
  setObserverFactory(fake.factory);
  stubPageLayout();
  states = [];
  vi.spyOn(GraphCanvasRenderer.prototype, 'render').mockImplementation((state) => {
    states.push(state);
  });
  container = makeContainer();
});

afterEach(() => {
  setObserverFactory(null);
  clock.restore();
  vi.restoreAllMocks();
  container.remove();
});

/** Drain the deferred warmup + first tick, then pump frames start..end. */
async function run(start: number, end: number): Promise<void> {
  await Promise.resolve();
  for (let t = start; t <= end; t += 50) clock.pump(t);
}

function lastEntrance() {
  return states[states.length - 1]?.entrance;
}

function seen(): void {
  fake.fire(container, 1, 600);
}

describe('2D graph entrance trigger', () => {
  it("'visible' holds the reveal at progress 0 until the container is seen", async () => {
    const graph = createGraph(container, spec());
    await run(0, 2000);
    expect(lastEntrance()?.t).toBe(0);
    expect(graph.entrancePlayed).toBe(false);
    const waitingK = graph.getCamera().k;

    seen();
    clock.pump(2050);
    // Played: the camera opens pulled back and the reveal ramps.
    expect(graph.entrancePlayed).toBe(true);
    expect(graph.getCamera().k).toBeLessThan(waitingK * 0.9);
    await run(2100, 3500);
    expect(lastEntrance()).toBeUndefined();
    expect(graph.getCamera().k).toBeCloseTo(waitingK, 5);
    graph.destroy();
  });

  it("'mount' plays at the first post-warmup tick without being seen", async () => {
    const graph = createGraph(container, spec({ trigger: 'mount' }));
    await Promise.resolve();
    clock.pump(0);
    expect(graph.entrancePlayed).toBe(true);
    const opening = graph.getCamera().k;
    await run(50, 1400);
    expect(lastEntrance()).toBeUndefined();
    expect(opening).toBeLessThan(graph.getCamera().k * 0.9);
    graph.destroy();
  });

  it('update() while waiting drops the reveal and draws at full alpha', async () => {
    const graph = createGraph(container, spec());
    await run(0, 500);
    expect(lastEntrance()?.t).toBe(0);

    graph.update(spec());
    clock.pump(550);
    expect(lastEntrance()).toBeUndefined();
    // Seeing it later replays nothing.
    seen();
    await run(600, 1000);
    expect(states.slice(-5).every((s) => s.entrance === undefined)).toBe(true);
    expect(fake.observed.size).toBe(0);
    graph.destroy();
  });

  it('a camera the reader moved while waiting is kept: only the reveal runs', async () => {
    const graph = createGraph(container, spec());
    await run(0, 500);
    graph.zoomToNode('a', { duration: 0, scale: 3 });
    clock.pump(550);
    const moved = graph.getCamera();

    seen();
    clock.pump(600);
    expect(graph.entrancePlayed).toBe(true);
    expect(graph.getCamera().k).toBeCloseTo(moved.k, 5);
    await run(650, 900);
    expect(lastEntrance()?.t).toBeGreaterThan(0);
    expect(graph.getCamera().k).toBeCloseTo(moved.k, 5);
    graph.destroy();
  });

  it('a spring enter phase lasts springDuration', async () => {
    const spring = { stiffness: 120, damping: 14 };
    const total = springDuration(spring);
    // Longer than the 500ms default, so a reveal still running past it is the spring's.
    expect(total).toBeGreaterThan(700);
    const graph = createGraph(container, spec({ trigger: 'mount', spring }));
    await Promise.resolve();
    clock.pump(0);
    clock.pump(600);
    expect(lastEntrance()?.t).toBeGreaterThan(0);
    expect(lastEntrance()?.t).toBeLessThan(1);
    clock.pump(total - 20);
    expect(lastEntrance()).toBeDefined();
    clock.pump(total + 20);
    clock.pump(total + 40);
    expect(lastEntrance()).toBeUndefined();
    graph.destroy();
  });

  it('suppressEntrance wins over the trigger: no wait, no reveal', async () => {
    const graph = createGraph(container, spec(), { suppressEntrance: true });
    await run(0, 200);
    expect(lastEntrance()).toBeUndefined();
    expect(graph.entrancePlayed).toBe(true);
    expect(fake.observed.size).toBe(0);
    graph.destroy();
  });
});

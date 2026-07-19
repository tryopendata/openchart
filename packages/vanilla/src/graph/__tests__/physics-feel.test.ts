/**
 * Phase 8 — physics feel: springy drag (alphaTarget on pin/unpin) and cursor
 * repulsion (pointer-driven toy force).
 *
 * happy-dom has no Worker, so every case here exercises the SYNC path. The sync
 * run loop batches ticks over rAF; a fake rAF driver pumps it deterministically.
 * With a positive alphaTarget d3's alpha converges toward that target (never
 * dropping below alphaMin), so the last delivered alpha reflects the request.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SimulationManager } from '../simulation';
import type { SimEdge, SimNode, WorkerSimulationConfig } from '../worker-protocol';

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

// A fake rAF driver so the sync tick loop runs synchronously and deterministically.
let rafQueue: FrameRequestCallback[] = [];

function pumpFrames(maxFrames = 2000): void {
  let frames = 0;
  while (rafQueue.length > 0 && frames < maxFrames) {
    const cbs = rafQueue;
    rafQueue = [];
    for (const cb of cbs) cb(0);
    frames++;
  }
}

/** Flush the deferred initial-delivery microtask, then drain the rAF loop. */
async function settle(): Promise<void> {
  await Promise.resolve();
  pumpFrames();
}

beforeEach(() => {
  rafQueue = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', (): void => {
    rafQueue = [];
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Springy drag: alphaTarget rides pin/unpin
// ---------------------------------------------------------------------------

describe('springy drag (sync path)', () => {
  it('pin with alphaTarget 0.3 holds the sim warm; unpin with 0 cools it', async () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let lastAlpha = 0;
    mgr.onTick((_pos, alpha) => {
      lastAlpha = alpha;
    });
    await settle();

    // Springy pin: alphaTarget 0.3. Draining converges alpha toward ~0.3.
    mgr.pinNode('a', 10, 10, 0.3);
    pumpFrames();
    expect(lastAlpha).toBeGreaterThan(0.25);
    expect(lastAlpha).toBeLessThan(0.35);

    // Springy release: alphaTarget 0. The sim cools back toward alphaMin.
    mgr.unpinNode('a', 0);
    pumpFrames();
    expect(lastAlpha).toBeLessThan(0.05);

    mgr.destroy();
  });

  it('legacy pin/unpin (no alphaTarget) never warms to a springy target', async () => {
    const { nodes, edges } = makeTriangle();
    const mgr = SimulationManager.create(nodes, edges, defaultConfig());

    let lastAlpha = 1;
    mgr.onTick((_pos, alpha) => {
      lastAlpha = alpha;
    });
    await settle();

    // A LEGACY pin (no alphaTarget) sets no alpha target: the sim decays. Even
    // after a legacy unpin (which reheats to 0.1 at most), it cools well below
    // the springy 0.3 hold.
    mgr.pinNode('a', 10, 10);
    pumpFrames();
    mgr.unpinNode('a');
    pumpFrames();

    expect(lastAlpha).toBeLessThan(0.1);

    mgr.destroy();
  });
});

// ---------------------------------------------------------------------------
// Springy message shape: legacy emissions must be byte-identical
// ---------------------------------------------------------------------------

describe('springy drag message shape (worker path)', () => {
  // Drive the WORKER branch by stubbing a Worker whose postMessage records
  // messages. This asserts the exact wire shape the mount emits.
  function withStubWorker(): { posted: unknown[]; restore: () => void } {
    const posted: unknown[] = [];
    class StubWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      postMessage(msg: unknown): void {
        posted.push(msg);
      }
      terminate(): void {}
    }
    const original = globalThis.Worker;
    vi.stubGlobal('Worker', StubWorker as unknown as typeof Worker);
    return {
      posted,
      restore: () => {
        vi.stubGlobal('Worker', original);
      },
    };
  }

  it('legacy pin/unpin post NO alphaTarget field (byte-identical to pre-springy)', () => {
    const stub = withStubWorker();
    try {
      const { nodes, edges } = makeTriangle();
      const mgr = SimulationManager.create(nodes, edges, defaultConfig());
      stub.posted.length = 0; // drop the init message

      mgr.pinNode('a', 1, 2);
      mgr.unpinNode('a');

      expect(stub.posted).toEqual([
        { type: 'pin', nodeId: 'a', x: 1, y: 2 },
        { type: 'unpin', nodeId: 'a' },
      ]);

      mgr.destroy();
    } finally {
      stub.restore();
    }
  });

  it('springy pin/unpin add the alphaTarget field', () => {
    const stub = withStubWorker();
    try {
      const { nodes, edges } = makeTriangle();
      const mgr = SimulationManager.create(nodes, edges, defaultConfig());
      stub.posted.length = 0;

      mgr.pinNode('a', 1, 2, 0.3);
      mgr.unpinNode('a', 0);

      expect(stub.posted).toEqual([
        { type: 'pin', nodeId: 'a', x: 1, y: 2, alphaTarget: 0.3 },
        { type: 'unpin', nodeId: 'a', alphaTarget: 0 },
      ]);

      mgr.destroy();
    } finally {
      stub.restore();
    }
  });
});

// ---------------------------------------------------------------------------
// Cursor repulsion: pointer-driven toy force
// ---------------------------------------------------------------------------

describe('cursor repulsion (sync path)', () => {
  // The only forces in play are the cursor force and the weak forceX/forceY
  // gravity toward origin (0.05). The pointer sits at the origin. A node INSIDE
  // the radius feels the strong (strength 30) outward push and moves AWAY from
  // the origin (x grows). A node OUTSIDE the radius never feels the cursor at
  // all, so only gravity acts and it drifts TOWARD the origin (x shrinks). The
  // opposite signs of motion are a clean radius-membership signal.
  async function runNear(activate: boolean): Promise<Map<string, number>> {
    const nodes: SimNode[] = [
      { id: 'near', radius: 5, x: 5, y: 0 }, // inside the 80px radius
      { id: 'far', radius: 5, x: 200, y: 0 }, // outside the 80px radius
    ];
    const config = defaultConfig({
      chargeStrength: 0,
      centerForce: false,
      cursorRepulsion: { radius: 80, strength: 30 },
    });
    const mgr = SimulationManager.create(nodes, [], config);
    const xs = new Map<string, number>();
    mgr.onTick((pos) => {
      for (const p of pos) xs.set(p.id, p.x);
    });
    await Promise.resolve();
    if (activate) mgr.setPointer(0, 0, true);
    // A couple of frames is enough to see direction of motion; going to full
    // settle would let gravity drag everything to the origin.
    pumpFrames(2);
    mgr.destroy();
    return xs;
  }

  it('an active pointer displaces only nodes within radius', async () => {
    const withCursor = await runNear(true);

    // 'near' (inside 80px radius) is pushed AWAY from the pointer at the origin:
    // its x grows past its start of 5.
    expect(withCursor.get('near')!).toBeGreaterThan(5);
    // 'far' (outside the radius) never feels the cursor force — only the weak
    // gravity toward origin — so its x moves the OTHER way (shrinks below 200).
    // Opposite signs of motion prove the cursor force respects the radius.
    expect(withCursor.get('far')!).toBeLessThan(200);
  });

  it('deactivating the pointer removes the force (matches baseline)', async () => {
    // Held active the whole run vs activated-then-deactivated. With the force
    // switched off partway, 'near' is pushed out less than when held active.
    const held = (await runNear(true)).get('near')!;

    const nodes: SimNode[] = [{ id: 'near', radius: 5, x: 5, y: 0 }];
    const config = defaultConfig({
      chargeStrength: 0,
      centerForce: false,
      cursorRepulsion: { radius: 80, strength: 30 },
    });
    const mgr = SimulationManager.create(nodes, [], config);
    let lastX = 5;
    mgr.onTick((pos) => {
      lastX = pos[0].x;
    });
    await Promise.resolve();
    // Activate for one batch of frames, then deactivate for the rest.
    mgr.setPointer(0, 0, true);
    pumpFrames(1);
    mgr.setPointer(0, 0, false);
    pumpFrames();
    mgr.destroy();

    // The force pushed 'near' out while active, but switching it off stops the
    // outward drive — it ends up less far out than the held-active run.
    expect(lastX).toBeGreaterThan(5);
    expect(lastX).toBeLessThan(held);
  });

  it('with no cursorRepulsion config, setPointer is a true no-op', async () => {
    const run = async (activate: boolean): Promise<number> => {
      const nodes: SimNode[] = [{ id: 'n', radius: 5, x: 5, y: 0 }];
      // No cursorRepulsion → radius 0 → setPointer bails, sim isn't warmed.
      const config = defaultConfig({ chargeStrength: 0, centerForce: false });
      const mgr = SimulationManager.create(nodes, [], config);
      let lastX = 5;
      mgr.onTick((pos) => {
        lastX = pos[0].x;
      });
      await Promise.resolve();
      if (activate) mgr.setPointer(0, 0, true);
      pumpFrames();
      mgr.destroy();
      return lastX;
    };

    // Activating vs not must be identical: the pointer feed does nothing when no
    // cursor force is configured.
    expect(await run(true)).toBeCloseTo(await run(false), 6);
  });
});

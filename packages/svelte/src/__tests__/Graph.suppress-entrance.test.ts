/**
 * Svelte Graph wrapper: a theme recreation suppresses the entrance only when
 * the previous instance's entrance played.
 *
 * Renders the real vanilla graph. Whether the entrance played is read off the
 * public camera (see `playsEntrance`); rAF and performance.now run on a manual
 * frame clock.
 */

import type { GraphSpec } from '@opendata-ai/openchart-core';
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type FrameClock,
  installFrameClock,
  playsEntrance,
  playsEntranceOnSeen,
} from '../../../vanilla/src/__test-fixtures__/graph-frame-clock';
import { createFakeObserver } from '../../../vanilla/src/__test-fixtures__/visibility';
import { setObserverFactory } from '../../../vanilla/src/visibility';
import Graph from '../Graph.svelte';

// Warmed so the first delivered tick is near-settled and starts the entrance.
// The setup's global getBoundingClientRect stub gives happy-dom a layout, so a
// 'visible' entrance would wait on an IntersectionObserver that never fires.
const spec: GraphSpec = {
  type: 'graph',
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ],
  layout: { type: 'force', warmup: 30 },
  animation: { enter: { trigger: 'mount' } },
};

type Api = { getCamera: () => { k: number } };

let clock: FrameClock;

beforeEach(() => {
  clock = installFrameClock();
});

afterEach(() => {
  cleanup();
  clock.restore();
  setObserverFactory(null);
});

async function renderGraph(props: Record<string, unknown>) {
  const result = render(Graph, { props });
  await waitFor(() => expect(result.container.querySelector('canvas')).not.toBeNull());
  return result;
}

async function recreateDark(result: Awaited<ReturnType<typeof renderGraph>>): Promise<void> {
  await result.rerender({ darkMode: 'force' });
  await waitFor(() =>
    expect(result.container.querySelector('.oc-graph-wrapper')?.classList.contains('oc-dark')).toBe(
      true,
    ),
  );
}

describe('Graph suppressEntrance', () => {
  it('a theme change after the entrance played recreates without replaying it', async () => {
    const result = await renderGraph({ spec, darkMode: 'off' });
    const api = result.component as unknown as Api;
    expect(await playsEntrance(clock, () => api.getCamera().k)).toBe(true);

    await recreateDark(result);
    expect(await playsEntrance(clock, () => api.getCamera().k, 2000)).toBe(false);
  });

  it('a theme change while the entrance still waits to be seen replays it on the new graph', async () => {
    // Default trigger ('visible'), held by a fake observer the test drives.
    const observer = createFakeObserver();
    setObserverFactory(observer.factory);
    const result = await renderGraph({ spec: { ...spec, animation: undefined }, darkMode: 'off' });
    const api = result.component as unknown as Api;
    await Promise.resolve();
    clock.pump(0);
    // Armed and unseen.
    expect(observer.observed.size).toBe(1);

    await recreateDark(result);
    expect(await playsEntranceOnSeen(clock, observer, () => api.getCamera().k, 100)).toBe(true);
  });
});

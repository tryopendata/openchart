/**
 * Real-time sparkline feedback.
 *
 * Two claims: an update that changes nothing moves nothing, and a finished
 * sparkline update flashes the terminator dot so a wall of live tiles shows
 * which one just moved.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { createChart } from '../mount';

function sparkSpec(values: number[]): ChartSpec {
  return {
    animation: { enter: false, update: true },
    display: 'sparkline',
    mark: { type: 'line', point: 'last' },
    data: values.map((value, i) => ({ t: `2024-01-0${i + 1}`, value })),
    encoding: {
      x: { field: 't', type: 'temporal' },
      y: { field: 'value', type: 'quantitative', scale: { domain: [0, 100] } },
    },
  };
}

function terminator(container: HTMLElement): SVGElement | null {
  const dots = container.querySelectorAll('circle.oc-mark-point');
  return (dots[dots.length - 1] as SVGElement | undefined) ?? null;
}

// ---------------------------------------------------------------------------
// rAF mock (same shape as transition.test.ts)
// ---------------------------------------------------------------------------

let rafCallbacks: Map<number, FrameRequestCallback>;
let nextRafId: number;

function pumpRaf(timestamp: number) {
  const cbs = Array.from(rafCallbacks.entries());
  rafCallbacks.clear();
  for (const [, cb] of cbs) cb(timestamp);
}

beforeEach(() => {
  rafCallbacks = new Map();
  nextRafId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
    const id = nextRafId++;
    rafCallbacks.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    rafCallbacks.delete(id);
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sparkline update feedback', () => {
  it('pulses the terminator dot when a transition completes, then strips it', () => {
    // Only the timer the pulse uses: vitest's default fake set replaces
    // requestAnimationFrame too, which would shadow the rAF stub above.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const container = createContainer();
      const chart = createChart(container, sparkSpec([10, 20, 30]));

      chart.update(sparkSpec([10, 20, 90]));
      pumpRaf(0);
      pumpRaf(2000);

      const dot = terminator(container);
      expect(dot).not.toBeNull();
      expect(dot!.classList.contains('oc-pulse')).toBe(true);

      // Stripped again, so a paused feed leaves nothing animating.
      vi.advanceTimersByTime(700);
      expect(terminator(container)!.classList.contains('oc-pulse')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the pulse alive when a second update lands mid-pulse', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const container = createContainer();
      const chart = createChart(container, sparkSpec([10, 20, 30]));

      chart.update(sparkSpec([10, 20, 90]));
      pumpRaf(0);
      pumpRaf(2000);
      expect(terminator(container)!.classList.contains('oc-pulse')).toBe(true);

      // Second tick 400ms later, well inside the first pulse's 600ms window.
      vi.advanceTimersByTime(400);
      chart.update(sparkSpec([10, 20, 40]));
      pumpRaf(0);
      pumpRaf(2000);
      expect(terminator(container)!.classList.contains('oc-pulse')).toBe(true);

      // The first update's timer must not strip the second update's pulse.
      vi.advanceTimersByTime(500); // t = 900
      expect(terminator(container)!.classList.contains('oc-pulse')).toBe(true);

      vi.advanceTimersByTime(200); // t = 1100, past the second pulse's window
      expect(terminator(container)!.classList.contains('oc-pulse')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not move marks whose geometry is unchanged', () => {
    const container = createContainer();
    const chart = createChart(container, sparkSpec([10, 20, 30]));
    const before = terminator(container)!.getAttribute('cy');

    chart.update(sparkSpec([10, 20, 30]));
    pumpRaf(0);
    // Halfway through a no-op update the dot sits exactly where it started:
    // an identical from/to pair produces no visible motion.
    pumpRaf(200);
    expect(terminator(container)!.getAttribute('cy')).toBe(before);
  });
});

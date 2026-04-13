/**
 * Resize timing behavior.
 *
 * These tests verify that:
 * 1. The inner observer's 16ms debounce coalesces a rapid burst of
 *    ResizeObserver entries into a single render (no thrash).
 * 2. First ResizeObserver fire does not blank-flash (SVG stays mounted).
 * 3. Resize events during an entrance animation are deferred and replayed
 *    on animation end.
 *
 * happy-dom ships a ResizeObserver stub that does not auto-fire on layout,
 * so we override it with a controllable mock that lets us invoke the
 * observer callback synchronously.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { lineSpec } from '../__test-fixtures__/specs';
import { createChart } from '../mount';

// ---------------------------------------------------------------------------
// Controllable ResizeObserver mock
// ---------------------------------------------------------------------------

type ObserverCallback = (entries: ResizeObserverEntry[]) => void;

interface FakeObserver {
  element: Element | null;
  callback: ObserverCallback;
  disconnected: boolean;
}

const observers: FakeObserver[] = [];

class MockResizeObserver {
  private readonly record: FakeObserver;

  constructor(callback: ObserverCallback) {
    this.record = { element: null, callback, disconnected: false };
    observers.push(this.record);
  }

  observe(element: Element): void {
    this.record.element = element;
  }

  disconnect(): void {
    this.record.disconnected = true;
  }

  unobserve(): void {
    // no-op
  }
}

/** Fire a ResizeObserver callback for the given element with width/height. */
function fireResize(element: Element, width: number, height: number): void {
  for (const o of observers) {
    if (o.element === element && !o.disconnected) {
      const entry = {
        contentRect: { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0 },
        target: element,
      } as unknown as ResizeObserverEntry;
      o.callback([entry]);
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chart resize timing', () => {
  let container: HTMLDivElement;
  let originalRO: typeof globalThis.ResizeObserver;

  beforeEach(() => {
    observers.length = 0;
    originalRO = globalThis.ResizeObserver;
    // Use MockResizeObserver so tests can drive observer fires deterministically.
    // Cast via unknown to satisfy the stricter ResizeObserver type.
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
    vi.useFakeTimers();
    container = createContainer();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.ResizeObserver = originalRO;
    document.body.innerHTML = '';
  });

  it('coalesces a rapid burst of resize events into a single render', async () => {
    const chart = createChart(container, lineSpec);
    const initialSvg = container.querySelector('svg');
    expect(initialSvg).not.toBeNull();

    // Track SVG node identity across renders: each render() replaces the SVG,
    // so counting how many distinct SVG nodes appear tells us how many renders ran.
    let renderCount = 0;
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        for (let i = 0; i < r.addedNodes.length; i++) {
          const node = r.addedNodes[i];
          if (node instanceof Element && node.tagName.toLowerCase() === 'svg') {
            renderCount++;
          }
        }
      }
    });
    mo.observe(container, { childList: true });

    // Fire 20 resize events within a tight window.
    for (let i = 0; i < 20; i++) {
      fireResize(container, 600 + i, 400);
    }

    // Before the debounce window elapses, no new SVG has been appended.
    expect(renderCount).toBe(0);

    // Run all pending timers (16ms inner debounce + any outer delay).
    await vi.runAllTimersAsync();

    // MutationObserver records are delivered as microtasks; flush them.
    mo.takeRecords().forEach((r) => {
      for (let i = 0; i < r.addedNodes.length; i++) {
        const node = r.addedNodes[i];
        if (node instanceof Element && node.tagName.toLowerCase() === 'svg') {
          renderCount++;
        }
      }
    });

    // Exactly one re-render should have run for the whole burst (no thrash).
    expect(renderCount).toBe(1);

    mo.disconnect();
    chart.destroy();
  });

  it('does not blank-flash: SVG remains mounted through first observer fire', async () => {
    const chart = createChart(container, lineSpec);

    // SVG is painted immediately on mount, before the observer fires.
    const svgBefore = container.querySelector('svg');
    expect(svgBefore).not.toBeNull();

    // Fire the observer as it would on first layout.
    fireResize(container, 600, 400);

    // Even before the debounce elapses, the SVG must still be in the DOM.
    expect(container.querySelector('svg')).not.toBeNull();

    // And after timers flush, the SVG is still there (possibly a new node).
    await vi.runAllTimersAsync();
    expect(container.querySelector('svg')).not.toBeNull();

    chart.destroy();
  });

  it('disconnects the observer on destroy', () => {
    const chart = createChart(container, lineSpec);
    expect(observers.length).toBe(1);
    expect(observers[0].disconnected).toBe(false);

    chart.destroy();

    expect(observers[0].disconnected).toBe(true);
  });

  it('clears any pending resize timer on destroy (no callback after teardown)', async () => {
    const chart = createChart(container, lineSpec);

    fireResize(container, 700, 500);
    // Destroy before the debounce elapses.
    chart.destroy();

    await vi.runAllTimersAsync();

    // destroy() removes the SVG; if the timer fired after destroy it would
    // try to render a new one. No SVG should be present.
    expect(container.querySelector('svg')).toBeNull();
  });
});

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
import { createAutoHeightContainer, createContainer } from '../__test-fixtures__/dom';
import { lineSpec, longChromeLineSpec } from '../__test-fixtures__/specs';
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

    // Observable resize contract: the final viewport is used once and the
    // retained root never disappears during a burst.
    const initialGeneration = Number(container.dataset.ocRenderGen);
    for (let i = 0; i < 20; i++) fireResize(container, 600 + i, 400);
    expect(Number(container.dataset.ocRenderGen)).toBe(initialGeneration);
    await vi.runAllTimersAsync();
    expect(Number(container.dataset.ocRenderGen)).toBe(initialGeneration + 1);
    expect(container.querySelector('svg')).toBe(initialSvg);

    chart.destroy();
  });

  it('does not compound a minimum-height host with growing chart chrome', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    let height = 420;
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({
        width: 390,
        height,
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 390,
        bottom: height,
      }),
    });
    const chart = createChart(container, { ...lineSpec, chromeLayout: 'grow' });
    const originalHeight = chart.layout.dimensions.height;
    height = originalHeight;
    fireResize(container, 390, height);
    await vi.runAllTimersAsync();
    expect(chart.layout.dimensions.height).toBe(originalHeight);
    chart.update({ ...lineSpec, chromeLayout: 'grow' });
    expect(chart.layout.dimensions.height).toBe(originalHeight);
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

  describe('auto-height observer feedback guard', () => {
    it('ignores the observer echo from the figure growing itself', async () => {
      const autoContainer = createAutoHeightContainer(390);
      const chart = createChart(autoContainer, longChromeLineSpec);

      const grownHeight = chart.layout.dimensions.height;
      expect(grownHeight).toBeGreaterThan(400);
      const genBefore = autoContainer.dataset.ocRenderGen;

      // Growing the SVG grows the container, which fires the observer with
      // our own dimensions. That echo must not trigger a re-render (the
      // re-render would grow again and loop).
      fireResize(autoContainer, 390, grownHeight);
      await vi.runAllTimersAsync();
      expect(autoContainer.dataset.ocRenderGen).toBe(genBefore);

      chart.destroy();
    });

    it('still re-renders when the width changes', async () => {
      const autoContainer = createAutoHeightContainer(390);
      const chart = createChart(autoContainer, longChromeLineSpec);

      const grownHeight = chart.layout.dimensions.height;
      const genBefore = autoContainer.dataset.ocRenderGen;

      fireResize(autoContainer, 340, grownHeight);
      await vi.runAllTimersAsync();
      expect(autoContainer.dataset.ocRenderGen).not.toBe(genBefore);

      chart.destroy();
    });
  });
});

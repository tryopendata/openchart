/**
 * Canvas mark mode: the DOM contract, and the guarantee that SVG mode is
 * byte-for-byte unchanged.
 *
 * The regression guard here is as important as the canvas assertions: canvas
 * mode is opt-in, so any DOM difference in a chart that never asked for it is
 * a bug.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { computeAnimationDuration } from '../animation';
import { createChart } from '../mount';
import { type CanvasStub, stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';

let stub: CanvasStub;

beforeEach(() => {
  stub = stubCanvas2D();
});

afterEach(() => {
  stub.restore();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

/** A scatter spec with `n` points, rendered on canvas or SVG. */
function scatterSpec(n: number, render?: 'canvas' | 'svg'): ChartSpec {
  return {
    mark: render ? { type: 'point', render } : 'point',
    data: Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      x: i,
      y: (i * 7) % 100,
    })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      key: { field: 'id', type: 'nominal' },
    },
  };
}

// These suites compile and mount charts with thousands of points, so individual
// tests legitimately run past a second. Vitest's 5s default sits close enough to
// that to flake when the rest of the suite is saturating the machine -- and a
// timeout here would read as a canvas bug rather than a busy runner.
vi.setConfig({ testTimeout: 20_000 });

describe('canvas mark mode DOM contract', () => {
  it('renders a canvas and suppresses the SVG point/background/gridline output', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
    });

    const canvas = container.querySelector('canvas.oc-mark-canvas');
    expect(canvas).not.toBeNull();
    expect(canvas!.getAttribute('aria-hidden')).toBe('true');

    const svg = container.querySelector('svg') as SVGElement;
    // Points live on the canvas, not the SVG.
    expect(svg.querySelectorAll('circle.oc-mark-point').length).toBe(0);
    // The canvas paints the background full-bleed, so the SVG must not cover it.
    expect(svg.querySelector('rect[fill]')).toBeNull();
    // Gridlines move to the canvas; ticks and labels stay in the SVG.
    expect(svg.querySelectorAll('.oc-gridline').length).toBe(0);
    expect(svg.querySelectorAll('.oc-axis').length).toBeGreaterThan(0);

    chart.destroy();
  });

  it('puts the canvas before the SVG in DOM order and positions both', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
    });

    const canvas = container.querySelector('canvas.oc-mark-canvas') as HTMLCanvasElement;
    const svg = container.querySelector('svg') as SVGElement;

    // Canvas earlier in document order => painted underneath...
    expect(canvas.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // ...but only because both are positioned. A static SVG would lose to the
    // absolutely-positioned canvas regardless of order.
    expect(canvas.style.position).toBe('absolute');
    expect((svg as SVGElement & ElementCSSInlineStyle).style.position).toBe('relative');

    chart.destroy();
  });

  it('lets pointer events through to the canvas while keeping chrome interactive', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
      chrome: { title: 'Canvas scatter' },
    });

    const svg = container.querySelector('svg') as SVGElement & ElementCSSInlineStyle;
    expect(svg.style.pointerEvents).toBe('none');

    const chrome = svg.querySelector('.oc-chrome') as SVGElement & ElementCSSInlineStyle;
    expect(chrome).not.toBeNull();
    expect(chrome.style.pointerEvents).toBe('auto');

    chart.destroy();
  });

  it('keeps the chart accessible: SVG retains role and label, canvas is hidden', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
    });

    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('role')).toBeTruthy();
    expect(svg.getAttribute('aria-label')).toBeTruthy();

    chart.destroy();
  });

  it('removes the canvas on destroy', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
    });
    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();

    chart.destroy();
    expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();
  });

  it('does not leak a second canvas across re-renders', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20, 'canvas'), {
      width: 600,
      height: 400,
    });

    chart.update(scatterSpec(25, 'canvas'));
    expect(container.querySelectorAll('canvas.oc-mark-canvas').length).toBe(1);

    chart.destroy();
  });
});

describe('canvas entrance completion clock', () => {
  // The DOM-counting estimate in computeAnimationDuration sees no point
  // elements in canvas mode, so without an explicit override the cleanup timer
  // fires roughly a second into a ~2.2s entrance. Everything downstream of
  // that timer then misbehaves: cleanupAnimations is nulled, a deferred resize
  // replays into a teardown, and update() slips past the entrance-in-flight
  // gate while the canvas tween is still writing alpha.
  //
  // A t=0 probe passes trivially and would miss all of it, so probe MID-WINDOW.
  it('keeps the entrance in flight well past the DOM-derived estimate', () => {
    vi.useFakeTimers();
    try {
      const container = createContainer();
      const chart = createChart(
        container,
        { ...scatterSpec(4000, 'canvas'), animation: true },
        {
          width: 600,
          height: 400,
        },
      );

      const svg = container.querySelector('svg') as SVGElement;
      // The naive estimate is what the timer WOULD have used.
      const naive = computeAnimationDuration(svg);

      // 1.5s in: past the naive estimate, still inside the real entrance.
      vi.advanceTimersByTime(1500);
      expect(naive).toBeLessThan(1500);
      // Still animating => oc-animate not yet removed.
      expect(svg.classList.contains('oc-animate')).toBe(true);

      chart.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does eventually clear the entrance', () => {
    vi.useFakeTimers();
    try {
      const container = createContainer();
      const chart = createChart(
        container,
        { ...scatterSpec(4000, 'canvas'), animation: true },
        {
          width: 600,
          height: 400,
        },
      );
      const svg = container.querySelector('svg') as SVGElement;

      // Past the clamped stagger budget (2s) + fade + annotation delay + buffer.
      vi.advanceTimersByTime(5000);
      expect(svg.classList.contains('oc-animate')).toBe(false);

      chart.destroy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SVG mode is unchanged (regression guard)', () => {
  it('emits no canvas and a full SVG when render is unset', () => {
    const container = createContainer();
    const chart = createChart(container, scatterSpec(20), { width: 600, height: 400 });

    expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();

    const svg = container.querySelector('svg') as SVGElement & ElementCSSInlineStyle;
    expect(svg.querySelectorAll('circle.oc-mark-point').length).toBeGreaterThan(0);
    expect(svg.querySelectorAll('.oc-gridline').length).toBeGreaterThan(0);
    // No pointer-events or position overrides in SVG mode.
    expect(svg.style.pointerEvents).toBe('');
    expect(svg.style.position).toBe('');

    chart.destroy();
  });

  it('produces an identical DOM signature with render unset vs render:"svg"', () => {
    const containerA = createContainer();
    const chartA = createChart(containerA, scatterSpec(20), { width: 600, height: 400 });
    const a = (containerA.querySelector('svg') as SVGElement).innerHTML;

    const containerB = createContainer();
    const chartB = createChart(containerB, scatterSpec(20, 'svg'), { width: 600, height: 400 });
    const b = (containerB.querySelector('svg') as SVGElement).innerHTML;

    // Generated ids (clip paths, gradients) use a monotonic counter, so
    // normalize them before comparing.
    const normalize = (s: string) => s.replace(/oc-(clip|grad|pattern)-\d+/g, 'oc-$1-N');
    expect(normalize(a)).toBe(normalize(b));

    chartA.destroy();
    chartB.destroy();
  });

  it('stays on SVG below the auto threshold', () => {
    // The regression that matters most: auto promotion must not reach down and
    // change how an ordinary small scatter renders.
    const container = createContainer();
    const chart = createChart(container, scatterSpec(500), { width: 600, height: 400 });

    expect(container.querySelector('canvas.oc-mark-canvas')).toBeNull();
    expect(
      (container.querySelector('svg') as SVGElement).querySelectorAll('circle.oc-mark-point')
        .length,
    ).toBeGreaterThan(0);

    chart.destroy();
  });

  it('promotes to canvas above the auto threshold with no render field set', () => {
    // The blog-morph configuration: `mark: 'point'`, nothing else asked for.
    const container = createContainer();
    const chart = createChart(container, scatterSpec(1500), { width: 600, height: 400 });

    expect(container.querySelector('canvas.oc-mark-canvas')).not.toBeNull();
    expect(
      (container.querySelector('svg') as SVGElement).querySelectorAll('circle.oc-mark-point')
        .length,
    ).toBe(0);

    chart.destroy();
  });
});

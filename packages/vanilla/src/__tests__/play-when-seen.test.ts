/**
 * Play-when-seen (RFC D13) across the mounts: an entrance holds its paused
 * from-state until the container scrolls into view, and only then starts
 * playback and the cleanup clock.
 *
 * happy-dom's IntersectionObserver never fires, so every test injects a fake
 * observer and stubs the page layout (visibility.ts plays at once without one).
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { columnSpec, makeTableSpec } from '../__test-fixtures__/specs';
import { createFakeObserver, stubPageLayout } from '../__test-fixtures__/visibility';
import { createBarList } from '../barlist-mount';
import { createChart } from '../mount';
import { createSankey } from '../sankey-mount';
import { type CanvasStub, stubCanvas2D } from '../scatter-canvas/__tests__/canvas-stub';
import { createTable } from '../table-mount';
import { createTileMap } from '../tilemap-mount';
import { observedCount, setObserverFactory } from '../visibility';

let fake: ReturnType<typeof createFakeObserver>;
let layout: ReturnType<typeof stubPageLayout>;

beforeEach(() => {
  vi.useFakeTimers();
  fake = createFakeObserver();
  setObserverFactory(fake.factory);
  layout = stubPageLayout();
});

afterEach(() => {
  setObserverFactory(null);
  layout.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const animated = { ...columnSpec, animation: true } as ChartSpec;
const playState = (el: Element | null) =>
  (el as (Element & ElementCSSInlineStyle) | null)?.style.getPropertyValue('--oc-play-state');

describe('createChart', () => {
  it('holds the entrance paused, with no cleanup clock, until seen', () => {
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });
    const svg = container.querySelector('svg.oc-chart') as SVGElement;

    expect(svg.classList.contains('oc-animate')).toBe(true);
    expect(playState(svg)).toBe('paused');
    expect(fake.observed.has(container)).toBe(true);
    // No cleanup timer was started: the entrance never completes while unseen.
    vi.advanceTimersByTime(60_000);
    expect(svg.classList.contains('oc-animate')).toBe(true);

    chart.destroy();
  });

  it('plays and cleans up once seen', () => {
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });
    const svg = container.querySelector('svg.oc-chart') as SVGElement;

    fake.fire(container, 0.5, 200);
    expect(playState(svg)).toBe('');
    expect(svg.classList.contains('oc-animate')).toBe(true);
    expect(observedCount()).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(svg.classList.contains('oc-animate')).toBe(false);
    chart.destroy();
  });

  it('defers resizes only once the entrance is playing', () => {
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });
    const gen = () => Number(container.dataset.ocRenderGen);
    expect(gen()).toBe(1);

    // Waiting: re-render now, and re-arm the paused entrance on the new SVG.
    chart.resize();
    expect(gen()).toBe(2);
    const rearmed = container.querySelector('svg.oc-chart') as SVGElement;
    expect(rearmed.classList.contains('oc-animate')).toBe(true);
    expect(playState(rearmed)).toBe('paused');
    expect(observedCount()).toBe(1);

    // Playing: the resize waits for the entrance to finish.
    fake.fire(container, 1, 400);
    chart.resize();
    expect(gen()).toBe(2);
    vi.advanceTimersByTime(10_000);
    expect(gen()).toBe(3);

    chart.destroy();
  });

  it('re-arms the waiting entrance on update, so the new data enters when seen', () => {
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });

    chart.update({ ...animated, data: [{ category: 'Solo', revenue: 1 }] } as ChartSpec);
    const svg = container.querySelector('svg.oc-chart') as SVGElement;
    expect(svg.classList.contains('oc-animate')).toBe(true);
    expect(playState(svg)).toBe('paused');
    expect(observedCount()).toBe(1);

    chart.destroy();
  });

  it('unsubscribes on destroy while waiting', () => {
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });
    expect(observedCount()).toBe(1);
    chart.destroy();
    expect(observedCount()).toBe(0);
    expect(fake.observed.size).toBe(0);
  });

  it('does not leak an observed node across a StrictMode double mount', () => {
    const container = createContainer();
    createChart(container, animated, { autoResize: false }).destroy();
    const chart = createChart(container, animated, { autoResize: false });
    expect(observedCount()).toBe(1);
    chart.destroy();
    expect(observedCount()).toBe(0);
  });

  it("plays at once with trigger: 'mount'", () => {
    const container = createContainer();
    const chart = createChart(
      container,
      { ...columnSpec, animation: { enter: { trigger: 'mount' } } } as ChartSpec,
      { autoResize: false },
    );
    const svg = container.querySelector('svg.oc-chart') as SVGElement;
    expect(playState(svg)).toBe('');
    expect(observedCount()).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(svg.classList.contains('oc-animate')).toBe(false);
    chart.destroy();
  });

  it('neither waits nor opens an entrance window under reduced motion', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const container = createContainer();
    const chart = createChart(container, animated, { autoResize: false });
    const svg = container.querySelector('svg.oc-chart') as SVGElement;
    expect(playState(svg)).toBe('');
    expect(observedCount()).toBe(0);
    // Complete at once: a resize is not deferred.
    chart.resize();
    expect(container.dataset.ocRenderGen).toBe('2');
    chart.destroy();
  });

  it('publishes fonts-state ready while still waiting', async () => {
    let resolveFonts!: () => void;
    const loaded = new Promise<void>((r) => {
      resolveFonts = r;
    });
    const fonts = {
      check: () => false,
      load: () => loaded.then(() => []),
      ready: loaded,
      status: 'loading',
    };
    Object.defineProperty(document, 'fonts', { value: fonts, configurable: true });
    try {
      const container = createContainer();
      const chart = createChart(container, animated, { autoResize: false });
      expect(container.dataset.ocFontsState).toBe('pending');
      resolveFonts();
      await vi.runAllTimersAsync();
      expect(container.dataset.ocFontsState).toBe('ready');
      const svg = container.querySelector('svg.oc-chart') as SVGElement;
      expect(playState(svg)).toBe('paused');
      expect(svg.classList.contains('oc-animate')).toBe(true);
      chart.destroy();
    } finally {
      Reflect.deleteProperty(document, 'fonts');
    }
  });
});

describe('canvas scatter', () => {
  let stub: CanvasStub;
  beforeEach(() => {
    stub = stubCanvas2D();
  });
  afterEach(() => stub.restore());

  const scatter = (n: number): ChartSpec => ({
    mark: 'point',
    animation: true,
    data: Array.from({ length: n }, (_, i) => ({ id: `p${i}`, x: i, y: (i * 7) % 100 })),
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
      key: { field: 'id', type: 'nominal' },
    },
  });

  /** Point fills in the most recent paint (after its clearRect). */
  const fillsInLastPaint = () => {
    const last = stub.calls.map((c) => c.method).lastIndexOf('clearRect');
    return stub.calls.slice(last).filter((c) => c.method === 'fill').length;
  };

  it('holds points transparent and starts no entrance until seen', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const container = createContainer();
    const chart = createChart(container, scatter(50), { autoResize: false, renderer: 'canvas' });

    expect(fillsInLastPaint()).toBe(0);
    expect(frames.length).toBe(0); // no entrance tween scheduled
    vi.advanceTimersByTime(60_000);
    expect(container.querySelector('svg')!.classList.contains('oc-animate')).toBe(true);

    fake.fire(container, 1, 400);
    expect(frames.length).toBeGreaterThan(0); // the entrance started
    chart.destroy();
  });
});

describe('other mounts', () => {
  const cases: Array<[string, (c: HTMLElement) => { destroy(): void }, string]> = [
    [
      'table',
      (c) => createTable(c, makeTableSpec({ animation: true }), { autoResize: false }),
      '.oc-table-wrapper',
    ],
    [
      'barlist',
      (c) =>
        createBarList(
          c,
          {
            type: 'barlist',
            animation: true,
            data: [
              { name: 'A', value: 4 },
              { name: 'B', value: 9 },
            ],
            encoding: {
              label: { field: 'name', type: 'nominal' },
              value: { field: 'value', type: 'quantitative' },
            },
          },
          { autoResize: false },
        ),
      'svg',
    ],
    [
      'tilemap',
      (c) =>
        createTileMap(
          c,
          { type: 'tilemap', animation: true, data: { CA: 5, TX: 4, NY: 3 } },
          { autoResize: false },
        ),
      'svg',
    ],
    [
      'sankey',
      (c) =>
        createSankey(
          c,
          {
            type: 'sankey',
            animation: true,
            data: [
              { from: 'A', to: 'C', amount: 10 },
              { from: 'B', to: 'C', amount: 20 },
            ],
            encoding: {
              source: { field: 'from', type: 'nominal' },
              target: { field: 'to', type: 'nominal' },
              value: { field: 'amount', type: 'quantitative' },
            },
          },
          { autoResize: false },
        ),
      'svg',
    ],
  ];

  it.each(cases)('%s holds paused until seen, then plays and cleans up', (_, mount, rootSel) => {
    const container = createContainer();
    const instance = mount(container);
    const root = () => container.querySelector(rootSel) as Element;
    expect(root().classList.contains('oc-animate')).toBe(true);
    expect(playState(root())).toBe('paused');
    vi.advanceTimersByTime(60_000);
    expect(root().classList.contains('oc-animate')).toBe(true);

    fake.fire(container, 1, 400);
    expect(playState(root())).toBe('');
    vi.advanceTimersByTime(10_000);
    expect(root().classList.contains('oc-animate')).toBe(false);
    instance.destroy();
  });

  it.each(cases)('%s unsubscribes on destroy while waiting', (_, mount) => {
    const container = createContainer();
    mount(container).destroy();
    expect(observedCount()).toBe(0);
  });
});

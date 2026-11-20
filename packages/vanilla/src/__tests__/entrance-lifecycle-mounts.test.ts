/**
 * Entrance lifecycle contracts, per mount (Seam A, U2a). Every SVG/DOM mount
 * drives its entrance through one `createEntranceLifecycle`, so each must:
 *
 * - re-arm a waiting entrance on the new root when a resize or an update
 *   re-renders it (the data a fetch delivers enters when seen);
 * - not arm on a render with nothing to show, and arm on the first that has;
 * - keep a waiting entrance owed across an update that empties the chart;
 * - snap an update while the entrance plays;
 * - defer a resize while the entrance plays and replay it once afterwards;
 * - cancel the entrance (observer and clock) on destroy;
 * - open no entrance window under reduced motion;
 * - export a settled scene with no entrance stamps, and a GIF that keeps its
 *   own entrance timing whatever the live cascade says.
 *
 * happy-dom's IntersectionObserver never fires, so the tests inject a fake
 * observer and stub the page layout (visibility.ts plays at once without one).
 */

import { type ChartSpec, CSS_TOKENS, resolveTheme } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { makeTableSpec } from '../__test-fixtures__/specs';
import { createFakeObserver, stubPageLayout } from '../__test-fixtures__/visibility';
import { createBarList } from '../barlist-mount';
import { exportGIF } from '../export-gif';
import { createGeoMap } from '../map-mount';
import { createChart } from '../mount';
import { createSankey } from '../sankey-mount';
import { createTable } from '../table-mount';
import { createTileMap } from '../tilemap-mount';
import { setObserverFactory } from '../visibility';

// Capture the SVG each raster export receives (happy-dom can't rasterize).
const rasterized: SVGElement[] = [];
vi.mock('../export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../export')>();
  return {
    ...actual,
    exportPNG: (svg: SVGElement) => {
      rasterized.push(svg);
      return Promise.resolve(new Blob());
    },
  };
});

// The GIF encoder is an optional peer: what matters here is the SVG handed to it.
vi.mock('../export-gif', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../export-gif')>();
  return { ...actual, exportGIF: vi.fn(() => Promise.resolve(new Blob())) };
});

let fake: ReturnType<typeof createFakeObserver>;
let layout: ReturnType<typeof stubPageLayout>;

beforeEach(() => {
  vi.useFakeTimers();
  fake = createFakeObserver();
  setObserverFactory(fake.factory);
  layout = stubPageLayout();
  rasterized.length = 0;
  vi.mocked(exportGIF).mockClear();
});

afterEach(() => {
  setObserverFactory(null);
  layout.mockRestore();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

const playState = (el: Element | null) =>
  (el as (Element & ElementCSSInlineStyle) | null)?.style.getPropertyValue('--oc-play-state');

/** A timing value no render stamps, so a copy from the cascade is visible. */
const CASCADE_TIMING = '987ms';
const TIMING_TOKENS = [
  '--oc-animation-duration',
  '--oc-animation-stagger',
  '--oc-annotation-delay',
];

/**
 * A browser's computed style: every token resolves to its stylesheet default
 * (happy-dom computes no custom properties). Timing tokens get a sentinel.
 */
function stubComputedTokens(): void {
  const real = globalThis.getComputedStyle;
  const defaults = new Map<string, string>();
  for (const token of CSS_TOKENS) {
    defaults.set(token.name, TIMING_TOKENS.includes(token.name) ? CASCADE_TIMING : token.light);
  }
  vi.stubGlobal('getComputedStyle', (el: Element, pseudo?: string | null) => {
    const style = real(el, pseudo);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return (name: string) => defaults.get(name) ?? target.getPropertyValue(name);
        }
        const value = Reflect.get(target, prop, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  });
}

function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

// ---------------------------------------------------------------------------
// Mount cases
// ---------------------------------------------------------------------------

interface Instance {
  update(spec: never): void;
  resize(): void;
  destroy(): void;
  export?(format: 'svg' | 'png' | 'gif', options?: { theme?: unknown }): unknown;
}

interface MountCase {
  name: string;
  root: string;
  mount(container: HTMLElement, spec: unknown): Instance;
  initial(): unknown;
  /** Different data, for update(). */
  next(): unknown;
  /**
   * Data that draws nothing. The validator rejects an empty array, so this is
   * the null-valued shape; tables always draw their rows.
   */
  empty?(): unknown;
  exports: boolean;
}

const chartSpec = (rows: Array<{ q: string; s: string; v: number | null }>): ChartSpec => ({
  mark: 'bar',
  animation: true,
  data: rows,
  encoding: {
    x: { field: 'q', type: 'nominal' },
    y: { field: 'v', type: 'quantitative', stack: 'zero' },
    color: { field: 's', type: 'nominal' },
  },
});
const chartRows = [
  { q: 'Q1', s: 'A', v: 3 },
  { q: 'Q1', s: 'B', v: 2 },
  { q: 'Q2', s: 'A', v: 4 },
  { q: 'Q2', s: 'B', v: 1 },
];

const barlistSpec = (rows: Array<{ name: string; value: number | null }>) => ({
  type: 'barlist' as const,
  animation: true,
  data: rows,
  encoding: {
    label: { field: 'name', type: 'nominal' as const },
    value: { field: 'value', type: 'quantitative' as const },
  },
});

const tilemapSpec = (data: Record<string, number | null>) => ({
  type: 'tilemap' as const,
  animation: true,
  data,
});

const sankeySpec = (rows: Array<{ from: string; to: string; amount: number }>) => ({
  type: 'sankey' as const,
  animation: true,
  data: rows,
  encoding: {
    source: { field: 'from', type: 'nominal' as const },
    target: { field: 'to', type: 'nominal' as const },
    value: { field: 'amount', type: 'quantitative' as const },
  },
});

const MINI_TOPO = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [0, 0] },
  objects: {
    states: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: '06', properties: { name: 'California' }, arcs: [[0]] },
        { type: 'Polygon', id: '48', properties: { name: 'Texas' }, arcs: [[1]] },
      ],
    },
  },
  arcs: [
    [
      [-122, 37],
      [4, -3],
      [-3, 2],
      [-1, 1],
    ],
    [
      [-100, 31],
      [6, -1],
      [-3, -4],
      [-3, 5],
    ],
  ],
};
const mapSpec = (rows: Array<{ fips: string; value: number }>) => ({
  type: 'map' as const,
  animation: true,
  geo: { features: MINI_TOPO, projection: 'mercator' as const },
  data: rows,
  encoding: {
    key: { field: 'fips', type: 'nominal' as const },
    color: { field: 'value', type: 'quantitative' as const },
  },
});

const opts = { autoResize: false } as const;

const cases: MountCase[] = [
  {
    name: 'chart',
    root: 'svg.oc-chart',
    mount: (c, spec) => createChart(c, spec as ChartSpec, opts) as Instance,
    initial: () => chartSpec(chartRows),
    next: () => chartSpec(chartRows.map((r) => ({ ...r, v: r.v + 1 }))),
    empty: () => chartSpec(chartRows.map((r) => ({ ...r, v: null }))),
    exports: true,
  },
  {
    name: 'table',
    root: '.oc-table-wrapper',
    mount: (c, spec) => createTable(c, spec as ReturnType<typeof makeTableSpec>, opts),
    initial: () => makeTableSpec({ animation: true }),
    next: () => makeTableSpec({ animation: true, data: [{ name: 'Zed', age: 1, city: 'Nome' }] }),
    exports: false,
  },
  {
    name: 'barlist',
    root: 'svg.oc-barlist',
    mount: (c, spec) => createBarList(c, spec as never, opts) as Instance,
    initial: () =>
      barlistSpec([
        { name: 'A', value: 4 },
        { name: 'B', value: 9 },
      ]),
    next: () => barlistSpec([{ name: 'C', value: 2 }]),
    empty: () =>
      barlistSpec([
        { name: 'A', value: null },
        { name: 'B', value: null },
      ]),
    exports: true,
  },
  {
    name: 'tilemap',
    root: 'svg.oc-tilemap',
    mount: (c, spec) => createTileMap(c, spec as never, opts) as Instance,
    initial: () => tilemapSpec({ CA: 5, TX: 4, NY: 3 }),
    next: () => tilemapSpec({ CA: 1, TX: 9 }),
    empty: () => tilemapSpec({ CA: null, TX: null }),
    exports: true,
  },
  {
    name: 'sankey',
    root: 'svg.oc-sankey',
    mount: (c, spec) => createSankey(c, spec as never, opts) as Instance,
    initial: () =>
      sankeySpec([
        { from: 'A', to: 'C', amount: 10 },
        { from: 'B', to: 'C', amount: 20 },
      ]),
    next: () => sankeySpec([{ from: 'A', to: 'D', amount: 5 }]),
    empty: () => sankeySpec([{ from: 'A', to: 'C', amount: 0 }]),
    exports: true,
  },
  {
    name: 'map',
    root: 'svg.oc-map',
    mount: (c, spec) => createGeoMap(c, spec as never, opts) as Instance,
    initial: () =>
      mapSpec([
        { fips: '06', value: 10 },
        { fips: '48', value: 20 },
      ]),
    next: () => mapSpec([{ fips: '06', value: 30 }]),
    empty: () => mapSpec([]),
    exports: true,
  },
];

function rootOf(container: HTMLElement, c: MountCase): Element {
  const el = container.querySelector(c.root);
  if (!el) throw new Error(`${c.name}: no ${c.root}`);
  return el;
}

/**
 * Renders since mount. Mounts that publish `data-oc-render-gen` are read from
 * it (a chart resize reconciles into the same SVG, so the root may not
 * change); the table, which doesn't, counts the wrappers it swaps in.
 */
function renderCounter(container: HTMLElement, c: MountCase): () => number {
  let added = 0;
  const observer = new MutationObserver(() => {});
  observer.observe(container, { childList: true });
  return () => {
    for (const record of observer.takeRecords()) {
      for (const node of record.addedNodes) {
        if (node instanceof Element && node.matches(c.root)) added++;
      }
    }
    const gen = container.dataset.ocRenderGen;
    return gen === undefined ? added : Number(gen);
  };
}

function expectWaiting(root: Element): void {
  expect(root.classList.contains('oc-animate')).toBe(true);
  expect(playState(root)).toBe('paused');
  expect(fake.observedCount()).toBe(1);
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

describe.each(cases)('$name entrance lifecycle', (c) => {
  it('re-arms a waiting entrance on the new root when resized', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    const renders = renderCounter(container, c);
    expectWaiting(rootOf(container, c));

    const before = renders();
    instance.resize();
    expect(renders()).toBe(before + 1);
    expectWaiting(rootOf(container, c));
    instance.destroy();
  });

  it('re-arms a waiting entrance on update, so the new data enters when seen', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());

    instance.update(c.next() as never);
    const root = rootOf(container, c);
    expectWaiting(root);

    fake.fire(container, 1, 400);
    expect(playState(root)).toBe('');
    vi.advanceTimersByTime(10_000);
    expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);
    instance.destroy();
  });

  it.runIf(!!c.empty)(
    'does not arm with nothing to show, and arms on the first update with data',
    () => {
      const container = createContainer();
      const instance = c.mount(container, c.empty!());
      expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);
      expect(fake.observedCount()).toBe(0);

      instance.resize();
      expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);

      instance.update(c.initial() as never);
      expectWaiting(rootOf(container, c));
      instance.destroy();
    },
  );

  it.runIf(!!c.empty)('keeps a waiting entrance owed across an update that empties it', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    expectWaiting(rootOf(container, c));

    // The data goes away while the entrance waits: nothing to arm.
    instance.update(c.empty!() as never);
    expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);
    expect(fake.observedCount()).toBe(0);

    // It comes back: the entrance the reader never saw is still owed.
    instance.update(c.next() as never);
    const root = rootOf(container, c);
    expectWaiting(root);

    fake.fire(container, 1, 400);
    expect(playState(root)).toBe('');
    vi.advanceTimersByTime(10_000);
    expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);
    instance.destroy();
  });

  it('snaps an update while the entrance plays', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    fake.fire(container, 1, 400);

    instance.update(c.next() as never);
    expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);
    expect(fake.observedCount()).toBe(0);
    instance.destroy();
  });

  it('defers a resize while the entrance plays and replays it once', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    fake.fire(container, 1, 400);
    const renders = renderCounter(container, c);
    const before = renders();

    instance.resize();
    instance.resize();
    expect(renders()).toBe(before);

    vi.advanceTimersByTime(10_000);
    expect(renders()).toBe(before + 1);
    expect(rootOf(container, c).classList.contains('oc-animate')).toBe(false);

    // Settled: the next resize runs at once.
    instance.resize();
    expect(renders()).toBe(before + 2);
    instance.destroy();
  });

  it('cancels a waiting entrance on destroy', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    expect(fake.observedCount()).toBe(1);
    instance.destroy();
    expect(fake.observedCount()).toBe(0);
    expect(fake.observed.size).toBe(0);
  });

  it('cancels a playing entrance on destroy, with no deferred resize afterwards', () => {
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    fake.fire(container, 1, 400);
    instance.resize(); // deferred
    instance.destroy();
    vi.advanceTimersByTime(10_000);
    expect(container.querySelector(c.root)).toBeNull();
  });

  it('opens no entrance window under reduced motion', () => {
    stubReducedMotion();
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    const renders = renderCounter(container, c);
    expect(playState(rootOf(container, c))).toBe('');
    expect(fake.observedCount()).toBe(0);

    // Complete at once: a resize is not deferred.
    const before = renders();
    instance.resize();
    expect(renders()).toBe(before + 1);
    instance.destroy();
  });

  it.runIf(c.exports)('exports a settled scene with no entrance stamps', async () => {
    stubComputedTokens();
    const container = createContainer();
    const instance = c.mount(container, c.initial());
    // Mid-entrance: waiting, then playing.
    expectWaiting(rootOf(container, c));
    const svgWaiting = instance.export!('svg') as string;
    fake.fire(container, 1, 400);
    const svgPlaying = instance.export!('svg') as string;
    await instance.export!('png');
    expect(rasterized).toHaveLength(1);
    const png = rasterized[0].outerHTML;
    // Settled and re-rendered: the live root has no stamps of its own left.
    vi.advanceTimersByTime(10_000);
    instance.resize();
    const svgSettled = instance.export!('svg') as string;

    for (const out of [svgWaiting, svgPlaying, png, svgSettled]) {
      expect(out).not.toContain('oc-animate');
      expect(out).not.toContain('--oc-play-state');
      expect(out).not.toContain('data-animation-index');
      expect(out).not.toContain('--oc-mark-index');
      expect(out).not.toContain('--oc-animation-');
      expect(out).not.toContain('--oc-annotation-delay');
      expect(out).not.toContain('oc-stack-reveal');
      expect(out).not.toContain('data-cell');
    }
    instance.destroy();
  });

  it.runIf(c.exports)(
    "keeps the GIF clone's own entrance timing after a post-entrance re-render",
    async () => {
      const container = createContainer();
      const instance = c.mount(container, c.initial());
      fake.fire(container, 1, 400);
      vi.advanceTimersByTime(10_000);
      // Settled, then re-rendered: the live root carries no timing stamps, so
      // the browser cascade resolves the tokens to the stylesheet defaults.
      instance.resize();
      const live = rootOf(container, c) as Element & ElementCSSInlineStyle;
      expect(live.style.getPropertyValue('--oc-animation-duration')).toBe('');
      stubComputedTokens();

      for (const options of [undefined, { theme: resolveTheme() }]) {
        vi.mocked(exportGIF).mockClear();
        await instance.export!('gif', options);
        expect(exportGIF).toHaveBeenCalledTimes(1);
        const gif = vi.mocked(exportGIF).mock.calls[0][0] as SVGElement & ElementCSSInlineStyle;
        const duration = gif.style.getPropertyValue('--oc-animation-duration');
        expect(duration).not.toBe('');
        expect(duration).not.toBe(CASCADE_TIMING);
        expect(gif.style.getPropertyValue('--oc-animation-stagger')).not.toBe(CASCADE_TIMING);
      }
      instance.destroy();
    },
  );
});

// ---------------------------------------------------------------------------
// Chart-only decisions
// ---------------------------------------------------------------------------

describe('chart', () => {
  it('skips the entrance in edit mode', () => {
    const container = createContainer();
    const chart = createChart(container, chartSpec(chartRows), {
      autoResize: false,
      interaction: 'edit',
      onEdit: () => {},
    });
    const svg = container.querySelector('svg.oc-chart') as SVGElement;
    expect(svg.classList.contains('oc-animate')).toBe(false);
    expect(playState(svg)).toBe('');
    expect(fake.observedCount()).toBe(0);
    chart.destroy();
  });

  it('exports line points and grid cells with no entrance stamps', () => {
    stubComputedTokens();
    const specs = [
      {
        mark: { type: 'line', point: true },
        data: chartRows,
        encoding: {
          x: { field: 'q', type: 'ordinal' },
          y: { field: 'v', type: 'quantitative' },
          color: { field: 's', type: 'nominal' },
        },
      },
      {
        mark: 'rect',
        data: ['a', 'b'].flatMap((row) => ['x', 'y', 'z'].map((col, i) => ({ row, col, v: i }))),
        encoding: {
          x: { field: 'col', type: 'nominal' },
          y: { field: 'row', type: 'nominal' },
          color: { field: 'v', type: 'quantitative' },
        },
      },
    ] as ChartSpec[];
    for (const spec of specs) {
      const container = createContainer();
      const chart = createChart(container, { ...spec, animation: true } as ChartSpec, opts);
      const live = container.querySelector('svg.oc-chart')!.outerHTML;
      // The live root carries the stamps, so the export check below is not vacuous.
      expect(live).toMatch(/--oc-line-point-delay|--oc-cell-delay/);
      expect(live).toContain('transform-origin');
      fake.fire(container, 1, 400);
      const out = chart.export('svg') as string;
      expect(out).not.toContain('transform-origin');
      expect(out).not.toContain('--oc-line-point-delay');
      expect(out).not.toContain('--oc-cell-delay');
      chart.destroy();
    }
  });

  it('snaps a resize re-layout instead of tweening it', () => {
    let width = 600;
    const container = document.createElement('div');
    Object.defineProperty(container, 'getBoundingClientRect', {
      value: () => ({ width, height: 400, top: 0, left: 0, right: width, bottom: 400, x: 0, y: 0 }),
    });
    document.body.appendChild(container);
    const spec = { ...chartSpec(chartRows), animation: { enter: false } } as ChartSpec;
    const chart = createChart(container, spec, opts);

    const drawnWidths = () =>
      [...container.querySelectorAll('[data-key]')].map((el) => {
        const shape = el.matches('rect, path') ? el : el.querySelector('rect, path');
        return shape?.getAttribute('width') ?? shape?.getAttribute('d');
      });
    const before = drawnWidths();

    width = 420;
    chart.resize();
    // Right after the resize the drawn geometry is already the new layout's:
    // no from-state written back, no ghosts, nothing left to tween.
    const after = drawnWidths();
    expect(after).not.toEqual(before);
    expect(container.querySelector('.oc-ghost')).toBeNull();
    expect(chart.sampleLayout()).toBe(chart.layout);
    vi.advanceTimersByTime(1000);
    expect(drawnWidths()).toEqual(after);

    // The same chart does tween a data update, so the check above is live.
    chart.update({ ...spec, data: chartRows.map((r) => ({ ...r, v: r.v * 2 })) } as ChartSpec);
    expect(chart.sampleLayout()).not.toBe(chart.layout);
    chart.destroy();
  });

  it('keeps entrance stamps on a GIF export, without oc-animate', async () => {
    const container = createContainer();
    const chart = createChart(container, chartSpec(chartRows), opts);
    await chart.export('gif');
    expect(exportGIF).toHaveBeenCalledTimes(1);
    const svg = vi.mocked(exportGIF).mock.calls[0][0] as SVGElement & ElementCSSInlineStyle;
    expect(svg.classList.contains('oc-animate')).toBe(false);
    expect(svg.style.getPropertyValue('--oc-play-state')).toBe('');
    expect(svg.querySelector('.oc-stack-reveal[data-animation-index]')).not.toBeNull();
    expect(svg.style.getPropertyValue('--oc-animation-duration')).not.toBe('');
    chart.destroy();
  });
});

import { adaptTheme, DEFAULT_THEME, type RaceSpec } from '@opendata-ai/openchart-core';
import * as engine from '@opendata-ai/openchart-engine';
import type { Window as HappyWindow } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { RACE_MARKS } from '../../../../engine/src/race/marks';
import { createFakeObserver, stubPageLayout } from '../../__test-fixtures__/visibility';
import { createRace, type RaceInstance, type RaceMountOptions } from '../../race-mount';
import { setObserverFactory } from '../../visibility';
import { RACE_RENDERERS } from '../renderers';

vi.mock('../renderers', async (importOriginal) => {
  const original = await importOriginal<typeof import('../renderers')>();
  return { ...original, RACE_RENDERERS: { ...original.RACE_RENDERERS } };
});

declare global {
  interface Window {
    happyDOM: HappyWindow['happyDOM'];
  }
}

const spec: RaceSpec = {
  type: 'race',
  mark: 'bar',
  data: [
    { key: 'A', year: 2020, value: 100 },
    { key: 'B', year: 2020, value: 40 },
    { key: 'C', year: 2020, value: 20 },
    { key: 'A', year: 2021, value: 80 },
    { key: 'B', year: 2021, value: 130 },
    { key: 'C', year: 2021, value: 20 },
    { key: 'A', year: 2022, value: 60 },
    { key: 'B', year: 2022, value: 200 },
    { key: 'C', year: 2022, value: 20 },
  ],
  encoding: {
    time: { field: 'year', type: 'ordinal' },
    key: { field: 'key', type: 'nominal' },
    value: { field: 'value', type: 'quantitative' },
  },
  race: { top: 2, duration: 2000, swap: 0, autoplay: false },
  chrome: { title: 'Annual standings' },
};

let host: HTMLDivElement;
let width: number;
let height: number;
let race: RaceInstance | undefined;
let frameId: number;
const frames = new Map<number, FrameRequestCallback>();
const resizeObservers = new Map<Element, () => void>();
const activeResizeObservers = new Set<ResizeObserver>();

class TestResizeObserver extends ResizeObserver {
  private target?: Element;

  constructor(private readonly deliver: ResizeObserverCallback) {
    super(deliver);
  }

  override observe(target: Element) {
    this.target = target;
    activeResizeObservers.add(this);
    resizeObservers.set(target, () => {
      const contentRect = target.getBoundingClientRect();
      const size = { inlineSize: contentRect.width, blockSize: contentRect.height };
      this.deliver(
        [
          {
            target,
            contentRect,
            borderBoxSize: [size],
            contentBoxSize: [size],
            devicePixelContentBoxSize: [size],
          },
        ],
        this,
      );
    });
  }

  override disconnect() {
    if (this.target) resizeObservers.delete(this.target);
    activeResizeObservers.delete(this);
  }
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  width = 0;
  height = 0;
  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, width, height),
  );
  vi.spyOn(host, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(host, 'clientHeight', 'get').mockImplementation(() => height);
  frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++frameId, cb);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal('ResizeObserver', TestResizeObserver);
});

afterEach(() => {
  race?.destroy();
  race = undefined;
  host.remove();
  frames.clear();
  resizeObservers.clear();
  activeResizeObservers.clear();
  window.happyDOM.settings.device.prefersReducedMotion = 'no-preference';
  setObserverFactory(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mount(nextSpec = spec, options?: RaceMountOptions): RaceInstance {
  race = createRace(host, nextSpec, options);
  return race;
}

function tick(now: number) {
  for (const [id, callback] of [...frames]) {
    if (frames.delete(id)) callback(now);
  }
}

function rowKeys() {
  return Array.from(
    host.querySelectorAll('.oc-race-rows [data-key]:not([display="none"])'),
    (row) => row.getAttribute('data-key'),
  );
}

function button() {
  return host.querySelector('button')!;
}

function scrub() {
  return host.querySelector('input[type="range"]')!;
}

function svg() {
  return host.querySelector('svg.oc-race')!;
}

function liveRegion() {
  return host.querySelector('[aria-live="polite"]');
}

function observeVisibility() {
  const intersection = createFakeObserver();
  stubPageLayout();
  setObserverFactory(intersection.factory);
  return intersection;
}

function stubFonts(loaded = false) {
  const before = Object.getOwnPropertyDescriptor(document, 'fonts');
  const { promise: ready, resolve } = Promise.withResolvers<void>();
  const check = vi.fn(() => loaded);
  Object.defineProperty(document, 'fonts', { configurable: true, value: { check, ready } });
  onTestFinished(() => {
    if (before) Object.defineProperty(document, 'fonts', before);
    else Reflect.deleteProperty(document, 'fonts');
  });
  return { ready, resolve, check };
}

function barFills() {
  return Array.from(host.querySelectorAll('.oc-race-rows rect'), (bar) => bar.getAttribute('fill'));
}

describe('createRace', () => {
  it('renders chrome, the visible rows and working controls with fallback dimensions', () => {
    const chart = mount();
    expect(svg().getAttribute('role')).toBe('img');
    expect(svg().getAttribute('aria-label')).toBe('Annual standings');
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 476');
    expect(host.querySelector('.oc-race-period')?.textContent).toBe('2020');
    expect(rowKeys()).toEqual(['A', 'B']);
    expect(button().getAttribute('aria-label')).toBe('Play');
    expect(scrub().getAttribute('aria-label')).toBe('Time');
    expect(scrub().value).toBe('0');
    expect(scrub().max).toBe('2');
    expect(chart.getState()).toEqual({
      t: 0,
      playing: false,
      speed: 1,
      ended: false,
      period: { index: 0, value: 2020, label: '2020' },
    });
    expect(frames.size).toBe(0);
  });

  it('omits controls and uses the full authored size when controls are disabled', () => {
    width = 800;
    height = 540;
    const warnings: string[] = [];
    const chart = mount(
      { ...spec, width: 480, height: 300, race: { ...spec.race, controls: false, autoplay: true } },
      { autoResize: false, onWarn: (message) => warnings.push(message) },
    );
    expect(svg().getAttribute('viewBox')).toBe('0 0 480 300');
    expect(host.querySelector<HTMLElement>('.oc-race-root')?.style.width).toBe('480px');
    expect(host.querySelector('button, input, .oc-race-controls-slot > *')).toBeNull();
    expect(resizeObservers.size).toBe(0);
    expect(warnings).toEqual([expect.stringContaining('controls disabled')]);
    expect(chart.getState().playing).toBe(true);
  });

  it('waits until visible, then autoplays only once', () => {
    const intersection = observeVisibility();
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: 'visible' } });
    expect(chart.getState().playing).toBe(false);
    expect(frames.size).toBe(0);
    intersection.fire(host, 0.1);
    expect(button().getAttribute('aria-label')).toBe('Play');
    intersection.fire(host, 0.5);
    expect(button().getAttribute('aria-label')).toBe('Pause');
    expect(frames.size).toBe(1);
    chart.pause();
    intersection.fire(host, 1);
    expect(chart.getState()).toMatchObject({ t: 0, playing: false });
    expect(frames.size).toBe(0);
  });

  it('starts immediately when visibility cannot be measured', () => {
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: 'visible' } });
    expect(chart.getState()).toMatchObject({ playing: true, t: 0 });
    expect(button().getAttribute('aria-label')).toBe('Pause');
  });

  it('keeps an explicitly paused and sought frame when visibility arrives later', () => {
    const intersection = observeVisibility();
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: 'visible' } });
    chart.pause();
    chart.seek(1);
    intersection.fire(host, 1);
    tick(0);
    tick(500);
    expect(chart.getState()).toMatchObject({ t: 1, playing: false });
    expect(host.querySelector('.oc-race-period')?.textContent).toBe('2021');
  });

  it('disarms visibility autoplay when a reader seeks before the chart is seen', () => {
    const intersection = observeVisibility();
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: 'visible' } });
    expect(() => chart.seek(NaN)).toThrow(RangeError);
    expect(intersection.observed.has(host)).toBe(true);
    chart.seek(1);
    intersection.fire(host, 1);
    tick(0);
    tick(500);
    expect(chart.getState()).toMatchObject({ t: 1, playing: false });
    expect(scrub().value).toBe('1');
    expect(frames.size).toBe(0);
  });

  it('starts autoplay true at mount even while offscreen', () => {
    const intersection = observeVisibility();
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: true } });
    expect(intersection.observed.has(host)).toBe(false);
    expect(chart.getState()).toMatchObject({ playing: true, t: 0 });
    expect(button().getAttribute('aria-label')).toBe('Pause');
  });

  it.each([
    'animation disabled',
    'reduced motion',
  ])('opens paused on the last frame with %s', (mode) => {
    const intersection = observeVisibility();
    if (mode === 'reduced motion') window.happyDOM.settings.device.prefersReducedMotion = 'reduce';
    const chart = mount({
      ...spec,
      animation: mode !== 'animation disabled',
      race: { ...spec.race, autoplay: 'visible' },
    });
    intersection.fire(host, 1);
    expect(intersection.observed.size).toBe(0);
    expect(chart.getState()).toEqual({
      t: 2,
      playing: false,
      speed: 1,
      ended: false,
      period: { index: 2, value: 2022, label: '2022' },
    });
    expect(host.querySelector('.oc-race-period')?.textContent).toBe('2022');
    expect(rowKeys()).toEqual(['B', 'A']);
    expect(button().getAttribute('aria-label')).toBe('Play');
    expect(scrub().value).toBe('2');
    expect(frames.size).toBe(0);
  });

  it('updates the row order, period, scrubber and readout as the clock advances', () => {
    mount();
    expect(rowKeys()).toEqual(['A', 'B']);
    button().click();
    tick(0);
    tick(1500);
    expect(rowKeys()).toEqual(['B', 'A']);
    expect(host.querySelector('[data-key="B"] text:last-child')?.textContent).toBe('165');
    expect(host.querySelector('.oc-race-period')?.textContent).toBe('2021');
    expect(host.querySelector('.oc-race-readout')?.textContent).toBe('2021');
    expect(scrub().value).toBe('1.5');
    expect(scrub().getAttribute('aria-valuetext')).toBe('2021');
    button().click();
    tick(1800);
    expect(scrub().value).toBe('1.5');
    expect(button().getAttribute('aria-label')).toBe('Play');
  });

  it('seeks when scrubbing and steps to the next whole period with arrow keys', () => {
    const chart = mount();
    button().click();
    const input = scrub();
    input.value = '0.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(chart.getState()).toMatchObject({ t: 0.5, playing: true });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(chart.getState()).toMatchObject({ t: 1, playing: false });
    expect(rowKeys()).toEqual(['B', 'A']);
    expect(input.getAttribute('aria-valuetext')).toBe('2021');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(chart.getState()).toMatchObject({ t: 0, playing: false });
    expect(rowKeys()).toEqual(['A', 'B']);
  });

  it('announces pause, paused scrubbing and arrow steps while playback stays quiet', () => {
    const chart = mount();
    expect(liveRegion()?.textContent).toBe('');
    button().click();
    tick(0);
    tick(1000);
    expect(scrub().getAttribute('aria-valuetext')).toBe('2021');
    expect(liveRegion()?.textContent).toBe('');
    button().click();
    expect(liveRegion()?.textContent).toBe('2021: B, A lead');

    const input = scrub();
    input.focus();
    for (const value of ['0.5', '0']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(chart.getState().t).toBe(Number(value));
      expect(liveRegion()?.textContent).toBe('2021: B, A lead');
    }
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(liveRegion()?.textContent).toBe('A, B lead');
    expect(input.getAttribute('aria-valuetext')).toBe('2020');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(liveRegion()?.textContent).toBe('B, A lead');
    expect(input.getAttribute('aria-valuetext')).toBe('2021');

    button().focus();
    button().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(liveRegion()?.textContent).toBe('2020: A, B lead');
    chart.seek(1);
    expect(liveRegion()?.textContent).toBe('2021: B, A lead');
    expect(input.getAttribute('aria-valuetext')).toBe('2021');

    chart.play();
    chart.seek(2);
    input.dispatchEvent(new Event('change', { bubbles: true }));
    tick(1500);
    tick(3000);
    expect(chart.getState()).toMatchObject({ t: 2, playing: false });
    expect(liveRegion()?.textContent).toBe('2021: B, A lead');
    chart.pause();
    expect(liveRegion()?.textContent).toBe('2022: B, A lead');
  });

  it('scrubs by whole periods in reduced motion and keeps the API seek continuous', () => {
    window.happyDOM.settings.device.prefersReducedMotion = 'reduce';
    const chart = mount();
    const input = scrub();
    input.value = '0.75';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(chart.getState()).toMatchObject({ t: 1, playing: false });
    expect(input.getAttribute('aria-valuetext')).toBe('2021');
    expect(liveRegion()?.textContent).toBe('');
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(liveRegion()?.textContent).toBe('2021: B, A lead');
    chart.seek(0.25);
    expect(chart.getState().t).toBe(0.25);
    expect(liveRegion()?.textContent).toBe('2020: A, B lead');
  });

  it('uses the scrubber value text for the period when seeking or stepping with focus there', () => {
    const chart = mount();
    const input = scrub();
    input.focus();
    chart.seek(1);
    expect(input.getAttribute('aria-valuetext')).toBe('2021');
    expect(liveRegion()?.textContent).toBe('B, A lead');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(input.getAttribute('aria-valuetext')).toBe('2020');
    expect(liveRegion()?.textContent).toBe('A, B lead');
  });

  it('reports a throwing listener and continues playback, seek and update dispatch', () => {
    const chart = mount();
    const failure = new Error('listener failed');
    const reported: unknown[] = [];
    const periods: number[] = [];
    vi.stubGlobal('reportError', (error: unknown) => reported.push(error));
    chart.on('period', () => {
      throw failure;
    });
    chart.on('period', ({ index }) => periods.push(index));

    chart.play();
    tick(0);
    expect(() => tick(2000)).not.toThrow();
    expect(chart.getState()).toMatchObject({ t: 2, playing: true });
    expect(frames.size).toBe(1);
    expect(periods).toEqual([1, 2]);
    expect(() => chart.seek(2)).not.toThrow();
    expect(() =>
      chart.update({ ...spec, data: spec.data.filter(({ year }) => year < 2022) }),
    ).not.toThrow();
    expect(chart.getState()).toMatchObject({ t: 1, playing: true });
    expect(periods).toEqual([1, 2, 2, 1]);
    expect(reported).toEqual(Array(4).fill(failure));
  });

  it('reports a listener failure in a microtask when reportError is unavailable', () => {
    const chart = mount();
    const failure = new Error('listener failed');
    const reportTasks: Array<() => void> = [];
    vi.stubGlobal('reportError', undefined);
    vi.stubGlobal('queueMicrotask', (callback: () => void) => reportTasks.push(callback));
    chart.on('period', () => {
      throw failure;
    });

    expect(() => chart.seek(1)).not.toThrow();
    expect(reportTasks).toHaveLength(1);
    expect(reportTasks[0]).toThrow(failure);
  });

  it('emits every crossed period once on a delayed frame and emits the loop destination', () => {
    const chart = mount({ ...spec, race: { ...spec.race, loop: true } });
    const periods: ReturnType<RaceInstance['getState']>['period'][] = [];
    chart.on('period', (period) => periods.push(period));
    chart.play();
    tick(0);
    tick(500);
    expect(periods).toEqual([]);
    tick(2000);
    expect(periods).toEqual([
      { index: 1, value: 2021, label: '2021' },
      { index: 2, value: 2022, label: '2022' },
    ]);
    tick(2250);
    tick(3500);
    expect(periods).toEqual([
      { index: 1, value: 2021, label: '2021' },
      { index: 2, value: 2022, label: '2022' },
      { index: 0, value: 2020, label: '2020' },
    ]);
  });

  it('emits the destination once for every seek, including seeks within the same period', () => {
    const chart = mount({
      ...spec,
      encoding: {
        ...spec.encoding,
        time: { field: 'year', type: 'quantitative', format: '.0f CE' },
      },
    });
    const periods: ReturnType<RaceInstance['getState']>['period'][] = [];
    chart.on('period', (period) => periods.push(period));
    chart.seek(0.5);
    chart.seek(20);
    chart.play();
    const input = scrub();
    input.value = '0.25';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(() => chart.seek(NaN)).toThrow(RangeError);
    expect(periods).toEqual([
      { index: 0, value: 2020, label: '2020 CE' },
      { index: 2, value: 2022, label: '2022 CE' },
      { index: 0, value: 2020, label: '2020 CE' },
      { index: 1, value: 2021, label: '2021 CE' },
    ]);
  });

  it('stops notifying unsubscribed listeners and clears listeners on destroy during dispatch', () => {
    const chart = mount();
    const calls: string[] = [];
    const unsubscribe = chart.on('period', () => calls.push('unsubscribed'));
    chart.seek(0);
    unsubscribe();
    unsubscribe();
    chart.on('period', (period) => {
      calls.push(period.label);
      chart.destroy();
    });
    chart.on('period', () => calls.push('after destroy'));
    chart.play();
    tick(0);
    tick(2000);
    chart.seek(0);
    chart.on('period', () => calls.push('registered after destroy'));
    chart.seek(1);
    expect(calls).toEqual(['unsubscribed', '2021']);
    expect(host.children).toHaveLength(0);
  });

  it('drops undelivered crossings when a listener seeks away', () => {
    const chart = mount();
    const periods: number[] = [];
    chart.on('period', ({ index }) => {
      if (index === 1) chart.seek(0);
    });
    chart.on('period', ({ index }) => periods.push(index));
    chart.play();
    tick(0);
    tick(2000);
    expect(periods).toEqual([1, 0]);
    expect(chart.getState()).toMatchObject({ t: 0, playing: true });
  });

  it('drops undelivered crossings when a listener update clamps the playhead', () => {
    const chart = mount();
    const periods: number[] = [];
    const stop = chart.on('period', () => {
      stop();
      chart.update({ ...spec, data: spec.data.filter(({ year }) => year < 2022) });
    });
    chart.on('period', ({ index }) => periods.push(index));
    chart.play();
    tick(0);
    tick(2000);
    expect(periods).toEqual([1, 1]);
    expect(chart.getState()).toMatchObject({ t: 1, playing: true });
  });

  it('delivers every crossed period when a listener changes the theme', () => {
    const chart = mount();
    const periods: number[] = [];
    chart.on('period', ({ index }) => {
      if (index === 1) chart.update({ ...spec, theme: { spacing: { padding: 15 } } });
    });
    chart.on('period', ({ index }) => periods.push(index));
    chart.play();
    tick(0);
    tick(2000);
    expect(periods).toEqual([1, 2]);
  });

  it('keeps a new registration when an old unsubscribe handle is used again', () => {
    const chart = mount();
    const periods: number[] = [];
    const record: Parameters<RaceInstance['on']>[1] = ({ index }) => periods.push(index);
    const first = chart.on('period', record);
    first();
    const second = chart.on('period', record);
    first();
    chart.seek(1);
    second();
    chart.seek(2);
    expect(periods).toEqual([1]);
  });

  it('keeps the screen-reader table and live region mounted across a resize', () => {
    const chart = mount();
    chart.seek(1);
    const table = host.querySelector('table');
    const live = liveRegion();
    const description = svg().getAttribute('aria-describedby') ?? '';
    width = 420;
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 420 476');
    expect(svg().getAttribute('aria-label')).toBe('Annual standings');
    expect(svg().getAttribute('aria-describedby')).toBe(description);
    expect(document.getElementById(description)?.textContent).toContain('2020 to 2022');
    expect(table).toBeTruthy();
    expect(host.querySelector('table')).toBe(table);
    expect(liveRegion()).toBe(live);
    expect(live?.textContent).toBe('2021: B, A lead');
    chart.destroy();
    expect(table?.isConnected).toBe(false);
    expect(live?.isConnected).toBe(false);
  });

  it.each([{ mark: 'line' }, { mark: 'table' }] satisfies Pick<
    RaceSpec,
    'mark'
  >[])('keeps the existing fallback and live announcement when swapping to $mark', ({ mark }) => {
    const line = RACE_MARKS.line;
    const tableEntry = RACE_MARKS.table;
    const lineRenderer = RACE_RENDERERS.line;
    const tableRenderer = RACE_RENDERERS.table;
    onTestFinished(() => {
      RACE_MARKS.line = line;
      RACE_MARKS.table = tableEntry;
      RACE_RENDERERS.line = lineRenderer;
      RACE_RENDERERS.table = tableRenderer;
    });
    RACE_MARKS.line = {
      computeStatic(_model, { area }) {
        return {
          plot: area,
          xScale: { domain: [0, 2], range: [area.x, area.x + area.width] },
          yAxisX: area.x,
          labelGutter: 0,
          tickFontSize: 12,
        };
      },
      geometry() {
        return { mark: 'line', series: [], xTicks: [], yTicks: [], domain: [0, 200] };
      },
    };
    RACE_RENDERERS.line = () => ({ draw() {}, destroy() {} });
    RACE_MARKS.table = {
      computeStatic() {
        return {
          headerHeight: 20,
          rowHeight: 20,
          fontSize: 12,
          columns: [],
          labels: {
            rank: 'Rank',
            change: 'Change',
            name: 'Name',
            bar: '',
            value: 'Value',
            share: 'Share',
          },
        };
      },
      geometry() {
        return { mark: 'table', rows: [] };
      },
    };
    RACE_RENDERERS.table = (markHost) => {
      const table = markHost.ownerDocument.createElement('table');
      table.setAttribute('aria-label', 'Visible standings');
      markHost.append(table);
      return { draw() {}, destroy: () => table.remove() };
    };

    const chart = mount();
    chart.seek(1);
    const table = host.querySelector('table');
    const live = liveRegion();
    expect(table?.textContent).toContain('2020');
    expect(live?.textContent).toBe('2021: B, A lead');
    chart.play();
    chart.update({ ...spec, mark });
    expect(chart.getState()).toMatchObject({ t: 1, playing: true });
    expect(rowKeys()).toEqual([]);
    expect(host.querySelectorAll('table')).toHaveLength(mark === 'table' ? 2 : 1);
    const exposedTables = [...host.querySelectorAll('table')].filter(
      (candidate) => !candidate.closest('[aria-hidden="true"]'),
    );
    expect(exposedTables).toHaveLength(1);
    expect(exposedTables[0]).toBe(table);
    expect(host.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(liveRegion()).toBe(live);
    expect(liveRegion()?.textContent).toBe('2021: B, A lead');
    button().click();
    scrub().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(liveRegion()?.textContent).toBe('2022: B, A lead');

    chart.update({ ...spec, mark, a11y: { hidden: true } });
    expect(svg().getAttribute('aria-hidden')).toBe('true');
    expect(table?.isConnected).toBe(false);
    expect(liveRegion()).toBeNull();
    if (mark === 'table') {
      const visible = host.querySelector('table[aria-label="Visible standings"]');
      expect(visible?.closest('[aria-hidden="true"]')).toBeTruthy();
    }
  });

  it('clamps finite seeks and advances from the current playhead at the requested speed', () => {
    const chart = mount({
      ...spec,
      encoding: {
        ...spec.encoding,
        time: { field: 'year', type: 'quantitative', format: '.0f CE' },
      },
    });
    chart.seek(10);
    expect(chart.getState()).toMatchObject({ t: 2, ended: false });
    chart.seek(-10);
    expect(chart.getState().t).toBe(0);
    expect(() => chart.seek(NaN)).toThrow(RangeError);
    expect(() => chart.setSpeed(0)).toThrow(RangeError);
    chart.seek(0.25);
    chart.setSpeed(2);
    chart.play();
    tick(0);
    tick(500);
    expect(chart.getState()).toEqual({
      t: 1.25,
      playing: true,
      speed: 2,
      ended: false,
      period: { index: 1, value: 2021, label: '2021 CE' },
    });
    chart.pause();
    tick(750);
    expect(chart.getState()).toMatchObject({ t: 1.25, playing: false });
  });

  it('coalesces observed resizes, redraws at the running playhead and keeps the prepared model', () => {
    const prepare = vi.spyOn(engine, 'prepareRace');
    width = 800;
    height = 570;
    const chart = mount();
    expect(svg().getAttribute('viewBox')).toBe('0 0 800 526');
    chart.play();
    tick(0);
    tick(500);
    const original = svg();
    width = 420;
    resizeObservers.get(host)!();
    width = 360;
    height = 510;
    resizeObservers.get(host)!();
    expect(svg()).toBe(original);
    expect(frames.size).toBe(2);
    tick(750);
    expect(svg()).not.toBe(original);
    expect(svg().getAttribute('viewBox')).toBe('0 0 360 466');
    expect(scrub().value).toBe('0.75');
    expect(button().getAttribute('aria-label')).toBe('Pause');
    width = 680;
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 680 466');
    tick(1250);
    expect(chart.getState()).toMatchObject({ t: 1.25, playing: true });
    expect(scrub().value).toBe('1.25');
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('keeps the measured height stable when the host contains in-flow content', () => {
    height = 320;
    width = 640;
    const clientHeight = () => {
      const root = host.querySelector<HTMLElement>('.oc-race-root');
      const inFlow =
        root &&
        !['absolute', 'fixed'].includes(getComputedStyle(root).position) &&
        getComputedStyle(root).display !== 'none';
      const chartHeight = inFlow
        ? parseFloat(root.querySelector<SVGSVGElement>('svg')?.style.height ?? '0') +
          parseFloat(root.querySelector<HTMLElement>('.oc-race-controls-slot')?.style.height ?? '0')
        : 0;
      return height + chartHeight;
    };
    vi.spyOn(host, 'clientHeight', 'get').mockImplementation(clientHeight);
    vi.mocked(host.getBoundingClientRect).mockImplementation(
      () => new DOMRect(0, 0, width, clientHeight()),
    );
    const chart = mount();
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 276');
    resizeObservers.get(host)!();
    tick(0);
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 276');
    height = 360;
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 316');
  });

  it('uses the fallback height when an auto-height host only has padding', () => {
    host.style.padding = '16px';
    width = 392;
    height = 32;
    const chart = mount();
    expect(svg().getAttribute('viewBox')).toBe('0 0 360 476');
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 360 476');
  });

  it('fits the content box of a padded fixed-height host on mount and resize', () => {
    host.style.padding = '12px 16px 20px 8px';
    width = 824;
    height = 552;
    const chart = mount();
    expect(svg().getAttribute('viewBox')).toBe('0 0 800 476');
    width = 384;
    height = 452;
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 360 376');
  });

  it('checks the host font and relayouts once when the pending font loads', async () => {
    host.style.fontFamily = 'Georgia, serif';
    const fonts = stubFonts();
    const chart = mount();
    chart.seek(1.5);
    const before = svg();
    expect(before.style.getPropertyValue('--oc-font-family')).toBe('Georgia, serif');
    const observer = new MutationObserver(() => {});
    observer.observe(host, { childList: true });
    onTestFinished(() => observer.disconnect());
    expect(fonts.check).toHaveBeenCalledExactlyOnceWith('12px "Georgia"');
    fonts.resolve();
    await fonts.ready;
    const newShells = observer.takeRecords().flatMap((record) => [...record.addedNodes]);
    expect(newShells).toEqual([host.firstElementChild]);
    expect(svg()).not.toBe(before);
    expect(chart.getState()).toMatchObject({ t: 1.5, playing: false });
  });

  it('keeps its current view when the font is already loaded', async () => {
    const fonts = stubFonts(true);
    mount(spec, { theme: { fonts: { family: 'Georgia' } } });
    const before = svg();
    fonts.resolve();
    await fonts.ready;
    expect(fonts.check).toHaveBeenCalledExactlyOnceWith('12px "Georgia"');
    expect(svg()).toBe(before);
  });

  it('never rebuilds after destruction when a pending font loads', async () => {
    const fonts = stubFonts();
    const chart = mount(spec, { theme: { fonts: { family: 'Georgia' } } });
    chart.destroy();
    fonts.resolve();
    await fonts.ready;
    expect(fonts.check).toHaveBeenCalledExactlyOnceWith('12px "Georgia"');
    expect(host.children).toHaveLength(0);
  });

  it('restores keyboard focus after relayout and disconnects the old controls', () => {
    const chart = mount();
    const oldButton = button();
    const original = scrub();
    original.focus();
    chart.resize();
    expect(scrub()).not.toBe(original);
    expect(document.activeElement).toBe(scrub());
    oldButton.click();
    expect(chart.getState().playing).toBe(false);
    scrub().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(chart.getState().t).toBe(1);
    button().focus();
    chart.update({ ...spec, race: { ...spec.race, duration: 1000 } });
    expect(document.activeElement).toBe(button());
  });

  it('adopts a different top and draws at the same running playhead without resetting timing', () => {
    const chart = mount();
    chart.setSpeed(2);
    chart.play();
    tick(0);
    tick(625);
    expect(rowKeys()).toEqual(['B', 'A']);
    chart.update({ ...spec, race: { ...spec.race, top: 1 } });
    expect(chart.getState()).toMatchObject({ t: 1.25, playing: true, speed: 2 });
    expect(rowKeys()).toEqual(['B']);
    expect(scrub().value).toBe('1.25');
    expect(button().getAttribute('aria-label')).toBe('Pause');
    tick(750);
    expect(chart.getState().t).toBe(1.5);
  });

  it('clamps to the new last period, preserving speed and playing state when timing changes', () => {
    const chart = mount();
    chart.seek(1.75);
    chart.setSpeed(2);
    chart.play();
    chart.update({
      ...spec,
      data: spec.data.filter((row) => row.year !== 2022),
      race: { ...spec.race, top: 1 },
    });
    expect(chart.getState()).toEqual({
      t: 1,
      playing: true,
      speed: 2,
      ended: false,
      period: { index: 1, value: 2021, label: '2021' },
    });
    expect(scrub().value).toBe('1');
    expect(scrub().max).toBe('1');
    expect(rowKeys()).toEqual(['B']);
  });

  it('adopts a change to duration alone', () => {
    const chart = mount();
    chart.update({ ...spec, race: { ...spec.race, duration: 1000 } });
    chart.play();
    tick(0);
    tick(500);
    expect(chart.getState().t).toBe(1);
  });

  it('adopts a change to the end hold alone', () => {
    const chart = mount();
    chart.update({ ...spec, race: { ...spec.race, holdEnd: 250 } });
    chart.play();
    tick(0);
    tick(2000);
    tick(2249);
    expect(chart.getState()).toMatchObject({ t: 2, playing: true });
    tick(2250);
    expect(chart.getState()).toMatchObject({ t: 2, playing: false });
  });

  it('adopts a change to looping alone', () => {
    const chart = mount();
    chart.update({ ...spec, race: { ...spec.race, loop: true } });
    chart.play();
    tick(0);
    tick(2000);
    tick(3500);
    expect(chart.getState()).toMatchObject({ t: 0, playing: true });
  });

  it('replays from the start after natural completion and a duration update', () => {
    const chart = mount();
    chart.play();
    tick(0);
    tick(2000);
    tick(3500);
    expect(chart.getState()).toMatchObject({ t: 2, playing: false, ended: true });
    chart.update({ ...spec, race: { ...spec.race, duration: 3000 } });
    expect(chart.getState()).toMatchObject({ t: 2, playing: false, ended: true });
    button().click();
    expect(chart.getState()).toMatchObject({ t: 0, playing: true, ended: false });
    expect(rowKeys()).toEqual(['A', 'B']);
  });

  it('adopts a paused update without triggering the new spec’s autoplay setting', () => {
    const chart = mount();
    chart.seek(1.5);
    chart.update({
      ...spec,
      race: { ...spec.race, duration: 5000, autoplay: true, controls: false },
    });
    tick(2500);
    expect(chart.getState()).toMatchObject({ t: 1.5, playing: false });
    expect(host.querySelector('input, button')).toBeNull();
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 520');
  });

  it('leaves the rendered race and running clock intact when a spec or its data is rejected', () => {
    const chart = mount();
    chart.play();
    tick(0);
    tick(500);
    const initialSvg = svg();
    const initialState = chart.getState();
    expect(() => chart.update({ ...spec, race: { ...spec.race, top: 0 } })).toThrow(/top/);
    expect(() => chart.update({ ...spec, data: [...spec.data, spec.data[0]] })).toThrow(
      engine.RaceDataError,
    );
    expect(svg()).toBe(initialSvg);
    expect(chart.getState()).toEqual(initialState);
    expect(scrub().value).toBe('0.5');
    tick(1500);
    expect(chart.getState()).toMatchObject({ t: 1.5, playing: true });
    expect(rowKeys()).toEqual(['B', 'A']);
  });

  it('reports an engine mark that has no mounted renderer without inserting a partial race', () => {
    const renderer = RACE_RENDERERS.bar;
    delete RACE_RENDERERS.bar;
    try {
      expect(() => mount()).toThrow(/^Race mark "bar" is not registered\. Registered: /);
    } finally {
      RACE_RENDERERS.bar = renderer;
    }
    expect(host.children).toHaveLength(0);
    expect(frames.size).toBe(0);
  });

  it('leaves the host empty when a warning listener destroys the race during update', () => {
    const chart = mount(spec, { onWarn: () => race?.destroy() });
    chart.play();
    chart.update({ ...spec, race: { ...spec.race, top: 20 } });
    expect(host.children).toHaveLength(0);
    expect(resizeObservers.size).toBe(0);
    expect(frames.size).toBe(0);
  });

  it('draws the mount theme palette in light mode', () => {
    mount(spec, { theme: { colors: { categorical: ['#aabbaa', '#eebbee'] } } });
    expect(barFills()).toEqual(['#aabbaa', '#eebbee']);
    expect(host.querySelector('.oc-race-root.oc-dark')).toBeNull();
  });

  it('keeps existing key colors when appending a period and changing top', () => {
    const keys = Array.from({ length: 20 }, (_, index) => `Team ${index + 1}`);
    const period = (index: number, names = keys) =>
      names.map((key, order) => ({
        key,
        year: 2000 + index,
        value: names.length - ((order + 3 * index) % names.length),
      }));
    const data = keys.flatMap((_, index) => period(index));
    const initial = { ...spec, data, race: { ...spec.race, top: 10 } };
    const chart = mount(initial, {
      theme: { colors: { categorical: ['red', 'orange', 'green'] } },
    });

    function readColors() {
      const colors = new Map<string, string | null>();
      for (let t = 0; t < keys.length; t++) {
        chart.seek(t);
        for (const row of host.querySelectorAll('.oc-race-rows [data-key]:not([display="none"])')) {
          const key = row.getAttribute('data-key');
          if (key) colors.set(key, row.querySelector('rect')?.getAttribute('fill') ?? null);
        }
      }
      return colors;
    }

    const colors = readColors();
    expect([...colors.keys()].sort()).toEqual([...keys].sort());
    expect(new Set(colors.values())).toEqual(new Set(['red', 'orange', 'green']));

    const extended = { ...initial, data: [...data, ...period(keys.length, [...keys, 'New team'])] };
    chart.update(extended);
    expect(readColors()).toEqual(colors);
    chart.update({ ...extended, race: { ...extended.race, top: 8 } });
    expect(readColors()).toEqual(colors);
  });

  it('maps the default palette to dark variants in forced dark mode', () => {
    mount(spec, { darkMode: 'force' });
    expect(host.querySelector('.oc-race-root')?.classList.contains('oc-dark')).toBe(true);
    expect(barFills()).toEqual(adaptTheme(DEFAULT_THEME).colors.categorical.slice(0, 2));
    expect(barFills()).not.toEqual(DEFAULT_THEME.colors.categorical.slice(0, 2));
  });

  it('keeps mount options on resize and accepts new theme options on remount', () => {
    const options: RaceMountOptions = { darkMode: 'off' };
    const chart = mount(spec, options);
    const initialFills = barFills();
    options.darkMode = 'force';
    options.theme = { colors: { categorical: ['#aabbaa', '#eebbee'] } };
    chart.resize();
    expect(barFills()).toEqual(initialFills);
    expect(host.querySelector('.oc-race-root.oc-dark')).toBeNull();
    chart.destroy();
    mount(spec, options);
    expect(barFills()).toEqual(['#aabbaa', '#eebbee']);
    expect(host.querySelector('.oc-race-root.oc-dark')).not.toBeNull();
  });

  it('applies a spec theme update at the current playhead', () => {
    const chart = mount();
    chart.seek(1);
    chart.update({ ...spec, theme: { colors: { categorical: ['#aabbaa', '#eebbee'] } } });
    expect(chart.getState()).toMatchObject({ t: 1, playing: false });
    expect(barFills()).toEqual(['#eebbee', '#aabbaa']);
  });

  it('leaves one race and one observer of each kind after a StrictMode-style remount', () => {
    const intersection = observeVisibility();
    const visibleSpec: RaceSpec = { ...spec, race: { ...spec.race, autoplay: 'visible' } };
    const first = mount(visibleSpec);
    first.destroy();
    const second = mount(visibleSpec);
    expect(host.querySelectorAll('.oc-race-root')).toHaveLength(1);
    expect([...intersection.observed]).toEqual([host]);
    expect(intersection.created - intersection.disconnected).toBe(1);
    expect(activeResizeObservers.size).toBe(1);
    intersection.fire(host, 1);
    expect(first.getState().playing).toBe(false);
    expect(second.getState().playing).toBe(true);
    expect(frames.size).toBe(1);
  });

  it('clears a pending visibility start and resize without removing host content', () => {
    const intersection = observeVisibility();
    const sibling = document.createElement('span');
    host.append(sibling);
    const chart = mount({ ...spec, race: { ...spec.race, autoplay: 'visible' } });
    expect(intersection.observed.has(host)).toBe(true);
    width = 360;
    resizeObservers.get(host)!();
    expect(frames.size).toBe(1);
    chart.destroy();
    expect(intersection.observed.has(host)).toBe(false);
    expect(resizeObservers.has(host)).toBe(false);
    expect(frames.size).toBe(0);
    intersection.fire(host, 1);
    tick(500);
    expect(Array.from(host.children)).toEqual([sibling]);
    expect(chart.getState()).toMatchObject({ t: 0, playing: false });
  });

  it('stops playback, detaches controls, and ignores calls after being destroyed', () => {
    const chart = mount();
    const oldButton = button();
    chart.play();
    tick(0);
    tick(500);
    chart.destroy();
    chart.destroy();
    oldButton.click();
    chart.play();
    chart.pause();
    chart.seek(2);
    chart.setSpeed(2);
    chart.update({ ...spec, data: [] });
    chart.resize();
    expect(() => chart.seek(NaN)).toThrow(RangeError);
    expect(() => chart.setSpeed(NaN)).toThrow(RangeError);
    expect(() => chart.setSpeed(0)).toThrow(RangeError);
    expect(frames.size).toBe(0);
    tick(2000);
    expect(host.children).toHaveLength(0);
    expect(chart.getState()).toMatchObject({ t: 0.5, speed: 1, playing: false });
  });

  it('rejects GIF export after the race is destroyed', async () => {
    const chart = mount();
    chart.destroy();
    await expect(chart.export('gif')).rejects.toThrow(
      new Error('Race was destroyed during GIF export'),
    );
  });
});

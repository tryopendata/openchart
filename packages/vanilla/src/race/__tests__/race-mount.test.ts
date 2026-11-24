import type { RaceSpec } from '@opendata-ai/openchart-core';
import * as engine from '@opendata-ai/openchart-engine';
import type { Window as HappyWindow } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeObserver, stubPageLayout } from '../../__test-fixtures__/visibility';
import { createRace, type RaceInstance, type RaceMountOptions } from '../../race-mount';
import { setObserverFactory } from '../../visibility';

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

class TestResizeObserver extends ResizeObserver {
  private target?: Element;

  constructor(private readonly deliver: ResizeObserverCallback) {
    super(deliver);
  }

  override observe(target: Element) {
    this.target = target;
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

function observeVisibility() {
  const intersection = createFakeObserver();
  stubPageLayout();
  setObserverFactory(intersection.factory);
  return intersection;
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

  it('clamps finite seeks and advances from the current playhead at the requested speed', () => {
    const chart = mount({
      ...spec,
      encoding: {
        ...spec.encoding,
        time: { field: 'year', type: 'quantitative', format: '.0f CE' },
      },
    });
    chart.seek(10);
    expect(chart.getState().t).toBe(2);
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
    vi.mocked(host.getBoundingClientRect).mockImplementation(() => {
      const root = host.querySelector<HTMLElement>('.oc-race-root');
      const inFlow =
        root &&
        !['absolute', 'fixed'].includes(getComputedStyle(root).position) &&
        getComputedStyle(root).display !== 'none';
      const chartHeight = inFlow
        ? parseFloat(root.querySelector<SVGSVGElement>('svg')?.style.height ?? '0') +
          parseFloat(root.querySelector<HTMLElement>('.oc-race-controls-slot')?.style.height ?? '0')
        : 0;
      return new DOMRect(0, 0, 640, height + chartHeight);
    });
    const chart = mount();
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 276');
    resizeObservers.get(host)!();
    tick(0);
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 276');
    height = 360;
    chart.resize();
    expect(svg().getAttribute('viewBox')).toBe('0 0 640 316');
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
    expect(chart.getState()).toMatchObject({ t: 2, playing: false });
    chart.update({ ...spec, race: { ...spec.race, duration: 3000 } });
    expect(chart.getState()).toMatchObject({ t: 2, playing: false });
    button().click();
    expect(chart.getState()).toMatchObject({ t: 0, playing: true });
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

  it('reports an unregistered mark without mounting a partial race', () => {
    expect(() => mount({ ...spec, mark: 'line' })).toThrow(/race mark "line".*not registered/i);
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

  it('applies the dark class and draws bar fills from the mount theme palette', () => {
    mount(spec, {
      darkMode: 'force',
      theme: { colors: { categorical: ['#aabbaa', '#eebbee'] } },
    });
    expect(host.querySelector('.oc-race-root')?.classList.contains('oc-dark')).toBe(true);
    const fills = Array.from(host.querySelectorAll('.oc-race-rows rect'), (bar) =>
      bar.getAttribute('fill'),
    );
    expect(fills).toEqual(['#aabbaa', '#eebbee']);
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
    chart.setSpeed(NaN);
    chart.update({ ...spec, data: [] });
    chart.resize();
    expect(() => chart.seek(NaN)).toThrow(RangeError);
    expect(frames.size).toBe(0);
    tick(2000);
    expect(host.children).toHaveLength(0);
    expect(chart.getState()).toMatchObject({ t: 0.5, speed: 1, playing: false });
  });

  it('rejects GIF export with the phase 5 message', async () => {
    await expect(mount().export('gif')).rejects.toThrow('GIF export arrives in a later release');
  });
});

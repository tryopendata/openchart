/**
 * Entrance cleanup on real completion (F5).
 *
 * In browsers, cleanup waits a frame, then awaits every animation's
 * `finished`. happy-dom has no `Element.getAnimations`, so the real path is
 * exercised with a stub and the fallback (a timer at the choreography table's
 * end plus a pad) runs as-is.
 */

import {
  type ChartSpec,
  clampStaggerDelay,
  entranceTiming,
  type GeoMapSpec,
} from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { columnSpec } from '../__test-fixtures__/specs';
import {
  computeAnimationDuration,
  scanEntrance,
  scanEntranceEndMs,
  setupAnimationCleanup,
} from '../animation';
import { createGeoMap } from '../map-mount';
import { renderChartSVG } from '../svg-renderer';

const FRAME_MS = 16;

/** A controllable `Animation.finished`. */
function deferred() {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeAnimation(finished: Promise<void>): Animation {
  return {
    finished,
    effect: { getTiming: () => ({ iterations: 1 }) },
  } as unknown as Animation;
}

/** Stub getAnimations on every Element, returning what `source()` yields. */
function stubGetAnimations(source: () => Animation[]) {
  const calls = { count: 0 };
  Object.defineProperty(Element.prototype, 'getAnimations', {
    configurable: true,
    value() {
      calls.count++;
      return source();
    },
  });
  return calls;
}

function removeGetAnimations() {
  delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
}

async function flushMicrotasks() {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function animatedSVG(spec: ChartSpec = { ...columnSpec, animation: true }): SVGElement {
  const layout = compileChart(spec, { width: 600, height: 400 });
  return renderChartSVG(layout, createContainer(), { animate: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(0), FRAME_MS),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});

afterEach(() => {
  removeGetAnimations();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('setupAnimationCleanup with getAnimations', () => {
  it('collects animations a frame after setup, not synchronously', () => {
    const calls = stubGetAnimations(() => []);
    const svg = animatedSVG();
    setupAnimationCleanup(svg);
    expect(calls.count).toBe(0);
    vi.advanceTimersByTime(FRAME_MS);
    expect(calls.count).toBe(1);
  });

  it('waits for a late-starting animation, well past any estimate', async () => {
    // A busy page started the CSS late: its finished resolves long after the
    // table's end + pad would have fired.
    const late = deferred();
    stubGetAnimations(() => [fakeAnimation(Promise.resolve()), fakeAnimation(late.promise)]);
    const svg = animatedSVG();
    const onComplete = vi.fn();
    setupAnimationCleanup(svg, { onComplete });

    vi.advanceTimersByTime(computeAnimationDuration(svg) * 4);
    await flushMicrotasks();
    expect(onComplete).not.toHaveBeenCalled();
    expect(svg.classList.contains('oc-animate')).toBe(true);

    late.resolve();
    await flushMicrotasks();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(svg.classList.contains('oc-animate')).toBe(false);
  });

  it('holds a map with many points until its last point finishes', async () => {
    const points = Array.from({ length: 60 }, (_, i) => ({
      lat: 30 + (i % 10),
      lon: -120 + i,
      name: `P${i}`,
      value: i + 1,
    }));
    const spec: GeoMapSpec = {
      type: 'map',
      geo: { features: MAP_TOPO, projection: 'mercator' },
      data: [],
      encoding: { key: { field: 'id', type: 'nominal' } },
      points: {
        data: points,
        longitude: { field: 'lon', type: 'quantitative' },
        latitude: { field: 'lat', type: 'quantitative' },
        key: { field: 'name', type: 'nominal' },
      },
      animation: true,
    };
    // Each element finishes at its own choreography end, as the browser would.
    let lastEnd = 0;
    stubGetAnimations(() => {
      const svg = document.querySelector('svg.oc-map') as SVGElement;
      return scanEntrance(svg).elements.map((e) => {
        const scan = scanEntrance(svg);
        const t = entranceTiming(
          e.role,
          e.index,
          { duration: scan.durationMs! },
          { ...scan.context, ...e.context },
        );
        lastEnd = Math.max(lastEnd, t.delayMs + t.durationMs);
        return fakeAnimation(
          new Promise<void>((resolve) => setTimeout(resolve, t.delayMs + t.durationMs)),
        );
      });
    });
    const container = createContainer();
    const instance = createGeoMap(container, spec, { autoResize: false });
    const svg = container.querySelector('svg.oc-map') as SVGElement;
    expect(svg.querySelectorAll('.oc-map-point')).toHaveLength(60);

    vi.advanceTimersByTime(FRAME_MS);
    const lastPoint = entranceTiming(
      'map-point',
      59,
      { duration: 500 },
      {
        pointStaggerMs: clampStaggerDelay(80, 60),
      },
    );
    // The feature sweep (a 540ms budget) can end after the points; either way
    // cleanup must hold until the last real finish.
    expect(lastEnd).toBeGreaterThanOrEqual(lastPoint.delayMs + lastPoint.durationMs);

    // The stub starts each animation when collected, one frame in.
    vi.advanceTimersByTime(lastEnd - 1);
    await flushMicrotasks();
    expect(svg.classList.contains('oc-animate')).toBe(true);
    vi.advanceTimersByTime(2);
    await flushMicrotasks();
    expect(svg.classList.contains('oc-animate')).toBe(false);
    instance.destroy();
  });

  it('awaits canvasFinished alongside the CSS', async () => {
    stubGetAnimations(() => []);
    const canvas = deferred();
    const onComplete = vi.fn();
    setupAnimationCleanup(animatedSVG(), { onComplete, canvasFinished: canvas.promise });
    vi.advanceTimersByTime(FRAME_MS);
    await flushMicrotasks();
    expect(onComplete).not.toHaveBeenCalled();
    canvas.resolve();
    await flushMicrotasks();
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('cancel never calls onComplete and leaves no unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const pending = deferred();
      stubGetAnimations(() => [fakeAnimation(pending.promise)]);
      const svg = animatedSVG();
      const onComplete = vi.fn();
      const cancel = setupAnimationCleanup(svg, { onComplete });
      vi.advanceTimersByTime(FRAME_MS);
      cancel();
      expect(svg.classList.contains('oc-animate')).toBe(false);
      // Removing oc-animate cancels the CSS animations: finished rejects.
      pending.reject(new DOMException('The animation was aborted', 'AbortError'));
      await flushMicrotasks();
      vi.advanceTimersByTime(10_000);
      await flushMicrotasks();
      // Let Node's unhandled-rejection tracking run.
      vi.useRealTimers();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onComplete).not.toHaveBeenCalled();
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('cancel before the first frame skips collection entirely', () => {
    const calls = stubGetAnimations(() => []);
    const onComplete = vi.fn();
    const cancel = setupAnimationCleanup(animatedSVG(), { onComplete });
    cancel();
    vi.advanceTimersByTime(1000);
    expect(calls.count).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
  it('cancel without requestAnimationFrame clears both the collect and the totalMs timers', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    stubGetAnimations(() => []);
    const before = vi.getTimerCount();
    const cancel = setupAnimationCleanup(animatedSVG(), { totalMs: 5000 });
    expect(vi.getTimerCount()).toBe(before + 2);
    cancel();
    expect(vi.getTimerCount()).toBe(before);
  });
});

describe('setupAnimationCleanup fallback (no getAnimations)', () => {
  it('fires at the choreography end plus the 500ms pad', () => {
    const svg = animatedSVG();
    const end = scanEntranceEndMs(scanEntrance(svg));
    // The column chart's last bar: (n - 1) * stagger + duration.
    const bars = svg.querySelectorAll('.oc-mark-rect').length;
    const stagger = parseFloat(svg.style.getPropertyValue('--oc-animation-stagger'));
    const duration = parseFloat(svg.style.getPropertyValue('--oc-animation-duration'));
    expect(end).toBeGreaterThanOrEqual((bars - 1) * stagger + duration);
    expect(computeAnimationDuration(svg)).toBe(end + 500);

    const onComplete = vi.fn();
    setupAnimationCleanup(svg, { onComplete });
    vi.advanceTimersByTime(end + 499);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(svg.classList.contains('oc-animate')).toBe(false);
  });

  it('counts the last map point, which the old element-count estimate missed', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'oc-map oc-animate');
    svg.style.setProperty('--oc-animation-duration', '450ms');
    svg.style.setProperty('--oc-animation-stagger', '0ms');
    svg.style.setProperty('--oc-point-stagger', `${clampStaggerDelay(80, 200)}ms`);
    for (let i = 0; i < 200; i++) {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('class', 'oc-map-point');
      c.style.setProperty('--oc-mark-index', String(i));
      svg.appendChild(c);
    }
    const last = entranceTiming(
      'map-point',
      199,
      { duration: 450 },
      {
        pointStaggerMs: clampStaggerDelay(80, 200),
      },
    );
    expect(computeAnimationDuration(svg)).toBeCloseTo(last.delayMs + last.durationMs + 500, 6);
  });

  it('uses totalMs when given (canvas mark mode)', () => {
    const onComplete = vi.fn();
    setupAnimationCleanup(animatedSVG(), { onComplete, totalMs: 3000 });
    vi.advanceTimersByTime(2999);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('uses the 300ms table pad for tables', () => {
    const wrapper = document.createElement('div');
    wrapper.className = 'oc-table-wrapper oc-animate';
    wrapper.style.setProperty('--oc-animation-duration', '500ms');
    wrapper.style.setProperty('--oc-animation-stagger', '20ms');
    wrapper.innerHTML = '<table><tbody><tr><td>a</td></tr><tr><td>b</td></tr></tbody></table>';
    wrapper.querySelectorAll('tr').forEach((tr, i) => {
      tr.style.setProperty('--oc-row-index', String(i));
    });
    // Rows: 20 + 500 = 520 is the latest end (cells end at 20 + 250).
    expect(scanEntranceEndMs(scanEntrance(wrapper))).toBe(520);
    const onComplete = vi.fn();
    setupAnimationCleanup(wrapper, { onComplete, fallbackPadMs: 300 });
    vi.advanceTimersByTime(819);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});

describe('entrance scan', () => {
  it('starts each bar label with its bar, on the bar duration, riding from the baseline', () => {
    const svg = animatedSVG({ ...columnSpec, animation: true, labels: { density: 'all' } });
    const scan = scanEntrance(svg);
    const labels = scan.elements.filter((e) => e.role === 'label');
    const bars = scan.elements.filter((e) => e.role === 'bar');
    expect(labels.length).toBeGreaterThan(1);
    const phase = { duration: scan.durationMs! };
    for (const label of labels) {
      const bar = bars.find((b) => b.index === label.index)!;
      const lt = entranceTiming('label', label.index, phase, { ...scan.context, ...label.context });
      const bt = entranceTiming('bar', bar.index, phase, { ...scan.context, ...bar.context });
      expect(lt.delayMs).toBe(bt.delayMs);
      expect(lt.durationMs).toBe(bt.durationMs);
      expect(lt.fadeMs).toBe(140);
      expect(label.el.style.getPropertyValue('--oc-label-from')).toMatch(/^0px, [\d.]+px$/);
    }
  });
});

// Identity-quantized three-state topology (same shape as map.test.ts).
const MAP_TOPO = {
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
} as unknown as GeoMapSpec['geo']['features'];

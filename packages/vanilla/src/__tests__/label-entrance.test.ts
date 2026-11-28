/**
 * Bar value labels wait for their bar: they fade in place once the bar at
 * their own stagger index has landed (0.995), and never ride the bar. A bar
 * that enters on a data update holds its label back the same way.
 */

import type { ChartSpec } from '@opendata-ai/openchart-core';
import { entranceTiming, progressTimeMs } from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer } from '../__test-fixtures__/dom';
import { rectMarkGeometry } from '../__test-fixtures__/rect-geometry';
import { scanEntrance } from '../animation';
import { createChart } from '../mount';
import { renderChartSVG } from '../svg-renderer';
import { runTransition } from '../transition';

const TEAMS = [
  { label: 'Engineering', value: 142 },
  { label: 'Product', value: 118 },
  { label: 'Sales', value: 96 },
  { label: 'Design', value: 71 },
  { label: 'Support', value: 44 },
];

function horizontalBars(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'bar',
    data: TEAMS,
    encoding: {
      x: { field: 'value', type: 'quantitative' },
      y: { field: 'label', type: 'nominal' },
    },
    labels: true,
    animation: true,
    ...overrides,
  } as ChartSpec;
}

function render(spec: ChartSpec): SVGElement {
  const layout = compileChart(spec, { width: 640, height: 400 });
  return renderChartSVG(layout, createContainer(), { animate: true });
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('bar value label entrance', () => {
  it('stamps no ride offset', () => {
    const svg = render(horizontalBars());
    const labels = svg.querySelectorAll<SVGElement>('.oc-mark-label');
    expect(labels.length).toBe(TEAMS.length);
    for (const label of labels) {
      expect(label.style.getPropertyValue('--oc-label-from')).toBe('');
    }
  });

  it('starts each label after its own bar has landed (0.995)', () => {
    const svg = render(horizontalBars());
    const scan = scanEntrance(svg);
    const phase = { duration: scan.durationMs ?? 800, ease: 'smooth' as const };
    const labels = scan.elements.filter((e) => e.role === 'label');
    expect(labels).toHaveLength(TEAMS.length);
    for (const label of labels) {
      const { delayMs } = entranceTiming('label', label.index, phase, label.context);
      const barLands = progressTimeMs('bar', label.index, phase, scan.context, 0.995);
      expect(delayMs).toBeGreaterThanOrEqual(barLands - 1e-6);
      expect(label.keyframe).toBe('oc-enter-fade-only');
    }
  });

  it('gives faceted labels the stagger index of their own bar', () => {
    const svg = render(
      horizontalBars({
        data: TEAMS.flatMap((t) => [
          { ...t, panel: 'P1' },
          { ...t, panel: 'P2', value: t.value + 10 },
        ]),
        encoding: {
          ...horizontalBars().encoding,
          facet: { field: 'panel', type: 'nominal' },
        },
      } as Partial<ChartSpec>),
    );
    const panels = svg.querySelectorAll('.oc-facet-panel');
    expect(panels).toHaveLength(2);
    let checked = 0;
    for (const panel of panels) {
      const barIndex = new Map<string, string>();
      for (const g of panel.querySelectorAll<SVGElement>('.oc-mark-rect[data-key]')) {
        barIndex.set(g.getAttribute('data-key')!, g.style.getPropertyValue('--oc-mark-index'));
      }
      for (const label of panel.querySelectorAll<SVGElement>('.oc-mark-label')) {
        const key = label.getAttribute('data-label-key')!;
        expect(barIndex.has(key)).toBe(true);
        expect(label.style.getPropertyValue('--oc-mark-index')).toBe(barIndex.get(key));
        checked++;
      }
    }
    expect(checked).toBe(TEAMS.length * 2);
  });
});

const MONTHS = [
  { month: 'Jan', jobs: 353 },
  { month: 'Feb', jobs: 275 },
  { month: 'Mar', jobs: 303 },
];

function columns(count: number): ChartSpec {
  return {
    mark: 'bar',
    data: MONTHS.slice(0, count),
    encoding: {
      x: { field: 'month', type: 'ordinal' },
      y: { field: 'jobs', type: 'quantitative', scale: { domain: [0, 400] } },
    },
    labels: { density: 'all' },
    animation: { enter: false, update: true },
  };
}

describe('label of a bar that enters on a data update', () => {
  const label = (container: HTMLElement, month: string) =>
    [...container.querySelectorAll<SVGElement>('.oc-mark-label[data-label-key]')].find((el) =>
      el.getAttribute('data-label-key')!.endsWith(month),
    )!;
  const barHeight = (container: HTMLElement, month: string) =>
    rectMarkGeometry(
      [...container.querySelectorAll('.oc-mark-rect[data-key]')].find((el) =>
        el.getAttribute('data-key')!.endsWith(month),
      )!,
    )!.height;

  it('stays hidden until the bar has landed, then fades in', () => {
    const container = createContainer();
    const chart = createChart(container, columns(2));
    const handle = chart.beginManualUpdate(columns(3))!;
    const total = handle.totalMs;

    // From-state: the new bar has not grown, so its label is not shown yet.
    expect(label(container, 'Mar').style.opacity).toBe('0');
    expect(label(container, 'Jan').style.opacity).toBe('');

    handle.step(total);
    const finalHeight = barHeight(container, 'Mar');
    expect(label(container, 'Mar').style.opacity).toBe('');

    let fading = 0;
    for (let ms = 0; ms < total; ms += total / 60) {
      handle.step(ms);
      const opacity = Number(label(container, 'Mar').style.opacity || 1);
      if (opacity > 0) {
        fading++;
        expect(barHeight(container, 'Mar')).toBeGreaterThan(finalHeight * 0.99);
      }
      expect(label(container, 'Jan').style.opacity).toBe('');
    }
    // The fade has frames of its own rather than popping in on the last one.
    expect(fading).toBeGreaterThan(2);
    handle.cancel();
    expect(label(container, 'Mar').style.opacity).toBe('');
    chart.destroy();
  });

  it('keeps waiting when a second update interrupts the first', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {});
    const pump = (now: number) => {
      for (const cb of frames.splice(0)) cb(now);
    };
    const size = { width: 640, height: 400 };
    const two = compileChart(columns(2), size);
    const three = compileChart(columns(3), size);
    const animation = three.animation!;

    const first = createContainer();
    const running = runTransition({
      svg: renderChartSVG(three, first) as SVGSVGElement,
      prevLayout: two,
      nextLayout: three,
      animation,
      onComplete: () => {},
    });
    pump(0);
    pump(100);
    expect(label(first, 'Mar').style.opacity).toBe('0');
    const fromSnapshot = running.snapshot();
    running.cancel();

    // The interrupting render: March is a survivor now, still growing from
    // where the snapshot caught it, so its label must not pop in.
    const second = createContainer();
    const resumed = runTransition({
      svg: renderChartSVG(three, second) as SVGSVGElement,
      prevLayout: three,
      nextLayout: three,
      animation,
      onComplete: () => {},
      fromSnapshot,
    });
    expect(label(second, 'Mar').style.opacity).toBe('0');
    expect(label(second, 'Jan').style.opacity).toBe('');
    resumed.cancel();
    expect(label(second, 'Mar').style.opacity).toBe('');
    vi.unstubAllGlobals();
  });
});

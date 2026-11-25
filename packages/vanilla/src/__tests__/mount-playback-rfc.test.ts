/**
 * RFC 4.4 mount behavior for playback charts: tooltips, layout readers and exports at the
 * playhead, manual updates, and how updates carry or reset the run.
 */
import type { ChartSpec, DataRow, PointMark } from '@opendata-ai/openchart-core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createFakeObserver, stubPageLayout } from '../__test-fixtures__/visibility';
import { createChart } from '../mount';
import { createFakePlayback } from '../playback/__tests__/fake-playback';
import { carriedPlayhead } from '../playback/chart-update';
import { setObserverFactory } from '../visibility';

const COUNTRIES = ['Avalon', 'Borea', 'Cydonia'];

function rows(years = [2000, 2001, 2002]): DataRow[] {
  return COUNTRIES.flatMap((country, index) =>
    years.map((year) => ({
      country,
      region: index === 2 ? 'South' : 'North',
      year,
      gdp: (100 + 50 * index) * (year - 1990),
      life: 50 + index * 5 + (year - 2000),
    })),
  );
}

function timeSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    mark: 'point',
    data: rows(),
    encoding: {
      x: { field: 'gdp', type: 'quantitative' },
      y: { field: 'life', type: 'quantitative' },
      color: { field: 'region', type: 'nominal' },
      key: { field: 'country', type: 'nominal' },
      time: { field: 'year', type: 'temporal' },
    },
    ...overrides,
  };
}

/** Same rows keyed by region: an incompatible update. */
function regionKeyedSpec(overrides: Partial<ChartSpec> = {}): ChartSpec {
  const spec = timeSpec(overrides);
  return {
    ...spec,
    data: (spec.data as DataRow[]).filter((row) => row.country !== 'Borea'),
    encoding: { ...spec.encoding, key: { field: 'region', type: 'nominal' } },
  };
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
});

function mount(spec: ChartSpec) {
  const container = createContainer(640, 480);
  const chart = createChart(container, spec, { autoResize: false });
  cleanup.push(() => chart.destroy());
  const controller = chart.playback;
  if (!controller) throw new Error('expected a playback controller');
  return { container, chart, controller };
}

const tooltipText = (container: HTMLElement) =>
  container.querySelector('.oc-tooltip')?.textContent ?? '';

/** cx of each keyed circle in `root`, by key. */
function circlePositions(root: ParentNode): Record<string, string | null> {
  const positions: Record<string, string | null> = {};
  for (const circle of root.querySelectorAll('circle[data-key]')) {
    positions[circle.getAttribute('data-key') as string] = circle.getAttribute('cx');
  }
  return positions;
}

function avalonCx(layout: { marks: unknown[] }): number | undefined {
  const marks = layout.marks as PointMark[];
  return marks.find((mark) => mark.type === 'point' && mark.key === 'Avalon')?.cx;
}

describe('playback tooltips', () => {
  it('reads the hovered key at the playhead and follows it', () => {
    const { container, controller } = mount(timeSpec({ animation: false }));
    controller.seek(0);
    const avalon = container.querySelector('[data-key="Avalon"]') as Element;
    avalon.dispatchEvent(createMouseEvent('mouseover', 100, 100));
    expect(tooltipText(container)).toContain('2000');
    controller.seek(2);
    expect(tooltipText(container)).toContain('2002');
  });

  it('reads the keyboard-focused key at the playhead', () => {
    const { container, controller } = mount(timeSpec({ animation: false }));
    controller.seek(1);
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tooltipText(container)).toContain('2001');
    expect(tooltipText(container)).not.toContain('2002');
  });
});

describe('reading a playback chart', () => {
  it('reports the marks at the playhead from layout and sampleLayout', () => {
    const { container, chart, controller } = mount(timeSpec({ animation: false }));
    const finalCx = avalonCx(chart.layout);
    controller.seek(0);
    const openingCx = avalonCx(chart.layout);
    expect(openingCx).not.toBe(finalCx);
    expect(String(openingCx)).toBe(circlePositions(container).Avalon);
    expect(avalonCx(chart.sampleLayout())).toBe(openingCx);
  });

  it('exports the frame on screen as SVG', () => {
    const { container, chart, controller } = mount(timeSpec({ animation: false }));
    controller.seek(0);
    const exported = new DOMParser().parseFromString(String(chart.export('svg')), 'image/svg+xml');
    expect(circlePositions(exported)).toEqual(circlePositions(container));
  });

  const exportedKeys = (chart: ReturnType<typeof createChart>) =>
    Object.keys(
      circlePositions(
        new DOMParser().parseFromString(String(chart.export('svg')), 'image/svg+xml'),
      ),
    ).sort();

  it('leaves keys not yet present out of the exported frame and layout', () => {
    const lateCydonia = rows().filter((row) => !(row.country === 'Cydonia' && row.year === 2000));
    const { chart, controller } = mount(timeSpec({ animation: false, data: lateCydonia }));
    controller.seek(0);
    expect(exportedKeys(chart)).toEqual(['Avalon', 'Borea']);
    expect(
      chart.layout.marks
        .filter((mark) => mark.type === 'point')
        .map((mark) => mark.key)
        .sort(),
    ).toEqual(['Avalon', 'Borea']);
    controller.seek(2);
    expect(exportedKeys(chart)).toEqual(['Avalon', 'Borea', 'Cydonia']);
  });

  it('leaves a hidden series out of the exported frame', () => {
    const { container, chart } = mount(timeSpec({ animation: false }));
    container
      .querySelector('[data-legend-label="South"]')
      ?.dispatchEvent(createMouseEvent('click', 10, 10));
    expect(exportedKeys(chart)).toEqual(['Avalon', 'Borea']);
  });
});

describe('toggling a series on a playback chart', () => {
  const ticks = (container: HTMLElement) =>
    [...container.querySelectorAll('.oc-axis-tick')].map((tick) => tick.textContent);
  const shown = (container: HTMLElement) =>
    [...container.querySelectorAll<SVGElement>('circle[data-key]')]
      .filter((circle) => circle.style.display !== 'none')
      .map((circle) => circle.getAttribute('data-key'))
      .sort();
  const fills = (container: HTMLElement) =>
    Object.fromEntries(
      [...container.querySelectorAll('circle[data-key]')].map((circle) => [
        circle.getAttribute('data-key'),
        circle.getAttribute('fill'),
      ]),
    );
  const toggle = (container: HTMLElement, series: string) =>
    container
      .querySelector(`[data-legend-label="${series}"]`)
      ?.dispatchEvent(createMouseEvent('click', 10, 10));

  it('hides the series keys without re-freezing, and shows them again', () => {
    const { container, chart, controller } = mount(timeSpec({ animation: false }));
    const axes = chart.layout.axes;
    const tickText = ticks(container);
    const { Avalon, Borea } = fills(container);
    controller.seek(1);

    toggle(container, 'South');
    expect(shown(container)).toEqual(['Avalon', 'Borea']);
    expect(chart.layout.axes).toBe(axes);
    expect(ticks(container)).toEqual(tickText);
    expect(fills(container)).toMatchObject({ Avalon, Borea });
    expect(
      container.querySelector('[data-legend-label="South"]')?.getAttribute('data-legend-active'),
    ).toBe('false');
    expect(controller.getState().t).toBe(1);

    toggle(container, 'South');
    expect(shown(container)).toEqual(['Avalon', 'Borea', 'Cydonia']);
    expect(chart.layout.axes).toBe(axes);
  });
});

describe('updating a playback chart', () => {
  it('pauses for a manual update and returns no transition', () => {
    const { chart, controller } = mount(timeSpec());
    controller.play();
    expect(chart.beginManualUpdate(timeSpec({ data: rows([2000, 2001, 2002, 2003]) }))).toBe(null);
    expect(controller.getState().playing).toBe(false);
    expect(chart.playback).toBe(controller);
    // The update applied: the fourth period exists now.
    controller.seek(3);
    expect(controller.getState().period.label).toContain('2003');
  });

  it('keeps the same period value when a compatible update changes the period list', () => {
    const { chart, controller } = mount(timeSpec());
    controller.seek(2);
    chart.update(timeSpec({ data: rows([2000, 2002]) }));
    expect(controller.getState()).toMatchObject({ t: 1 });
    expect(controller.getState().period.label).toContain('2002');
  });

  it('keeps the controller and its listeners through an incompatible update', () => {
    const { chart, controller } = mount(timeSpec());
    const periods: string[] = [];
    controller.on('period', (period) => periods.push(period.label));
    controller.seek(1);
    chart.update(regionKeyedSpec());
    expect(chart.playback).toBe(controller);
    expect(controller.getState().t).toBe(0);
    controller.seek(2);
    // The reset back to the first period is reported too.
    expect(periods).toEqual(['2001', '2000', '2002']);
  });

  it('tells listeners the period an incompatible update opens on', () => {
    const years = [2000, 2001, 2002, 2003];
    const { chart, controller } = mount(timeSpec({ data: rows(years) }));
    const periods: string[] = [];
    controller.on('period', (period) => periods.push(period.label));
    controller.seek(2);
    chart.update(regionKeyedSpec({ data: rows(years), animation: false }));
    expect(periods).toEqual(['2002', '2003']);
  });

  it('moves the playhead for a data change without announcing it', () => {
    const { container, chart, controller } = mount(timeSpec({ animation: false }));
    chart.update(timeSpec({ animation: false, data: rows([1999, 2000, 2001, 2002]) }));
    expect(controller.getState().period.label).toContain('2002');
    const liveRegions = [...container.querySelectorAll('[aria-live]')];
    expect(liveRegions.map((region) => region.textContent)).toEqual(liveRegions.map(() => ''));
  });

  it('opens an incompatible update on the final period when autoplay is off', () => {
    const playback = { autoplay: false } as const;
    const { chart, controller } = mount(timeSpec({ playback }));
    controller.seek(1);
    chart.update(regionKeyedSpec({ playback }));
    expect(controller.getState()).toMatchObject({ t: 2, playing: false });
  });

  it('gives a new controller when time is removed and added back', () => {
    const { chart, controller } = mount(timeSpec());
    const { time: _time, ...encoding } = timeSpec().encoding as Record<string, unknown>;
    chart.update({ ...timeSpec(), encoding } as ChartSpec);
    expect(chart.playback).toBeNull();
    chart.update(timeSpec());
    expect(chart.playback).not.toBeNull();
    expect(chart.playback).not.toBe(controller);
  });
});

describe('autoplay waiting to be seen', () => {
  let fake: ReturnType<typeof createFakeObserver>;
  let layout: ReturnType<typeof stubPageLayout>;
  beforeEach(() => {
    fake = createFakeObserver();
    setObserverFactory(fake.factory);
    layout = stubPageLayout();
  });
  afterEach(() => {
    setObserverFactory(null);
    layout.mockRestore();
  });

  it('still starts when seen after an update moved the playhead', () => {
    const { container, chart, controller } = mount(timeSpec());
    chart.update(timeSpec({ data: rows([1999, 2000, 2001, 2002]) }));
    expect(controller.getState()).toMatchObject({ t: 1, playing: false });
    fake.fire(container, 0.5, 200);
    expect(controller.getState().playing).toBe(true);
  });
});

describe('carrying the playhead across a period list change', () => {
  const withPeriods = (values: number[]) => ({
    ...createFakePlayback(),
    periods: values.map((value) => ({ value, sortKey: value })),
  });
  const previous = withPeriods([2000, 2001, 2002]);

  it.each([
    ['the same value at a new index', [1999, 2000, 2001, 2002], 1, 2],
    ['the progress toward the next period', [1999, 2000, 2001, 2002], 1.25, 2.25],
    ['the nearest sort key when the value is gone', [1990, 2003, 2010], 1, 1],
    ['the last period when the list ends earlier', [1980, 1985], 2, 1],
    ['0 when the new list is empty', [], 1, 0],
  ])('lands on %s', (_case, next, t, expected) => {
    expect(carriedPlayhead(previous, withPeriods(next), t)).toBe(expected);
  });
});

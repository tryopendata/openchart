import type { ChartSpec, DataRow } from '@opendata-ai/openchart-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createContainer, createMouseEvent } from '../__test-fixtures__/dom';
import { createChart } from '../mount';
import { renderStaticSVG } from '../static';

const YEARS = [2000, 2001, 2002];

function rows(scale = 1): DataRow[] {
  return ['Avalon', 'Borea', 'Cydonia'].flatMap((country, index) =>
    YEARS.map((year, period) => ({
      country,
      region: index === 2 ? 'South' : 'North',
      year,
      gdp: (100 + 50 * index) * (period + 1) * scale,
      life: 50 + index * 5 + period,
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

function staticSpec(): ChartSpec {
  const { time: _time, ...encoding } = timeSpec().encoding as Record<string, unknown>;
  return { ...timeSpec(), encoding } as ChartSpec;
}

const cleanup: Array<() => void> = [];
afterEach(() => {
  for (const fn of cleanup.splice(0)) fn();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function mount(spec: ChartSpec, options: Parameters<typeof createChart>[2] = {}) {
  const container = createContainer(640, 480);
  const chart = createChart(container, spec, { autoResize: false, ...options });
  cleanup.push(() => chart.destroy());
  return { container, chart };
}

function playback(chart: ReturnType<typeof createChart>) {
  const controller = chart.playback;
  if (!controller) throw new Error('expected a playback controller');
  return controller;
}

describe('chart.playback', () => {
  it('is a controller for a time spec and null otherwise', () => {
    expect(mount(timeSpec()).chart.playback).not.toBeNull();
    expect(mount(staticSpec()).chart.playback).toBeNull();
  });

  it('keeps its identity and listeners through a compatible update, at the same period', () => {
    const { chart } = mount(timeSpec());
    const controller = playback(chart);
    const periods: string[] = [];
    controller.on('period', (period) => periods.push(period.label));
    controller.seek(1);
    chart.update(timeSpec({ data: rows(2) }));
    expect(chart.playback).toBe(controller);
    expect(controller.getState().t).toBe(1);
    controller.seek(2);
    expect(periods).toEqual(['2001', '2002']);
  });

  it('resets to the start on an incompatible update', () => {
    const { chart } = mount(timeSpec());
    playback(chart).seek(1.5);
    const encoding = { ...timeSpec().encoding, key: { field: 'region', type: 'nominal' as const } };
    const regionRows = rows().filter((row) => row.country !== 'Borea');
    chart.update(timeSpec({ data: regionRows, encoding }));
    expect(playback(chart).getState().t).toBe(0);
  });

  it('appears when an update adds time and goes when one removes it', () => {
    const { chart } = mount(staticSpec());
    expect(chart.playback).toBeNull();
    chart.update(timeSpec());
    expect(chart.playback).not.toBeNull();
    chart.update(staticSpec());
    expect(chart.playback).toBeNull();
  });
});

describe('mounting a time spec', () => {
  it('turns the entrance animation off', () => {
    const { container } = mount(timeSpec());
    expect(container.querySelector('svg')?.getAttribute('class')).not.toContain('oc-animate');
  });

  it('draws the opening frame on the base marks', () => {
    // animation: false opens on the final period.
    const { container, chart } = mount(timeSpec({ animation: false }));
    expect(playback(chart).getState().t).toBe(2);
    const circles = container.querySelectorAll('[data-key]');
    expect([...circles].map((el) => el.getAttribute('data-key')).sort()).toEqual([
      'Avalon',
      'Borea',
      'Cydonia',
    ]);
  });

  it('warns and renders SVG when canvas is requested', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { container } = mount(timeSpec(), { renderer: 'canvas' });
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelectorAll('svg [data-key]')).toHaveLength(3);
    expect(warn.mock.calls.some(([message]) => /canvas/.test(String(message)))).toBe(true);
  });

  it('exports every period as CSV', () => {
    const { chart } = mount(timeSpec());
    const lines = String(chart.export('csv')).trim().split('\n');
    expect(lines).toHaveLength(rows().length + 1);
    for (const year of YEARS) expect(lines.some((line) => line.includes(String(year)))).toBe(true);
  });

  it('pauses when an edit gesture starts', () => {
    const spec = timeSpec({
      annotations: [{ type: 'text', id: 'note', x: 300, y: 55, text: 'Note' }],
    });
    const { container, chart } = mount(spec, { interaction: 'edit', onEdit: () => {} });
    const controller = playback(chart);
    controller.play();
    expect(controller.getState().playing).toBe(true);
    const annotation = container.querySelector('.oc-annotation-text');
    annotation?.dispatchEvent(createMouseEvent('mousedown', 100, 100));
    document.dispatchEvent(createMouseEvent('mousemove', 140, 120));
    expect(controller.getState().playing).toBe(false);
    document.dispatchEvent(createMouseEvent('mouseup', 140, 120));
  });
});

describe('renderStaticSVG with t', () => {
  /** cx of every keyed circle, in document order. */
  const positions = (svg: string) =>
    [...svg.matchAll(/<circle\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => tag.includes('data-key='))
      .map((tag) => /\scx="([^"]+)"/.exec(tag)?.[1]);

  it('draws the final period by default and the period t names', () => {
    const spec = timeSpec();
    const final = positions(renderStaticSVG(spec, { idPrefix: 'p' }));
    expect(final).toHaveLength(3);
    expect(positions(renderStaticSVG(spec, { idPrefix: 'p', t: 2 }))).toEqual(final);
    expect(positions(renderStaticSVG(spec, { idPrefix: 'p', t: 0 }))).not.toEqual(final);
  });
});

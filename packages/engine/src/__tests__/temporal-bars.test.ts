import type { ChartSpec, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../compile';
import { resolveTemporalInterval } from '../layout/temporal-interval';

const DAY = 86400000;
const data = ['2026-10-12', '2026-10-19', '2026-10-26'].flatMap((week) => [
  { week, preset: 'First', count: 40 },
  { week, preset: 'Second', count: 25 },
]);
const spec: ChartSpec = {
  mark: 'bar',
  data,
  animation: false,
  encoding: {
    x: { field: 'week', type: 'temporal' },
    y: { field: 'count', type: 'quantitative' },
    color: { field: 'preset', type: 'nominal' },
  },
  annotations: [{ type: 'refline', x: '2026-10-20' }],
};
const bars = (layout: ReturnType<typeof compileChart>) =>
  layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');

describe('continuous temporal bars', () => {
  for (const width of [330, 360, 680])
    it(`centers whole weekly stacks and shares the reference scale at ${width}px`, () => {
      const warnings: string[] = [];
      const layout = compileChart(spec, {
        width,
        height: 360,
        onWarn: (message) => warnings.push(message),
      });
      const marks = bars(layout);
      expect(marks).toHaveLength(6);
      const expected = (layout.area.width / 3) * 0.8;
      expect(marks[0].width).toBeCloseTo(expected, 6);
      expect(marks[0].x + marks[0].width / 2).toBeCloseTo(layout.area.x + layout.area.width / 6, 6);
      expect(marks[0].x).toBeGreaterThanOrEqual(layout.area.x);
      expect(marks[4].x + marks[4].width).toBeLessThanOrEqual(layout.area.x + layout.area.width);
      for (let i = 0; i < marks.length; i += 2) {
        expect(marks[i + 1].y).toBeGreaterThanOrEqual(layout.area.y - 0.001);
        expect(marks[i + 1].x).toBe(marks[i].x);
        expect(marks[i + 1].width).toBe(marks[i].width);
        expect(marks[i + 1].y + marks[i + 1].height).toBeCloseTo(marks[i].y, 6);
        expect(marks[i].height / marks[i + 1].height).toBeCloseTo(40 / 25, 6);
      }
      const ref = layout.annotations[0];
      expect(ref.type).toBe('refline');
      if (ref.type === 'refline') {
        expect(Number.isFinite(ref.line!.start.x)).toBe(true);
        expect(ref.line!.start.x).toBeGreaterThan(marks[2].x + marks[2].width / 2);
        expect(ref.line!.start.x).toBeLessThan(marks[4].x + marks[4].width / 2);
      }
      expect(warnings.filter((w) => w.includes('interval'))).toHaveLength(0);
    });

  it('honors explicit domains without interval padding', () => {
    const layout = compileChart(
      {
        ...spec,
        encoding: {
          ...spec.encoding,
          x: { ...spec.encoding.x, scale: { domain: ['2026-10-12', '2026-10-26'] } },
        },
      },
      { width: 680, height: 360 },
    );
    const mark = bars(layout)[0];
    expect(mark.x + mark.width / 2).toBeCloseTo(layout.area.x, 6);
    expect(mark.width).toBeCloseTo((layout.area.width / 2) * 0.8, 6);
  });

  it('warns when a calendar interval conflicts with observations', () => {
    const warnings: string[] = [];
    compileChart(
      { ...spec, encoding: { ...spec.encoding, x: { ...spec.encoding.x, interval: 'month' } } },
      { width: 680, height: 360, onWarn: (message) => warnings.push(message) },
    );
    expect(warnings.some((w) => w.includes('interval') && w.includes('multiples'))).toBe(true);
  });

  it.each([
    'vertical',
    'horizontal',
  ] as const)('keeps missing-series grouped slots stable for %s temporal bars', (orientation) => {
    const sparse = [
      { week: '2026-10-12', preset: 'First', count: 40 },
      { week: '2026-10-12', preset: 'Second', count: 25 },
      { week: '2026-10-19', preset: 'Second', count: 25 },
    ];
    const vertical = orientation === 'vertical';
    const grouped: ChartSpec = {
      mark: 'bar',
      data: sparse,
      encoding: {
        x: vertical
          ? { field: 'week', type: 'temporal', interval: 'week' }
          : { field: 'count', type: 'quantitative', stack: null },
        y: vertical
          ? { field: 'count', type: 'quantitative', stack: null }
          : { field: 'week', type: 'temporal', interval: 'week' },
        color: { field: 'preset', type: 'nominal' },
      },
    };
    const layout = compileChart(grouped, { width: 680, height: 360 });
    const marks = bars(layout);
    expect(marks).toHaveLength(3);
    const size = vertical ? 'width' : 'height';
    const position = vertical ? 'x' : 'y';
    expect(marks[2][size]).toBeCloseTo(marks[1][size], 6);
    const center = vertical
      ? layout.area.x + layout.area.width * 0.75
      : layout.area.y + layout.area.height * 0.25;
    expect(marks[2][position]).toBeGreaterThan(center);
    expect(new Set(marks.map((mark) => mark.key)).size).toBe(3);
    const reordered = bars(
      compileChart({ ...grouped, data: [...sparse].reverse() }, { width: 680, height: 360 }),
    );
    expect(new Set(reordered.map((mark) => mark.key))).toEqual(
      new Set(marks.map((mark) => mark.key)),
    );
  });

  it('uses each calendar month’s actual span for column widths', () => {
    const monthly: ChartSpec = {
      mark: 'bar',
      data: ['2024-01-01', '2024-02-01', '2024-03-01'].map((week) => ({ week, count: 10 })),
      encoding: {
        x: { field: 'week', type: 'temporal', interval: 'month' },
        y: { field: 'count', type: 'quantitative' },
      },
    };
    const marks = bars(compileChart(monthly, { width: 680, height: 360 }));
    expect(marks[0].width / marks[1].width).toBeCloseTo(31 / 29, 6);
    expect(marks[0].width).toBeCloseTo(marks[2].width, 6);
  });

  it('renders horizontal temporal slots', () => {
    const horizontal: ChartSpec = {
      ...spec,
      encoding: {
        x: { field: 'count', type: 'quantitative' },
        y: { field: 'week', type: 'temporal', interval: 'week' },
        color: { field: 'preset', type: 'nominal' },
      },
      annotations: [],
    };
    const layout = compileChart(horizontal, { width: 680, height: 360 });
    expect(bars(layout)).toHaveLength(6);
    expect(bars(layout)[0].height).toBeCloseTo((layout.area.height / 3) * 0.8, 6);
  });

  it.each([
    'month',
    'quarter',
    'year',
  ] as const)('uses calendar arithmetic for %s in UTC', (interval) => {
    const resolved = resolveTemporalInterval(
      { field: 'date', type: 'temporal', interval },
      [],
      'utc',
    );
    const date = new Date('2024-01-01T00:00:00Z');
    const expected = { month: '2024-02-01', quarter: '2024-04-01', year: '2025-01-01' };
    expect(resolved.offset(date).toISOString().slice(0, 10)).toBe(expected[interval]);
    if (interval === 'year') expect(+resolved.offset(date) - +date).toBe(366 * DAY);
  });

  it('uses local calendar days across daylight-saving changes', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'America/Chicago';
    try {
      const resolved = resolveTemporalInterval(
        { field: 'date', type: 'temporal', interval: 'day' },
        [],
        'time',
      );
      expect(
        +resolved.offset(new Date('2026-03-08T00:00:00-06:00')) -
          +new Date('2026-03-08T00:00:00-06:00'),
      ).toBe(23 * 3600000);
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('warns only when inferred gaps are not multiples', () => {
    const resolve = (days: number[]) =>
      resolveTemporalInterval(
        { field: 'date', type: 'temporal' },
        days.map((day) => ({ date: new Date(day * DAY) })),
        'utc',
      );
    expect(resolve([0, 7, 21]).warnings).toHaveLength(0);
    expect(resolve([0, 7, 17]).warnings).toHaveLength(1);
  });

  it.each([0, -1, Infinity, NaN, 'hour'])('rejects invalid interval %s', (interval) => {
    expect(() =>
      compileChart(
        { ...spec, encoding: { ...spec.encoding, x: { ...spec.encoding.x, interval } } },
        { width: 680, height: 360 },
      ),
    ).toThrow(/interval/);
  });
  it('rejects interval on a non-temporal or unsupported channel', () => {
    expect(() =>
      compileChart(
        { ...spec, encoding: { ...spec.encoding, y: { ...spec.encoding.y, interval: 'week' } } },
        { width: 680, height: 360 },
      ),
    ).toThrow(/interval/);
    expect(() =>
      compileChart(
        {
          ...spec,
          mark: 'line',
          encoding: { ...spec.encoding, x: { ...spec.encoding.x, interval: 'week' } },
        },
        { width: 680, height: 360 },
      ),
    ).toThrow(/interval/);
  });
});

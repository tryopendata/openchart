import type { LayerSpec, LineMark, RectMark } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart, compileLayer } from '../compile';
import { resolveTemporalInterval } from '../layout/temporal-interval';

const DAY = 86400000;

function withTimeZone(tz: string, run: () => void): void {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    run();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

describe('temporal bar intervals in layers', () => {
  it('puts line points on the bar centers of the same weekly datum', () => {
    const data = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((week, i) => ({
      week,
      count: 10 + i * 5,
    }));
    const encoding = {
      x: { field: 'week', type: 'temporal' as const },
      y: { field: 'count', type: 'quantitative' as const },
    };
    const spec: LayerSpec = {
      data,
      animation: false,
      layer: [
        { mark: 'bar', encoding },
        { mark: 'line', encoding },
      ],
    } as LayerSpec;
    const layout = compileLayer(spec, { width: 680, height: 360 });
    const bars = layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
    const line = layout.marks.find((mark): mark is LineMark => mark.type === 'line')!;
    expect(bars).toHaveLength(4);
    expect(line.points).toHaveLength(4);
    for (const [i, bar] of bars.entries())
      expect(line.points[i].x).toBeCloseTo(bar.x + bar.width / 2, 6);
    // The shared domain keeps the bar padding: the first column stays whole.
    expect(bars[0].x).toBeGreaterThanOrEqual(layout.area.x - 1e-6);
  });

  it('keeps edge columns inside the plot on a dual-axis bar + line', () => {
    const data = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((week, i) => ({
      week,
      count: 10 + i * 5,
      rate: 0.5 + i * 0.1,
    }));
    const x = { field: 'week', type: 'temporal' as const };
    const spec = {
      data,
      animation: false,
      resolve: { scale: { y: 'independent' } },
      layer: [
        { mark: 'bar', encoding: { x, y: { field: 'count', type: 'quantitative' } } },
        { mark: 'line', encoding: { x, y: { field: 'rate', type: 'quantitative' } } },
      ],
    } as LayerSpec;
    const layout = compileLayer(spec, { width: 680, height: 360 });
    const bars = layout.marks.filter((mark): mark is RectMark => mark.type === 'rect');
    const line = layout.marks.find((mark): mark is LineMark => mark.type === 'line')!;
    expect(bars).toHaveLength(4);
    for (const [i, bar] of bars.entries())
      expect(line.points[i].x).toBeCloseTo(bar.x + bar.width / 2, 6);
    expect(bars[0].x).toBeGreaterThanOrEqual(layout.area.x - 1e-6);
    const last = bars[bars.length - 1];
    expect(last.x + last.width).toBeLessThanOrEqual(layout.area.x + layout.area.width + 1e-6);
  });
});

describe('interval validation', () => {
  it.each(['rect', 'errorbar'])('rejects interval on %s, which does not use it', (mark) => {
    expect(() =>
      compileChart(
        {
          mark,
          data: [
            { week: '2026-10-12', lo: 1, hi: 2, row: 'a' },
            { week: '2026-10-19', lo: 1, hi: 3, row: 'a' },
          ],
          encoding: {
            x: { field: 'week', type: 'temporal', interval: 'week' },
            y: { field: 'lo', type: 'quantitative' },
            y2: { field: 'hi' },
          },
        } as never,
        { width: 680, height: 360 },
      ),
    ).toThrow(/interval.*bar/);
  });
});

describe('calendar-aware interval inference', () => {
  it('infers one week from local weekly data crossing a DST change, without warning', () => {
    withTimeZone('America/Chicago', () => {
      const weeks = ['2026-02-22', '2026-03-01', '2026-03-08', '2026-03-15'].map((day) => ({
        date: new Date(`${day}T00:00:00`),
      }));
      const resolved = resolveTemporalInterval({ field: 'date', type: 'temporal' }, weeks, 'time');
      expect(resolved.value).toBe('week');
      expect(resolved.warnings).toHaveLength(0);
      const start = weeks[2].date;
      expect(resolved.offset(start).getDate()).toBe(15);
    });
  });

  it.each([
    'utc',
    'time',
  ] as const)('infers one month from 31st-of-month data in %s mode', (mode) => {
    withTimeZone('America/Chicago', () => {
      const days = ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'];
      const rows = days.map((day) => ({
        date: mode === 'utc' ? new Date(`${day}T00:00:00Z`) : new Date(`${day}T00:00:00`),
      }));
      const resolved = resolveTemporalInterval({ field: 'date', type: 'temporal' }, rows, mode);
      expect(resolved.value).toBe('month');
      expect(resolved.warnings).toHaveLength(0);
    });
  });

  it('keeps millisecond inference for sub-day and irregular data', () => {
    const hourly = [0, 1, 2].map((hour) => ({ date: new Date(hour * 3600000) }));
    expect(resolveTemporalInterval({ field: 'date', type: 'temporal' }, hourly, 'utc').value).toBe(
      3600000,
    );
    const days = [0, 7, 17].map((day) => ({ date: new Date(day * DAY) }));
    const irregular = resolveTemporalInterval({ field: 'date', type: 'temporal' }, days, 'utc');
    expect(irregular.warnings).toHaveLength(1);
  });

  it('infers whole days from daily UTC data', () => {
    const rows = [0, 1, 3].map((day) => ({ date: new Date(day * DAY) }));
    const resolved = resolveTemporalInterval({ field: 'date', type: 'temporal' }, rows, 'utc');
    expect(resolved.value).toBe('day');
    expect(resolved.warnings).toHaveLength(0);
  });
});

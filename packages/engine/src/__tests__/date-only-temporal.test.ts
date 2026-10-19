/**
 * Date-only ISO strings ('2020', '2020-04', '2020-04-01') parse as UTC
 * midnight, so their axis must be built in UTC too. A local-time scale put the
 * ticks at local midnight: west of UTC the domain ended six hours before the
 * last year's tick and dropped it, east of UTC the first tick fell off instead,
 * and the labels changed with the machine's timezone.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compileChart } from '../compile';

const yearSpan = {
  mark: 'line',
  data: [
    { date: '2020-01-01', value: 10 },
    { date: '2020-07-01', value: 25 },
    { date: '2021-01-01', value: 40 },
  ],
  encoding: {
    x: { field: 'date', type: 'temporal' },
    y: { field: 'value', type: 'quantitative' },
  },
};

const isUtcMidnight = (d: Date) =>
  d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;

// CI runs in UTC, where a local-time scale is indistinguishable from a UTC
// one; pin zones on both sides of it. Node re-reads TZ at runtime.
describe.each(['America/Los_Angeles', 'Asia/Tokyo'])('date-only temporal data in %s', (zone) => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
  });
  afterAll(() => {
    process.env.TZ = originalTz;
  });

  it('ticks the first and last date of the data in any timezone', () => {
    const layout = compileChart(structuredClone(yearSpan), { width: 600, height: 400 });
    const ticks = layout.axes.x!.ticks;
    const values = ticks.map((t) => (t.value as Date).toISOString());
    expect(values[0]).toBe('2020-01-01T00:00:00.000Z');
    expect(values.at(-1)).toBe('2021-01-01T00:00:00.000Z');
    expect(ticks.every((t) => isUtcMidnight(t.value as Date))).toBe(true);
    expect(ticks.at(-1)!.label).toBe('2021');
  });

  it('puts each point on the tick for its date', () => {
    const layout = compileChart(structuredClone(yearSpan), { width: 600, height: 400 });
    const [first, last] = [layout.axes.x!.ticks[0], layout.axes.x!.ticks.at(-1)!];
    const line = layout.marks.find((m) => m.type === 'line') as { points: { x: number }[] };
    expect(line.points[0].x).toBeCloseTo(first.position, 6);
    expect(line.points.at(-1)!.x).toBeCloseTo(last.position, 6);
  });

  it('positions an annotation on a date-only axis', () => {
    const layout = compileChart(
      {
        ...structuredClone(yearSpan),
        annotations: [{ type: 'refline', x: '2020-07-01', label: 'Midyear' }],
      },
      { width: 600, height: 400 },
    );
    const line = layout.marks.find((m) => m.type === 'line') as { points: { x: number }[] };
    const refline = layout.annotations[0] as { line?: { start: { x: number } } };
    expect(refline.line?.start.x).toBeCloseTo(line.points[1].x, 6);
  });

  it('keeps a local-time axis for timestamps with a time of day', () => {
    const spec = structuredClone(yearSpan);
    spec.data = spec.data.map((d) => ({ ...d, date: `${d.date}T00:00` }));
    const layout = compileChart(spec, { width: 600, height: 400 });
    expect(layout.xInvert?.scaleType).toBe('time');
  });
});

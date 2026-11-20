import {
  CELL_SWEEP_BUDGET_MS,
  type ChartSpec,
  evalCurve,
  evalKeyframes,
  evalRoleEase,
  LINE_POINT_CASCADE_MS,
  type LineMark,
  type Mark,
  type MotionPhase,
  type PointMark,
  progressTimeMs,
  type RectMark,
  shuffledSweepDelays,
} from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import { cellSweepDelays, linePointDelays, revealFrom, stackExtents } from '../entrance-geometry';

function rects(spec: ChartSpec): RectMark[] {
  const layout = compileChart(spec, { width: 600, height: 400 });
  return layout.marks.filter((m): m is RectMark => m.type === 'rect');
}

const columns = (values: number[]): ChartSpec => ({
  mark: 'bar',
  data: values.map((value, i) => ({ name: `c${i}`, value })),
  encoding: {
    x: { field: 'name', type: 'nominal' },
    y: { field: 'value', type: 'quantitative' },
  },
});

describe('revealFrom', () => {
  it('grows a negative column down from its baseline', () => {
    const bars = rects(columns([20, -30]));
    const negative = bars.find((b) => b.data.value === -30)!;
    expect(negative.baseline).toBeCloseTo(negative.y, 6);
    // Its clip collapses onto the top edge, so it grows down.
    expect(revealFrom(false, negative.y, negative.y + negative.height, negative.baseline)).toBe(
      '0 0 100% 0',
    );
  });
});

describe('stackExtents', () => {
  it('spans a centred stack across its baseline as one extent', () => {
    const spec: ChartSpec = {
      mark: 'bar',
      data: [
        { name: 'a', series: 'x', value: 10 },
        { name: 'a', series: 'y', value: 20 },
        { name: 'a', series: 'z', value: 15 },
      ],
      // A centred stack crosses zero: segments sit on both sides of it.
      encoding: {
        x: { field: 'name', type: 'nominal' },
        y: { field: 'value', type: 'quantitative', stack: 'center' },
        color: { field: 'series', type: 'nominal' },
      },
      // Stack positions are only assigned to animated charts.
      animation: true,
    };
    const bars = rects(spec);
    const stacks = stackExtents(bars);
    expect(stacks.size).toBe(3);
    const stack = stacks.get(bars[0])!;
    for (const bar of bars) expect(stacks.get(bar)).toBe(stack);
    expect(stack.start).toBeLessThan(stack.baseline!);
    expect(stack.end).toBeGreaterThan(stack.baseline!);
  });
});

describe('linePointDelays', () => {
  const xs = [0, 100, 200, 300, 400];
  const line: LineMark = {
    type: 'line',
    points: xs.map((x, i) => ({ x, y: 50 + i })),
    path: '',
    stroke: '#000',
    strokeWidth: 2,
    seriesKey: 's',
    data: [],
    aria: { label: '' },
  } as unknown as LineMark;
  const points = xs.map(
    (x, i) =>
      ({ type: 'point', cx: x, cy: 50 + i, r: 3, data: {}, aria: { label: '' } }) as PointMark,
  );
  const marks: Mark[] = [line, ...points];

  it.each<[string, MotionPhase]>([
    ['smooth', { duration: 800, ease: 'smooth' }],
    ['snappy', { duration: 800, ease: 'snappy' }],
  ])('waits for the line to draw, then cascades left to right on glide (%s)', (_, phase) => {
    const delays = linePointDelays(marks, phase, 0);
    const values = points.map((_, i) => delays.get(i + 1)!.delayMs);
    const drawn = progressTimeMs('line-area', 0, phase, { staggerMs: 0 }, 0.97);
    // The first dot waits until the line's clip has revealed 97% of it.
    expect(values[0]).toBe(drawn);
    const frame = evalKeyframes('oc-enter-line', values[0] / phase.duration, (t) =>
      evalRoleEase('line-area', phase, t),
    );
    const clip = frame['clip-path'];
    if (clip?.type !== 'inset') throw new Error('expected an inset clip');
    expect(clip.right).toBeLessThanOrEqual(3 + 1e-6);
    // Then the dots follow by x on the glide curve, the last one the full
    // cascade after the first.
    points.forEach((point, i) => {
      expect(values[i]).toBeCloseTo(drawn + evalCurve('glide', point.cx / 400) * 240, 9);
    });
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values.at(-1)! - values[0]).toBeCloseTo(LINE_POINT_CASCADE_MS, 9);
  });

  it("adds the line's own stagger and skips points on no series", () => {
    const phase: MotionPhase = { duration: 800, ease: 'smooth' };
    const stray = { ...points[0], cx: 999, cy: 999 } as PointMark;
    const delays = linePointDelays([{ ...line, animationIndex: 2 }, ...points, stray], phase, 75);
    const unstaggered = linePointDelays(marks, phase, 75);
    expect(delays.get(1)!.delayMs - unstaggered.get(1)!.delayMs).toBeCloseTo(150, 9);
    expect(delays.has(points.length + 1)).toBe(false);
  });

  it("keys a faceted panel's dots on its offset line index", () => {
    const phase: MotionPhase = { duration: 800, ease: 'smooth' };
    const delays = linePointDelays(marks, phase, 75, 7);
    expect(delays.get(1)?.delayMs).toBe(
      progressTimeMs('line-area', 7, phase, { staggerMs: 75 }, 0.97),
    );
  });

  it('starts every dot of a zero-width series at once', () => {
    const phase: MotionPhase = { duration: 800, ease: 'smooth' };
    const single = { ...line, points: [{ x: 50, y: 10 }] } as LineMark;
    const dot = { ...points[0], cx: 50, cy: 10 } as PointMark;
    const delays = linePointDelays([single, dot], phase, 0);
    expect(delays.get(1)?.delayMs).toBe(
      progressTimeMs('line-area', 0, phase, { staggerMs: 0 }, 0.97),
    );
  });
});

describe('cellSweepDelays', () => {
  const cell = (x: number): RectMark =>
    ({ type: 'rect', x, y: 0, width: 10, height: 10, cell: true, data: {} }) as RectMark;
  const bar = { ...cell(0), cell: undefined } as RectMark;

  it('gives each cell, and only cells, a shuffled slot over the sweep budget', () => {
    const marks: Mark[] = [bar, ...Array.from({ length: 6 }, (_, i) => cell(i * 10))];
    const delays = cellSweepDelays(marks);
    expect(delays.has(0)).toBe(false);
    expect([...delays.keys()]).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...delays.values()]).toEqual(shuffledSweepDelays(6, CELL_SWEEP_BUDGET_MS, 6));
  });

  it("gives equal-sized facet panels different orders via the panel's offset", () => {
    const panel: Mark[] = Array.from({ length: 9 }, (_, i) => cell(i * 10));
    const first = [...cellSweepDelays(panel, 0).values()];
    const second = [...cellSweepDelays(panel, 9).values()];
    expect(first).toEqual(shuffledSweepDelays(9, CELL_SWEEP_BUDGET_MS, 9));
    expect(second).not.toEqual(first);
  });

  it('returns nothing for a chart with no cells', () => {
    expect(cellSweepDelays([bar]).size).toBe(0);
  });
});

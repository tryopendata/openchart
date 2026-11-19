import {
  type ChartSpec,
  evalKeyframes,
  evalRoleEase,
  type LineMark,
  type Mark,
  type MotionPhase,
  type PointMark,
  type RectMark,
} from '@opendata-ai/openchart-core';
import { compileChart } from '@opendata-ai/openchart-engine';
import { describe, expect, it } from 'vitest';
import {
  labelAnchor,
  labelFromOffset,
  linePointDelays,
  revealFrom,
  stackExtents,
} from '../entrance-geometry';

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

describe('labelFromOffset', () => {
  it('carries a positive column label from the baseline up to its tip', () => {
    for (const bar of rects(columns([10, 40, 25]))) {
      expect(bar.baseline).toBeCloseTo(bar.y + bar.height, 6);
      const offset = labelFromOffset(bar, undefined)!;
      expect(offset.x).toBe(0);
      // The tip (top edge) plus the offset lands on the baseline.
      expect(bar.y + offset.y).toBeCloseTo(bar.baseline!, 6);
      expect(offset.y).toBeGreaterThan(0);
    }
  });

  it('carries a negative column label from the baseline down to its tip', () => {
    const bars = rects(columns([20, -30]));
    const negative = bars.find((b) => b.data.value === -30)!;
    expect(negative.baseline).toBeCloseTo(negative.y, 6);
    const offset = labelFromOffset(negative, undefined)!;
    expect(negative.y + negative.height + offset.y).toBeCloseTo(negative.baseline!, 6);
    expect(offset.y).toBeLessThan(0);
    // Its clip collapses onto the top edge, so it grows down.
    expect(revealFrom(false, negative.y, negative.y + negative.height, negative.baseline)).toBe(
      '0 0 100% 0',
    );
  });

  it('an outside value label rides the tip, keeping its resting gap', () => {
    const bars = rects({ ...columns([10, 40, -25]), labels: { density: 'all' } });
    for (const bar of bars) {
      const anchor = labelAnchor(bar)!;
      const tip = bar.data.value < 0 ? bar.y + bar.height : bar.y;
      // The label rests beyond the tip...
      expect(Math.abs(anchor - bar.baseline!)).toBeGreaterThan(Math.abs(tip - bar.baseline!));
      // ...so it starts the same distance beyond the baseline and rides with the tip.
      expect(labelFromOffset(bar, undefined, anchor)!.y).toBeCloseTo(bar.baseline! - tip, 6);
    }
  });

  it('carries a horizontal bar label along x', () => {
    const bars = rects({
      mark: 'bar',
      data: [
        { name: 'a', value: 10 },
        { name: 'b', value: 30 },
      ],
      encoding: {
        y: { field: 'name', type: 'nominal' },
        x: { field: 'value', type: 'quantitative' },
      },
    });
    for (const bar of bars) {
      const offset = labelFromOffset(bar, undefined)!;
      expect(offset.y).toBe(0);
      expect(bar.x + bar.width + offset.x).toBeCloseTo(bar.baseline!, 6);
    }
  });

  it('starts labels inside a stack on the baseline, so they never leave the clip or cross', () => {
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
      labels: { density: 'all' },
      // Stack positions are only assigned to animated charts.
      animation: true,
    };
    const bars = rects(spec);
    const stacks = stackExtents(bars);
    expect(stacks.size).toBe(3);
    const stack = stacks.get(bars[0])!;
    const baseline = stack.baseline!;
    expect(stack.start).toBeLessThan(baseline);
    expect(stack.end).toBeGreaterThan(baseline);
    for (const bar of bars) {
      const anchor = labelAnchor(bar)!;
      expect(anchor).toBeGreaterThan(stack.start);
      expect(anchor).toBeLessThan(stack.end);
      const offset = labelFromOffset(bar, stacks.get(bar), anchor)!;
      // Starting on the baseline and moving on the stack's curve keeps the
      // label at the same share of the growing clip: inside it, in order.
      expect(anchor + offset.y).toBeCloseTo(baseline, 6);
    }
    // Without an anchor a segment's label rides its stack's tip on its side.
    for (const bar of bars) {
      const above = bar.y + bar.height / 2 < baseline;
      expect(labelFromOffset(bar, stacks.get(bar))!.y).toBeCloseTo(
        baseline - (above ? stack.start : stack.end),
        6,
      );
    }
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
    ['smooth', { duration: 600, ease: 'smooth' }],
    ['snappy', { duration: 600, ease: 'snappy' }],
  ])('increases with x and matches the line clip edge (%s)', (_, phase) => {
    const delays = linePointDelays(marks, phase, 0);
    const values = points.map((_, i) => delays.get(i + 1)!);
    expect(values[0]).toBe(0);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    // The last dot starts when the edge touches it, well before the curve's
    // asymptotic tail ends at D.
    expect(values.at(-1)).toBeLessThan(500);
    // At each point's delay, the oc-enter-line clip edge sits on the dot's
    // leading edge (the first dot, already touching the start, at 0).
    points.forEach((point, i) => {
      if (i === 0) return;
      const local = values[i] / phase.duration;
      const frame = evalKeyframes('oc-enter-line', local, (t) =>
        evalRoleEase('line-area', phase, t),
      );
      const clip = frame['clip-path'];
      if (clip?.type !== 'inset') throw new Error('expected an inset clip');
      const edge = 400 * (1 - clip.right / 100);
      expect(edge).toBeCloseTo(point.cx - point.r, 3);
    });
  });

  it("adds the line's own stagger and skips points on no series", () => {
    const phase: MotionPhase = { duration: 600, ease: 'smooth' };
    const stray = { ...points[0], cx: 999, cy: 999 } as PointMark;
    const delays = linePointDelays([{ ...line, animationIndex: 2 }, ...points, stray], phase, 75);
    expect(delays.get(1)).toBe(150);
    expect(delays.has(points.length + 1)).toBe(false);
  });
});

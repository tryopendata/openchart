import type { TickMarkLayout } from '@opendata-ai/openchart-core';
import { describe, expect, it } from 'vitest';
import { compileChart } from '../../../compile';

const OPTIONS = { width: 800, height: 500 };

const ROWS = [
  { group: '20-29', hours: 3.1 },
  { group: '20-29', hours: 4.7 },
  { group: '60+', hours: 4.1 },
  { group: '60+', hours: 7.0 },
];

function tickMarks(layout: ReturnType<typeof compileChart>): TickMarkLayout[] {
  return layout.marks.filter((m): m is TickMarkLayout => m.type === 'tick');
}

describe('tick marks', () => {
  it('draws vertical strokes when the value axis is x', () => {
    const layout = compileChart(
      {
        mark: 'tick',
        data: ROWS,
        encoding: {
          x: { field: 'hours', type: 'quantitative' },
          y: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );

    const marks = tickMarks(layout);
    expect(marks).toHaveLength(ROWS.length);
    // Perpendicular to the quantitative axis: values run left-to-right, so each
    // observation is a vertical stroke. Horizontal strokes would lie along the
    // value axis and butt end-to-end into a solid bar.
    expect(marks.every((m) => m.orient === 'vertical')).toBe(true);
  });

  it('draws horizontal strokes when the value axis is y', () => {
    const layout = compileChart(
      {
        mark: 'tick',
        data: ROWS,
        encoding: {
          x: { field: 'group', type: 'nominal' },
          y: { field: 'hours', type: 'quantitative' },
        },
      },
      OPTIONS,
    );

    expect(tickMarks(layout).every((m) => m.orient === 'horizontal')).toBe(true);
  });

  it('separates observations within a category along the value axis', () => {
    const layout = compileChart(
      {
        mark: 'tick',
        data: ROWS,
        encoding: {
          x: { field: 'hours', type: 'quantitative' },
          y: { field: 'group', type: 'nominal' },
        },
      },
      OPTIONS,
    );

    const young = tickMarks(layout).filter((m) => m.data.group === '20-29');
    expect(young).toHaveLength(2);
    // Same row, different x: the strip plot's entire job.
    expect(young[0].y).toBe(young[1].y);
    expect(young[0].x).not.toBe(young[1].x);
  });
});
